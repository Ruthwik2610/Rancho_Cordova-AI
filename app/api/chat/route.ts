import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10; 

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error: Missing API keys' }, { status: 500 });
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. GENERATE EMBEDDING
    // FIX: We must explicitly add "/pipeline/feature-extraction" to the router URL.
    // Without this, the model defaults to "Sentence Similarity" mode and fails.
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
          inputs: message,
          options: { wait_for_model: false, use_cache: true }
        }),
      });

      // Handle "Model Loading" (503)
      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Model loading', estimated_time: 20 },
          { status: 503 }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HF Router Error (${response.status}):`, errorText);
        throw new Error(`Hugging Face API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Parse Embedding
      // The pipeline API usually returns a flat array or nested array depending on batch size
      if (Array.isArray(result)) {
         queryVector = (Array.isArray(result[0]) ? result[0] : result) as number[];
      } else {
        throw new Error("Invalid embedding format received from Hugging Face");
      }

    } catch (error: any) {
      console.error('Embedding generation failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    // 3. GENERATE ANSWER (GROQ)
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const isDataQuery = /\b(graph|chart|show|visualize|plot|display|data|statistics|trend|compare)\b/i.test(message);

    const systemPrompts = {
      energy: `You are an energy efficiency advisor for Rancho Cordova. Context: ${context || 'No specific context found.'}. ${isDataQuery ? 'Return JSON for charts.' : ''}`,
      customer: `You are a city services assistant for Rancho Cordova. Context: ${context || 'No specific context found.'}. Be helpful and concise.`
    };

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompts[agentType as keyof typeof systemPrompts] },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    const responseContent = completion.choices[0]?.message?.content || 'I could not generate a response.';
    
    // Parse Chart JSON
    let chartData = null;
    if (isDataQuery && responseContent.includes('"type": "chart"')) {
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*"type":\s*"chart"[\s\S]*\}/);
        if (jsonMatch) chartData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('Failed to parse chart JSON');
      }
    }

    return NextResponse.json({
      response: chartData ? chartData.explanation : responseContent,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
