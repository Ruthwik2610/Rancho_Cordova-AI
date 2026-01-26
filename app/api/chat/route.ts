import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

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

    const context = queryResponse.matches
      .filter(match => (match.score || 0) > 0.4)
      .map(doc => doc.metadata?.text).join('\n\n');

    // 3. SYSTEM PROMPT (UPDATED & MORE ROBUST)
    // Added: "break up", "distribution", "compare", "pie", "bar"
    const isChartRequest = /\b(forecast|trend|breakdown|break\s*up|distribution|volume|graph|chart|plot|compare|comparison|pie|bar)\b/i.test(message);

    const chartInstruction = `
    The user's query matched a visualization keyword.
    
    IF the answer involves numerical data, trends, or comparisons:
    - You MUST respond with ONLY the following JSON format.
    - Do not include any conversational text outside the JSON.
    
    IF the answer is a text list, location info, or qualitative description (e.g. "breakdown of departments"):
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
      ? `You are a helper for Rancho Cordova. Context: ${context}. ${chartInstruction}`
      : `You are a knowledgeable assistant for Rancho Cordova. Context: ${context}.
         
         CRITICAL FORMATTING RULES:
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
      temperature: 0.3,
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || 'I could not generate a response.';

// 4. PARSE & CLEAN
    let chartData = null;
    let finalText = rawContent;

    // Check if the response contains the specific chart indicator
    if (rawContent.includes('"type": "chart"') || rawContent.includes('"type":"chart"')) {
      try {
        // 1. Remove Markdown code blocks first
        let cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();     
        // 2. ROBUST EXTRACTION: Find the FIRST '{' and the LAST '}'
        
        const firstBrace = cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
           // Extract everything between the outer braces
           const jsonString = cleanContent.substring(firstBrace, lastBrace + 1);
           const parsed = JSON.parse(jsonString);
            
           // 3. Validation
           if (parsed.data && parsed.chartType) {
             chartData = parsed;
             
             finalText = parsed.explanation || "Here is the visualization you requested.";
           }
        }
      } catch (e) {
        console.warn('Chart Parse Error:', e);
       
      }
    }
    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: "An internal system error occurred." }, { status: 500 });
  }
}
