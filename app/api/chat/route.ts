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

const NO_ANSWER_FALLBACK =
  "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

const DOMAIN_KEYWORDS =
  /(rancho|cordova|smud|city|utility|power|electric|billing|department|service|permit|park|recreation|streetlight|outage|ticket|request)/i;

const PRIVACY_PATTERN =
  /\b(personal billing|billing details|payment history|full details|address|phone number|ssn|social security)\b/i;

const REFUSAL_PATTERN =
  /i cannot answer|i can'?t answer|not provided in the context|no information available/i;

const TICKET_ID_PATTERN = /\bCL0*\d+\b/i;

const extractEmbedding = (obj: any): number[] | null => {
  if (Array.isArray(obj) && obj.length > 0) {
    if (Array.isArray(obj[0]) && typeof obj[0][0] === 'number') return obj[0];
    if (typeof obj[0] === 'number') return obj;
  }
  if (obj?.embedding && Array.isArray(obj.embedding)) return obj.embedding;
  if (obj?.embeddings && Array.isArray(obj.embeddings)) return obj.embeddings[0];
  const nums = JSON.stringify(obj).match(/-?\d+\.\d+|-?\d+/g);
  if (nums) return nums.map(Number);
  return null;
};

const extractChartJson = (text: string): any | null => {
  const idx = text.indexOf('"type": "chart"') >= 0
    ? text.indexOf('"type": "chart"')
    : text.indexOf('"type":"chart"');
  if (idx === -1) return null;

  let start = text.lastIndexOf('{', idx);
  if (start === -1) start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed?.type === 'chart') return parsed;
        } catch {}
      }
    }
  }
  return null;
};

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (PRIVACY_PATTERN.test(message)) {
      return NextResponse.json({
        response: NO_ANSWER_FALLBACK,
        chartData: null,
        sources: [],
      });
    }

    if (!DOMAIN_KEYWORDS.test(message)) {
      return NextResponse.json({
        response: NO_ANSWER_FALLBACK,
        chartData: null,
        sources: [],
      });
    }

    const isTicketQuery = TICKET_ID_PATTERN.test(message);
    const isAggregateQuery =
      /\b(most|common|trend|increasing|distribution|breakdown|summary|concern)\b/i.test(message);
    const isVisualizationQuery =
      /\b(chart|graph|pie|bar|plot|visualize)\b/i.test(message);

    const hfResp = await fetch(
      'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: [message], options: { wait_for_model: false } }),
      }
    );

    if (!hfResp.ok) throw new Error('Embedding failed');

    const queryVector = extractEmbedding(await hfResp.json());
    if (!queryVector) throw new Error('Invalid embedding');

    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 6,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } },
    });

    const matches = Array.isArray(queryResponse?.matches)
      ? queryResponse.matches
      : [];

    if (matches.length === 0) {
      return NextResponse.json({
        response: NO_ANSWER_FALLBACK,
        chartData: null,
        sources: [],
      });
    }

    const context = matches
      .slice(0, 5)
      .map(m => m.metadata?.text)
      .filter(Boolean)
      .join('\n');

    const chartInstruction = `
If the user asks for a visualization, respond ONLY with JSON.

{
  "type": "chart",
  "chartType": "pie|bar|line|doughnut",
  "title": "Chart title",
  "explanation": "Brief explanation",
  "data": { "labels": [...], "datasets": [...] }
}
`;

    let systemPrompt = '';

    if (isTicketQuery) {
      systemPrompt = `
You are a Rancho Cordova assistant.
This question is about a specific service ticket.
Answer using the provided context and give the status or resolution clearly.
Do not mention unrelated records.

Context:
${context}
`;
    } else if (isAggregateQuery || isVisualizationQuery) {
      systemPrompt = `
You are a Rancho Cordova assistant.
Summarize the information by ISSUE CATEGORY only
(for example: streetlight outage, billing question, power outage).
Do NOT mention ticket numbers, customer identifiers, or individual records.
If a chart is requested, group data by category.

Context:
${context}

${isVisualizationQuery ? chartInstruction : ''}
`;
    } else {
      systemPrompt = `
You are a Rancho Cordova assistant.
Answer using the provided context.
If the answer is not present, say you cannot answer.

Context:
${context}
`;
    }

    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    let finalText = completion.choices?.[0]?.message?.content?.trim() || '';
    let chartData = null;

    if (REFUSAL_PATTERN.test(finalText) || finalText.length === 0) {
      finalText = NO_ANSWER_FALLBACK;
    } else {
      const parsedChart = extractChartJson(finalText);
      if (parsedChart && parsedChart.data) {
        chartData = parsedChart;
        finalText = parsedChart.explanation || '';
      }
    }

    return NextResponse.json({
      response: finalText,
      chartData,
      sources: matches.slice(0, 3).map(m => ({
        source: m.metadata?.source || null,
        score: m.score ?? null,
      })),
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
