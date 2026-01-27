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
  /(rancho|cordova|smud|city|utility|power|electric|billing|department|service|permit|park|recreation|streetlight|outage)/i;

const PRIVACY_PATTERN =
  /\b(personal billing|billing details|payment history|full details|address|phone number|ssn|social security)\b/i;

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

    if (hfResp.status === 503) {
      return NextResponse.json({ error: 'Model loading', estimated_time: 20 }, { status: 503 });
    }

    if (!hfResp.ok) throw new Error('Embedding generation failed');

    const hfJson = await hfResp.json();

    function extractEmbedding(obj: any) {
      if (Array.isArray(obj) && obj.length > 0) {
        if (Array.isArray(obj[0]) && typeof obj[0][0] === 'number') return obj[0];
        if (typeof obj[0] === 'number') return obj;
      }
      if (obj?.embedding && Array.isArray(obj.embedding)) return obj.embedding;
      if (obj?.embeddings && Array.isArray(obj.embeddings)) return obj.embeddings[0];
      const nums = JSON.stringify(obj).match(/-?\d+\.\d+|-?\d+/g);
      if (nums) return nums.map(Number);
      return null;
    }

    const queryVector = extractEmbedding(hfJson);
    if (!Array.isArray(queryVector) || queryVector.length === 0) throw new Error('Invalid embedding format');

    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 6,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } },
    });

    const matches = Array.isArray(queryResponse?.matches) ? queryResponse.matches : [];
    if (matches.length === 0) {
      return NextResponse.json({ response: NO_ANSWER_FALLBACK, chartData: null, sources: [] });
    }

    const isChartRequest = /\b(chart|graph|plot|compare|trend|distribution|pie|bar)\b/i.test(message);
    const isNumericQuery = /\b(kwh|usage|average|total|month|year|rate|consumption)\b/i.test(message);
    const isDirectoryQuery = /\b(phone|email|contact|department|office|address)\b/i.test(message);

    let filteredMatches = matches;
    if (isNumericQuery || isChartRequest) {
      filteredMatches = matches.filter(m => typeof m.metadata?.text === 'string' && /\d/.test(m.metadata.text));
    }
    if (isDirectoryQuery) {
      filteredMatches = matches.filter(m => typeof m.metadata?.text === 'string' && /@|\d{3}[-.\s]?\d{3}|suite|ave|street|st\b/i.test(m.metadata.text));
    }
    const usableMatches = filteredMatches.length > 0 ? filteredMatches : matches;

    const context = usableMatches.slice(0, 4).map(m => m.metadata?.text).filter(Boolean).join('\n');
    const MAX_CONTEXT_CHARS = 3000;
    const finalContext = context.length > MAX_CONTEXT_CHARS ? context.slice(0, MAX_CONTEXT_CHARS) + '\n[TRUNCATED]' : context;

    const chartInstruction = `IF numerical data is involved respond ONLY with the specified JSON format.

{
  "type":"chart",
  "chartType":"line|bar|pie|doughnut",
  "title":"Chart Title",
  "explanation":"Brief explanation",
  "data":{"labels":[...],"datasets":[...]}
}`;

    const systemPrompt = isChartRequest
      ? `You are a Rancho Cordova assistant. Use ONLY the provided context. Do not include signatures, system names, or assistant names. Do not mention or expose ticket numbers, call IDs, customer IDs, or internal record IDs. Summarize trends by category not by record. Context:\n${finalContext}\n\n${chartInstruction}`
      : `You are a Rancho Cordova assistant. Use ONLY the provided context. Do not include signatures, system names, or assistant names. Do not mention or expose ticket numbers, call IDs, customer IDs, or internal record IDs. When describing trends, summarize by category not by individual records. If the answer is not in the context say you cannot answer. Context:\n${finalContext}`;

    const groq = new Groq({ apiKey: GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
    });

    const rawContent = completion.choices?.[0]?.message?.content || '';
    function extractChartJson(text: string) {
      const idx = text.indexOf('"type": "chart"') >= 0 ? text.indexOf('"type": "chart"') : text.indexOf('"type":"chart"');
      if (idx === -1) return null;
      let start = text.lastIndexOf('{', idx);
      if (start === -1) start = text.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = text.substring(start, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && parsed.type === 'chart') return parsed;
            } catch {}
            break;
          }
        }
      }
      const re = /\{[^]*?"type"\s*:\s*"chart"[^]*?\}/;
      const m = text.match(re);
      if (m) {
        try { return JSON.parse(m[0]); } catch {}
      }
      return null;
    }

    const refusalPattern = /i cannot answer|i can'?t answer|no information available|not provided in the context|i do not have that information/i;
    let finalText = rawContent.trim();
    let chartData = null;

    if (refusalPattern.test(finalText) || finalText.length === 0) {
      finalText = NO_ANSWER_FALLBACK;
    } else {
      const parsedChart = extractChartJson(rawContent);
      if (parsedChart && parsedChart.data && parsedChart.chartType) {
        const allowed = new Set(['line', 'bar', 'pie', 'doughnut']);
        if (allowed.has(parsedChart.chartType)) {
          chartData = parsedChart;
          finalText = parsedChart.explanation || finalText;
        }
      }
      const ticketIdPattern = /\bCL0*\d{1,6}\b|\bRC0*\d{1,6}\b/gi;
      if (ticketIdPattern.test(finalText)) {
        finalText = finalText.replace(ticketIdPattern, '[REDACTED]');
      }
    }

    return NextResponse.json({
      response: finalText,
      chartData,
      sources: usableMatches.slice(0, 3).map(m => ({ source: m.metadata?.source || null, score: typeof m.score === 'number' ? m.score : null })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
