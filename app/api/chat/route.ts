import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Helper function to retry the API call
async function getEmbeddingWithRetry(text: string, retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      // UPDATED URL: Using the new router.huggingface.co endpoint
      const response = await fetch(
        'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          },
          body: JSON.stringify({
            inputs: text,
            options: { wait_for_model: true, use_cache: false }
          }),
        }
      );

      // If successful, return data
      if (response.ok) {
        return await response.json();
      }

      // If model is loading (503), wait and retry
      if (response.status === 503) {
        const error = await response.json();
        const waitTime = error.estimated_time || delay / 1000;
        console.log(`Model loading, waiting ${waitTime}s... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }

      // If other error, throw
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);

    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY) {
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

    // Initialize Pinecone
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    // 1. GENERATE EMBEDDING (With Retry Logic & New URL)
    let queryVector: number[];
    try {
      queryVector = await getEmbeddingWithRetry(message);
      
      // Handle case where API returns nested array (common with some HF endpoints)
      if (Array.isArray(queryVector) && Array.isArray(queryVector[0])) {
        queryVector = queryVector[0] as unknown as number[];
      }
      
    } catch (embError) {
      console.error('Final Embedding Error:', embError);
      return NextResponse.json(
        { error: 'System is warming up. Please try again in 10 seconds.' },
        { status: 503 }
      );
    }

    // 2. QUERY PINECONE
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    // Build context
    const relevantDocs = queryResponse.matches
      .filter(match => (match.score || 0) > 0.4)
      .map(match => ({
        text: match.metadata?.text ? String(match.metadata.text) : '',
        source: match.metadata?.source ? String(match.metadata.source) : 'Unknown',
        score: match.score || 0
      }));

    const context = relevantDocs.map(doc => doc.text).join('\n\n');

    // 3. GENERATE RESPONSE WITH GROQ
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
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
