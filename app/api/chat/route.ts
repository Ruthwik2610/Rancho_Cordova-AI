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

    // 3. SYSTEM PROMPT (SMART & STRICT)
    const isChartRequest = /\b(forecast|trend|breakdown|break\s*up|distribution|volume|graph|chart|plot|compare|comparison|pie|bar)\b/i.test(message);

    const FALLBACK_MESSAGE = "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

    const chartInstruction = `
    The user's query matched a visualization keyword.
    
    IF the answer involves numerical data, trends, or comparisons FOUND IN THE CONTEXT:
    - You MUST respond with ONLY the following JSON format.
    - Do not include any conversational text outside the JSON.
    
    IF the answer is a text list, location info, or qualitative description:
    - Ignore the JSON format.
    - Respond with a normal text answer using Markdown.

    JSON Format:
    {
      "type": "chart",
      "chartType": "line", 
      "title": "Chart Title",
      "explanation": "Brief explanation.",
      "data": { "labels": [...], "datasets": [...] }
    }
    `;

    // --- KEY UPDATE: LOGIC INSTEAD OF DICTIONARY ---
    // We replace the hardcoded dictionary with specific "Rules of Engagement"
    const systemPrompt = isChartRequest
      ? `You are a helper for Rancho Cordova. Context: ${context}. 
         
         STRICT DATA RULE:
         1. Look for the data requested in the Context above.
         2. IF the specific data points are NOT present: Respond EXACTLY with "${FALLBACK_MESSAGE}".
         3. IF present, generate the chart JSON.
         ${chartInstruction}`
      : `You are a knowledgeable assistant for Rancho Cordova and SMUD.
      
         CONTEXT:
         ${context}
         
         STRICT RULES OF ENGAGEMENT:
         1. **NO OUTSIDE KNOWLEDGE:** Do not answer questions using your general training data (e.g., "Who is the US President?", "What is Python code?", "World History"). If the answer is not physically present in the Context above, you MUST respond with: "${FALLBACK_MESSAGE}".
         
         2. **INTELLIGENT MATCHING:** You ARE allowed to infer that user terms refer to the provided data fields if the values match.
            - Example: If user asks for "Ticket CL0092" and context has "CallID: CL0092", this IS a match. Answer it.
            - Example: If user asks for "Bill" and context has "Cost" or "Rate", this IS a match.
            
         3. **VERIFICATION:** Before answering, ask yourself: "Is this information in the text block above?"
            - If YES: Answer using Markdown (bold keys, lists).
            - If NO: Output the Fallback Message.`;

    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, 
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || 'I could not generate a response.';

    // 4. PARSE & CLEAN
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
