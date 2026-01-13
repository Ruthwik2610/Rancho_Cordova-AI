import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

export const maxDuration = 10; // Match Vercel Free Limit

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'Missing API keys' }, { status: 500 });
    }

    const { message, agentType = 'customer' } = await req.json();

    // 1. GENERATE EMBEDDING
    const modelUrl = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";
    
    let queryVector: number[] = [];
    
    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: message,
          options: { wait_for_model: false, use_cache: true } // Don't wait on server
        }),
      });

      // IF 503: MODEL IS LOADING
      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Model loading', estimated_time: 20 },
          { status: 503 }
        );
      }

      if (!response.ok) {
        throw new Error(`HF API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle array format
      if (Array.isArray(result) && result.length > 0) {
         queryVector = Array.isArray(result[0]) ? result[0] : result;
      } else {
        throw new Error("Invalid embedding format");
      }

    } catch (error: any) {
      console.error('Embedding error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. QUERY PINECONE
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector as number[],
      topK: 5,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    const context = queryResponse.matches
      .filter(match => (match.score || 0) > 0.4)
      .map(doc => doc.metadata?.text).join('\n\n');

    // 3. GENERATE RESPONSE
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const isDataQuery = /\b(graph|chart|show|visualize|plot|display|data|statistics|trend|compare)\b/i.test(message);

    const systemPrompts = {
      energy: `You are an energy advisor. Context: ${context || 'None'}. ${isDataQuery ? 'Return JSON for charts.' : ''}`,
      customer: `You are a city assistant. Context: ${context || 'None'}.`
    };

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompts[agentType as keyof typeof systemPrompts] },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-70b-versatile',
    });

    const responseContent = completion.choices[0]?.message?.content || 'No response.';
    
    // Parse Chart JSON
    let chartData = null;
    if (isDataQuery && responseContent.includes('"type": "chart"')) {
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*"type":\s*"chart"[\s\S]*\}/);
        if (jsonMatch) chartData = JSON.parse(jsonMatch[0]);
      } catch (e) {}
    }

    return NextResponse.json({
      response: chartData ? chartData.explanation : responseContent,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
