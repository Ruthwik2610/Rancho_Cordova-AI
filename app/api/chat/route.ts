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

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`HF non-JSON error: ${response.status}`);
      }

      if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

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

    // 3. STRICT COMMAND TRIGGER
    // We strictly filter for the words in your "Plotting commands" list.
    // Allowed Keywords: "forecast", "trend", "breakdown", "volume"
    // Plus explicit overrides: "graph", "chart", "plot"
    const isChartRequest = /\b(forecast|trend|breakdown|volume|graph|chart|plot)\b/i.test(message);

    const chartInstruction = `
    IMPORTANT: The user issued a plotting command. You MUST respond with ONLY this JSON format:
    {
      "type": "chart",
      "chartType": "line", // options: "line", "bar", "pie", "doughnut"
      "title": "Chart Title",
      "explanation": "A natural language sentence explaining the data shown.",
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
    CRITICAL: Output ONLY valid JSON.
    `;

    const groq = new Groq({ apiKey: GROQ_API_KEY });

    // Conditional Prompting
    const systemPrompt = isChartRequest
      ? `You are a helper for Rancho Cordova. Context: ${context}. ${chartInstruction}`
      : `You are a helper for Rancho Cordova. Context: ${context}. Answer clearly in plain text. Do NOT generate JSON. Do NOT generate Charts.`;

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

    if (isChartRequest) {
      try {
        let cleanContent = rawContent
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        const jsonMatch = cleanContent.match(/\{[\s\S]*?"type":\s*"chart"[\s\S]*?\}/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            chartData = parsed;
            finalText = parsed.explanation || "Here is the visualization you requested.";
        } else {
             // Fallback if parsing failed but we wanted a chart
             if (cleanContent.includes('{')) {
                finalText = "I found the data, but couldn't generate the visualization. Here is the summary: " + rawContent.replace(/\{[\s\S]*\}/, '');
             }
        }
      } catch (e) {
        console.warn('Chart Parse Error:', e);
        finalText = "I encountered an error visualizing the data.";
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
