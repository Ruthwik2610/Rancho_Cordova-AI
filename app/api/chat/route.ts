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

const FALLBACK_MESSAGE = "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ response: FALLBACK_MESSAGE }, { status: 500 });
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
      queryVector = (Array.isArray(result) && Array.isArray(result[0])) ? result[0] : result;
    } catch (error) {
      console.error('Embedding failed:', error);
      return NextResponse.json({ response: FALLBACK_MESSAGE });
    }

    // 2. QUERY PINECONE (FIX: Increased topK to 10)
    // Increasing topK ensures we catch the 'Benchmarks' file even if 'Rebates' scores higher.
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 10, 
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    const matches = queryResponse.matches || [];
    if (matches.length === 0) {
      return NextResponse.json({ response: FALLBACK_MESSAGE, sources: [] });
    }

    const context = matches
      .map(doc => doc.metadata?.text)
      .filter(text => text)
      .join('\n\n');

    // 3. DETECT CHART INTENT
    // Added keywords like "compare", "vs", "versus", "difference" to stronger triggers
    const isChartRequest = /\b(forecast|trend|breakdown|break\s*up|distribution|volume|graph|chart|plot|compare|comparison|pie|bar|vs|versus|diff)\b/i.test(message);

    const chartInstruction = `
    VISUALIZATION MODE ACTIVATED:
    The user wants a comparison or visualization.
    
    CRITICAL INSTRUCTION:
    1. Scan the Context Data for NUMERICAL values related to the user's query.
    2. IF numerical data exists (like costs, rates, counts):
       - You MUST Output ONLY the JSON object below.
       - Do not write any introduction text.
    
    JSON Format:
    {
      "type": "chart",
      "chartType": "bar", 
      "title": "Comparison Title",
      "explanation": "A 1-sentence summary of the data.",
      "data": { 
        "labels": ["Label1", "Label2"], 
        "datasets": [
          { "label": "Dataset Name", "data": [10, 20] }
        ] 
      }
    }
    Valid chartTypes: "line", "bar", "pie", "doughnut".
    `;

    const systemPrompt = `You are a helpful AI assistant for Rancho Cordova and SMUD.
    
    CONTEXT DATA:
    ${context}

    INSTRUCTIONS:
    1. Answer based ONLY on the Context Data.
    2. If the user asks to "Compare" two things and data is present, default to a Chart/Graph using the format below.
    3. If no numerical data is found, explain that clearly in text.
    4. "Ticket" / "Case" refers to "CallID" in the data.
    
    ${isChartRequest ? chartInstruction : ''}`;

    // 4. LLM GENERATION
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, // Low temperature for consistent JSON
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || FALLBACK_MESSAGE;

    // 5. PARSE RESPONSE
    let chartData = null;
    let finalText = rawContent;

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
             finalText = parsed.explanation || "Here is the comparison you requested.";
           }
        }
      } catch (e) {
        console.warn('Chart Parse Error', e);
      }
    }
    
    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ response: FALLBACK_MESSAGE }, { status: 200 });
  }
}
