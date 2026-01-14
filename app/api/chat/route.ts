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

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`HF non-JSON error: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

      if (Array.isArray(result)) {
         queryVector = (Array.isArray(result[0]) ? result[0] : result) as number[];
      } else {
        throw new Error("Invalid embedding format");
      }
    } catch (error: any) {
      console.error('Embedding failed:', error);
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

    // 3. HYBRID HINT LOGIC (The Professional Fix)
    // We check for keywords not to FORCE a chart, but to nudge the model prompt.
    const visualKeywords = /\b(graph|chart|plot|visualize|trend|diagram|heatmap|pie|bar|line|compare|vs|versus)\b/i.test(message);
    
    const chartInstruction = `
    DECISION LOGIC:
    ${visualKeywords 
      ? "HINT: The user's message contains keywords suggesting they MIGHT want a visualization. Evaluate if a chart is the best way to answer. If yes, use the JSON format below." 
      : "HINT: The user did not explicitly ask for a chart. Only provide one if the data is complex and absolutely requires visualization."}

    JSON FORMAT (Use this ONLY for charts):
    {
      "type": "chart",
      "chartType": "line", // options: "line", "bar", "pie", "doughnut"
      "title": "Chart Title",
      "explanation": "Brief explanation of the data",
      "data": {
        "labels": ["Label1", "Label2"],
        "datasets": [{
          "label": "Dataset Name",
          "data": [10, 20],
          "borderColor": "rgb(59, 130, 246)",
          "backgroundColor": "rgba(59, 130, 246, 0.5)"
        }]
      }
    }
    IMPORTANT: If you decide NOT to show a chart, just respond with plain text. Do not output JSON.
    `;

    // 4. GENERATE ANSWER (GROQ)
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const systemPrompts = {
      energy: `You are an energy efficiency advisor for Rancho Cordova. Context: ${context || 'No context.'} \n\n${chartInstruction}`,
      customer: `You are a city services assistant for Rancho Cordova. Context: ${context || 'No context.'} \n\n${chartInstruction}`
    };

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompts[agentType as keyof typeof systemPrompts] },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.3, // Low temperature = precise JSON, less creativity
      max_tokens: 1024,
    });

    const responseContent = completion.choices[0]?.message?.content || 'I could not generate a response.';
    
    // 5. PARSE RESPONSE
    let chartData = null;
    let finalText = responseContent;

    try {
      let cleanResponse = responseContent.trim()
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/```$/, '');
      
      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.type === 'chart') {
        chartData = parsed;
        finalText = parsed.explanation;
      }
    } catch (e) {
      // Normal text response
    }

    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: `Critical Error: ${error.message}` }, { status: 500 });
  }
}
