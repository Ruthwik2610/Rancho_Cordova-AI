import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

// Clients initialized lazily to handle serverless cold starts better
const getClients = () => {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return { pinecone, groq };
};

const MODEL_NAME = 'llama3-70b-8192';
const EMBEDDING_API = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";

const PROMPTS = {
  energy: `You are the Senior Energy Efficiency Expert for Rancho Cordova.
  GOAL: Help users save money/energy using the Context Data.
  RULES:
  1. Reference specific numbers/rates from context.
  2. If calculating costs, show your math.
  3. Mention SMUD rebates and Zone 12 climate.
  4. If a chart is useful, append a JSON object at the end in this EXACT format:
  [CHART_DATA]{"type": "bar|line|pie", "title": "...", "data": [{"name": "X", "value": 10}, ...]}[/CHART_DATA]`,
  
  customer: `You are the Rancho Cordova City Services Agent.
  GOAL: Help residents navigate city resources.
  RULES:
  1. Provide phone numbers, addresses, and hours from context.
  2. Be empathetic and clear.
  3. Direct to specific departments (Public Works, etc).`
};

async function getEmbedding(text) {
  try {
    const res = await fetch(EMBEDDING_API, {
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
      method: "POST",
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    });
    const result = await res.json();
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (e) {
    console.error("Embedding Error:", e);
    return null;
  }
}

export async function POST(req) {
  try {
    const { message, agentType, history } = await req.json();
    const { pinecone, groq } = getClients();

    // 1. Vector Search
    const embedding = await getEmbedding(message);
    let context = "";
    
    if (embedding && embedding.length > 0) {
      const index = pinecone.index(process.env.PINECONE_INDEX);
      const search = await index.query({
        vector: embedding,
        topK: 4,
        includeMetadata: true,
        filter: { agent: agentType }
      });
      context = search.matches.map(m => `[Source: ${m.metadata.source}] ${m.metadata.text}`).join("\n\n");
    }

    // 2. Groq Inference
    const systemPrompt = PROMPTS[agentType];
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: `Context:\n${context}\n\nUser Question: ${message}` }
      ],
      model: MODEL_NAME,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || "";
    
    // 3. Extract Chart
    let content = rawContent;
    let chart = null;
    const chartMatch = rawContent.match(/\[CHART_DATA\]([\s\S]*?)\[\/CHART_DATA\]/);
    
    if (chartMatch) {
      try {
        chart = JSON.parse(chartMatch[1]);
        content = rawContent.replace(chartMatch[0], '').trim();
      } catch (e) { console.error("Chart Parse Error", e); }
    }

    return NextResponse.json({ role: 'assistant', content, chart });

  } catch (error) {
    console.error("API Error", error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}