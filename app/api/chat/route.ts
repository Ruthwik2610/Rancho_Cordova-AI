import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!PINECONE_API_KEY || !GROQ_API_KEY) {
  console.error('Missing required environment variables');
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

    // Generate embedding using HuggingFace (free, matches your ingestion model)
    let queryVector: number[];
    
    try {
      const embeddingResponse = await fetch(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            inputs: message,
            options: { wait_for_model: true }
          }),
        }
      );

      if (!embeddingResponse.ok) {
        throw new Error('Embedding generation failed');
      }

      queryVector = await embeddingResponse.json();
    } catch (embError) {
      console.error('Embedding error:', embError);
      return NextResponse.json(
        { error: 'Failed to generate embeddings' },
        { status: 500 }
      );
    }

    // Query Pinecone with agent filter
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    // Build context from results
    const relevantDocs = queryResponse.matches
      .filter(match => (match.score || 0) > 0.5)
      .map(match => ({
        text: match.metadata?.text || '',
        source: match.metadata?.source || 'Unknown',
        score: match.score || 0
      }));

    const context = relevantDocs
      .map(doc => doc.text)
      .join('\n\n');

    // Check if query is asking for data visualization
    const isDataQuery = /\b(graph|chart|show|visualize|plot|display|data|statistics|trend|compare)\b/i.test(message);

    // Initialize Groq
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    // System prompts based on agent type
    const systemPrompts = {
      energy: `You are an energy efficiency advisor for Rancho Cordova, California.
Help residents with:
- SMUD (Sacramento Municipal Utility District) programs and rebates
- Energy-saving tips and strategies
- Solar and renewable energy options
- Understanding utility bills
- Energy efficiency upgrades

${isDataQuery ? `If the user asks for data visualization (graphs, charts, trends), analyze the context and return a JSON object in this EXACT format:
{
  "type": "chart",
  "chartType": "line" | "bar" | "pie" | "doughnut",
  "title": "Chart title",
  "data": {
    "labels": ["Label1", "Label2", ...],
    "datasets": [{
      "label": "Dataset name",
      "data": [value1, value2, ...],
      "backgroundColor": "rgba(59, 130, 246, 0.8)",
      "borderColor": "rgb(59, 130, 246)"
    }]
  },
  "explanation": "Brief explanation of the data"
}

If there's no numerical data in the context, respond normally with text.` : ''}

Be friendly, informative, and focus on practical advice.`,
      
      customer: `You are a helpful customer service assistant for Rancho Cordova city services.
Help residents with:
- Building permits and inspections
- Utility services (water, trash, recycling)
- City programs and events
- Contact information for departments
- Procedures for common requests
- Who to contact for specific issues

Provide clear, actionable information with specific contact details when available.
Be professional, helpful, and empathetic.`
    };

    // Generate response
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: systemPrompts[agentType as keyof typeof systemPrompts] 
        },
        ...(context ? [{ 
          role: 'system', 
          content: `Relevant information from knowledge base:\n${context}` 
        }] : []),
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
    });

    const responseContent = completion.choices[0]?.message?.content || 
      'I apologize, but I was unable to generate a response. Please try again.';

    // Try to parse as JSON if it looks like chart data
    let chartData = null;
    if (isDataQuery && responseContent.includes('"type": "chart"')) {
      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*"type":\s*"chart"[\s\S]*\}/);
        if (jsonMatch) {
          chartData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('Not valid chart JSON, returning as text');
      }
    }

    return NextResponse.json({
      response: chartData ? chartData.explanation : responseContent,
      chartData: chartData,
      sources: relevantDocs
        .slice(0, 3)
        .map(doc => ({
          source: doc.source,
          score: Math.round(doc.score * 100)
        }))
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred processing your request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
