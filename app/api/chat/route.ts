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

// Exact fallback (unchanged)
const NO_ANSWER_FALLBACK =
  "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY || !HUGGINGFACE_API_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    const hfResponse = await fetch(
      'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [message],
          options: { wait_for_model: false },
        }),
      }
    );

    if (hfResponse.status === 503) {
      return NextResponse.json({ error: 'Model loading', estimated_time: 20 }, { status: 503 });
    }

    if (!hfResponse.ok) {
      throw new Error('Embedding generation failed');
    }

    const embeddingResult = await hfResponse.json();
    const queryVector: number[] = Array.isArray(embeddingResult[0])
      ? embeddingResult[0]
      : embeddingResult;

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('Invalid embedding format');
    }
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

    // MVP fallback rule: NO documents → fallback
    if (matches.length === 0) {
      return NextResponse.json({
        response: NO_ANSWER_FALLBACK,
        chartData: null,
        sources: [],
      });
    }
    const isChartRequest =
      /\b(chart|graph|plot|compare|trend|distribution|pie|bar)\b/i.test(message);

    const isNumericQuery =
      /\b(kwh|usage|average|total|month|year|rate|consumption)\b/i.test(message);

    const isDirectoryQuery =
      /\b(phone|email|contact|department|office|address)\b/i.test(message);

    let filteredMatches = matches;

    if (isNumericQuery || isChartRequest) {
      filteredMatches = matches.filter(m =>
        typeof m.metadata?.text === 'string' &&
        /\d/.test(m.metadata.text)
      );
    }

    if (isDirectoryQuery) {
      filteredMatches = matches.filter(m =>
        typeof m.metadata?.text === 'string' &&
        /@|\d{3}[-.\s]?\d{3}|suite|ave|street|st\b/i.test(m.metadata.text)
      );
    }

    const usableMatches =
      filteredMatches.length > 0 ? filteredMatches : matches;

    const context = usableMatches
      .slice(0, 4)
      .map(m => m.metadata?.text)
      .filter(Boolean)
      .join('\n');

    const chartInstruction = `
IF the answer requires numerical data:
Respond ONLY with valid JSON.

{
  "type": "chart",
  "chartType": "bar",
  "title": "Chart Title",
  "explanation": "Brief explanation",
  "data": { "labels": [...], "datasets": [...] }
}
`;

    const systemPrompt = isChartRequest
      ? `You are a Rancho Cordova assistant.
Use ONLY the provided context. The context may include tables.

Context:
${context}

${chartInstruction}`
      : `You are a Rancho Cordova assistant.
Use ONLY the provided context. The context may include tables or directory records.
If the answer is not in the context, say you cannot answer.

Context:
${context}`;
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

    const rawContent =
      completion.choices?.[0]?.message?.content ||
      NO_ANSWER_FALLBACK;
    let chartData = null;
    let finalText = rawContent;

    if (rawContent.includes('"type": "chart"') || rawContent.includes('"type":"chart"')) {
      try {
        const clean = rawContent.replace(/```json|```/g, '').trim();
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(clean.slice(start, end + 1));
          if (parsed?.type === 'chart') {
            chartData = parsed;
            finalText = parsed.explanation || '';
          }
        }
      } catch {
        // ignore parsing errors (MVP)
      }
    }
    return NextResponse.json({
      response: finalText,
      chartData,
      sources: usableMatches.slice(0, 3).map(m => ({
        source: m.metadata?.source,
        score: m.score,
      })),
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
