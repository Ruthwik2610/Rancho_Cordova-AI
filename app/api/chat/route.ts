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
    // 0. CHECK CONFIG
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      console.error("Missing API Keys");
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
      // Return fallback if search fails
      return NextResponse.json({ response: FALLBACK_MESSAGE });
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

    // 3. CHECK CONTEXT (Instant Fallback if no data found)
    const matches = queryResponse.matches || [];
    if (matches.length === 0) {
      return NextResponse.json({ response: FALLBACK_MESSAGE, sources: [] });
    }

    const context = matches
      .map(doc => doc.metadata?.text)
      .filter(text => text) // filter out undefined/null
      .join('\n\n');

    if (!context || context.trim().length === 0) {
        return NextResponse.json({ response: FALLBACK_MESSAGE, sources: [] });
    }

    // 4. SYSTEM PROMPT (BARRIER REMOVED)
    // No strict rules, just "Helpful Assistant" + "Chart Instructions"
    const isChartRequest = /\b(forecast|trend|breakdown|break\s*up|distribution|volume|graph|chart|plot|compare|comparison|pie|bar)\b/i.test(message);

    const chartInstruction = `
    IF the user asks for a visualization (chart, graph, breakdown) AND the data is present in the context:
    - Respond with ONLY the following JSON format.
    - Do not add conversational text.
    
    JSON Format:
    {
      "type": "chart",
      "chartType": "line", 
      "title": "Chart Title",
      "explanation": "Brief explanation.",
      "data": { "labels": [...], "datasets": [...] }
    }
    Valid chartTypes: "line", "bar", "pie", "doughnut".
    `;

    const systemPrompt = `You are a helpful AI assistant for the City of Rancho Cordova and SMUD.
    
    CONTEXT DATA:
    ${context}

    INSTRUCTIONS:
    1. Answer the user's question using the Context Data provided above.
    2. If the user refers to "Ticket", "Case", or "Issue", check for "CallID" or similar fields in the data.
    3. Be professional, direct, and helpful.
    4. Use Markdown for formatting (bold keys, lists).
    
    ${isChartRequest ? chartInstruction : ''}`;

    // 5. LLM GENERATION
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

    const rawContent = completion.choices[0]?.message?.content || FALLBACK_MESSAGE;

    // 6. PARSE RESPONSE
    let chartData = null;
    let finalText = rawContent;

    // Attempt to extract chart JSON if present
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
        console.warn('Chart Parse Error', e);
        // If JSON fails, just return the text, no big deal
      }
    }
    
    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Critical Error:', error);
    // 7. GLOBAL ERROR FALLBACK
    return NextResponse.json({ response: FALLBACK_MESSAGE }, { status: 200 }); // Return 200 so UI displays message cleanly
  }
}
