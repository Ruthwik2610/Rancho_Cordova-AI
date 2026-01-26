import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// --- CONFIGURATION ---
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// 🔒 EXPLICIT FALLBACK MESSAGE (Defined once, used everywhere)
const FALLBACK_MESSAGE = "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

// Thresholds
const RELEVANCE_THRESHOLD = 0.4;
const CONFIDENCE_THRESHOLD = 0.60;
const HALLUCINATION_CONFIDENCE_THRESHOLD = 0.7;

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. GENERATE EMBEDDING
    const modelUrl = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";
    let queryVector: number[] = [];
    
    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [message],
          options: { wait_for_model: false, use_cache: true }
        }),
      });

      if (response.status === 503) {
        return NextResponse.json({ error: 'Model loading', estimated_time: 20 }, { status: 503 });
      }

      if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

      const result = await response.json();
      if (Array.isArray(result)) {
         queryVector = (Array.isArray(result[0]) ? result[0] : result) as number[];
      } else {
        throw new Error("Invalid embedding format");
      }
    } catch (error: any) {
      console.error('Embedding failed:', error);
      return NextResponse.json({ error: "Search system temporary unavailable." }, { status: 500 });
    }

    // 2. QUERY PINECONE
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    // 3. RELEVANCE CHECK
    const relevantMatches = queryResponse.matches.filter(
      match => (match.score || 0) > RELEVANCE_THRESHOLD
    );

    // 🔒 GUARDRAIL 1: No Data Found
    if (relevantMatches.length === 0) {
      console.log('[GUARDRAIL] No relevant matches', { query: message, agentType });
      return NextResponse.json({
        response: FALLBACK_MESSAGE,
        chartData: null,
        sources: []
      });
    }

    // Calculate Confidence
    const avgScore = relevantMatches.reduce((sum, m) => sum + (m.score || 0), 0) / relevantMatches.length;
    const context = relevantMatches.map(doc => doc.metadata?.text).join('\n\n');

    // 🔒 GUARDRAIL 2: Low Confidence Score
    if (avgScore < CONFIDENCE_THRESHOLD) {
      console.log('[GUARDRAIL] Low confidence', { 
        query: message, 
        avgScore: avgScore.toFixed(3),
        threshold: CONFIDENCE_THRESHOLD 
      });
      return NextResponse.json({
        response: FALLBACK_MESSAGE,
        chartData: null,
        sources: []
      });
    }

    // 4. SYSTEM PROMPT
    const isChartRequest = /\b(forecast|trend|breakdown|break\s*up|distribution|volume|graph|chart|plot|compare|comparison|pie|bar)\b/i.test(message);

    const chartInstruction = `
    The user's query matched a visualization keyword.
    
    STEP 1: CHECK CONTEXT
    Does the provided Context contain the specific numerical data needed to create a visualization?
    - IF NO: You MUST respond with exactly this phrase: "${FALLBACK_MESSAGE}"
    - IF YES: Proceed to Step 2.

    STEP 2: DETERMINE FORMAT
    IF the answer involves numerical data, trends, or comparisons:
    - You MUST respond with ONLY the following JSON format.
    - Do not include any conversational text outside the JSON.
    
    IF the answer is a text list, location info, or qualitative description:
    - Ignore the JSON format.
    - Respond with a normal text answer using Markdown.

    JSON Format (for numerical data only):
    {
      "type": "chart",
      "chartType": "line", 
      "title": "Chart Title",
      "explanation": "Brief explanation.",
      "data": { "labels": [...], "datasets": [...] }
    }
    Valid chartTypes: "line", "bar", "pie", "doughnut".
    `;

    const systemPrompt = isChartRequest
      ? `You are a helper for Rancho Cordova. 
         Context: ${context}
         Context Confidence: ${(avgScore * 100).toFixed(0)}%
         
         ${chartInstruction}
         
         STRICT RULE: If the context doesn't directly answer the question with specific data, respond with: "${FALLBACK_MESSAGE}"`
      : `You are a knowledgeable assistant for Rancho Cordova.
         Context Confidence: ${(avgScore * 100).toFixed(0)}%
         Context: ${context}
         
         CRITICAL RULES:
         1. If the context doesn't contain the specific information requested, respond with: "${FALLBACK_MESSAGE}"
         2. ONLY use information from the provided Context. Do not use outside knowledge.
         3. If asked about something not in the context, always respond with: "${FALLBACK_MESSAGE}"
         
         FORMATTING RULES:
         1. STRUCTURE: Use Markdown.
         2. LISTS: Always insert a BLANK LINE before starting a list.
         3. SPACING: Always insert a BLANK LINE between bullet points.
         4. EMPHASIS: Use **bold** for phone numbers, emails, addresses, and key terms.
         5. TONE: Professional, helpful, and direct.
         
         Do NOT generate JSON unless asked for a chart.`;

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.25, // 🔧 ADJUSTED: Better balance
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || 'I could not generate a response.';

    // 5. POST-PROCESSING SAFEGUARDS

    // 🔒 GUARDRAIL 3: Refusal Detection
    const refusalPatterns = [
      "outside my scope",
      "don't have access",
      "cannot answer",
      "i am sorry",
      "i apologize",
      "unable to provide",
      "i don't have information",
      "no information available",
      FALLBACK_MESSAGE.toLowerCase()
    ];

    const isRefusal = refusalPatterns.some(pattern => 
      rawContent.toLowerCase().includes(pattern)
    );

    if (isRefusal) {
      console.log('[GUARDRAIL] Refusal detected', { query: message });
      return NextResponse.json({
        response: FALLBACK_MESSAGE,
        chartData: null,
        sources: [] 
      });
    }

    // 🔒 GUARDRAIL 4: Hallucination Risk Indicators
    const hallucination_indicators = [
      /as of my knowledge cutoff/i,
      /i don't have real-time/i,
      /generally speaking/i,
      /in most cases/i,
      /typically/i,
      /usually/i
    ];
    
    const hasHallucinationRisk = hallucination_indicators.some(
      pattern => pattern.test(rawContent)
    );

    if (hasHallucinationRisk && avgScore < HALLUCINATION_CONFIDENCE_THRESHOLD) {
      console.log('[GUARDRAIL] Hallucination risk', { 
        query: message, 
        avgScore: avgScore.toFixed(3) 
      });
      return NextResponse.json({
        response: FALLBACK_MESSAGE,
        chartData: null,
        sources: []
      });
    }

    // 6. RESPONSE FORMATTING
    let chartData = null;
    let finalText = rawContent;

    // Parse Chart JSON if present
    if (rawContent.includes('"type": "chart"') || rawContent.includes('"type":"chart"')) {
      try {
        let cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();     
        const firstBrace = cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
           const jsonString = cleanContent.substring(firstBrace, lastBrace + 1);
           const parsed = JSON.parse(jsonString);
            
           if (parsed.data && parsed.chartType) {
             chartData = parsed;
             finalText = parsed.explanation || "Here is the visualization you requested.";
           }
        }
      } catch (e) {
        console.warn('Chart Parse Error:', e);
      }
    }

    // Success - log for monitoring
    console.log('[SUCCESS]', {
      query: message,
      agentType,
      confidence: avgScore.toFixed(3),
      hasChart: !!chartData
    });

    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ 
        source: d.metadata?.source, 
        score: d.score 
      }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ 
      error: "An internal system error occurred." 
    }, { status: 500 });
  }
}
