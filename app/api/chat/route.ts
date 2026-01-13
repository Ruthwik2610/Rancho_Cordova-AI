import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';
import { HfInference } from "@huggingface/inference";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Initialize clients
const hf = new HfInference(HUGGINGFACE_API_KEY);

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing API keys' },
        { status: 500 }
      );
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // 1. GENERATE EMBEDDING (Using HuggingFace SDK with Retry)
    let queryVector: number[] = [];
    
    // Retry loop for cold starts (Model Loading)
    let retries = 5;
    while (retries > 0) {
      try {
        const embeddingOutput = await hf.featureExtraction({
          model: "sentence-transformers/all-MiniLM-L6-v2",
          inputs: message,
        });

        // Handle different return types from the SDK
        if (Array.isArray(embeddingOutput)) {
          // Flatten if necessary or take the first result if nested
          if (Array.isArray(embeddingOutput[0])) {
             queryVector = embeddingOutput[0] as number[];
          } else {
             queryVector = embeddingOutput as number[];
          }
        }
        break; // Success
      } catch (error: any) {
        console.warn(`Embedding attempt failed (${retries} left):`, error.message);
        retries--;
        
        // If model is loading, wait 2 seconds
        if (error.message?.includes('loading') || error.status === 503) {
          await new Promise(r => setTimeout(r, 2000));
        } else if (retries === 0) {
          throw error;
        }
      }
    }

    if (!queryVector.length) {
      throw new Error('Failed to generate valid embedding vector');
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

    const relevantDocs = queryResponse.matches
      .filter(match => (match.score || 0) > 0.4)
      .map(match => ({
        text: match.metadata?.text ? String(match.metadata.text) : '',
        source: match.metadata?.source ? String(match.metadata.source) : 'Unknown',
        score: match.score || 0
      }));

    const context = relevantDocs.map(doc => doc.text).join('\n\n');

    // 3. GENERATE RESPONSE (Groq)
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const isDataQuery = /\b(graph|chart|show|visualize|plot|display|data|statistics|trend|compare)\b/i.test(message);

    const systemPrompts = {
      energy: `You are an energy efficiency advisor for Rancho Cordova.
${isDataQuery ? `If the user asks for visualization, return JSON in this format:
{ "type": "chart", "chartType": "line"|"bar"|"pie", "title": "...", "data": { ... }, "explanation": "..." }
Otherwise, respond with text.` : ''}
Context: ${context || 'No specific context found.'}`,
      
      customer: `You are a city services assistant.
Context: ${context || 'No specific context found.'}`
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

    const responseContent = completion.choices[0]?.message?.content || 'No response generated.';

    // Parse JSON if chart
    let chartData = null;
    if (isDataQuery && responseContent.includes('"type": "chart"')) {
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*"type":\s*"chart"[\s\S]*\}/);
        if (jsonMatch) chartData = JSON.parse(jsonMatch[0]);
      } catch (e) { console.log('Chart JSON parsing failed'); }
    }

    return NextResponse.json({
      response: chartData ? chartData.explanation : responseContent,
      chartData: chartData,
      sources: relevantDocs.slice(0, 3).map(d => ({ source: d.source, score: Math.round(d.score * 100) }))
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'An internal error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
