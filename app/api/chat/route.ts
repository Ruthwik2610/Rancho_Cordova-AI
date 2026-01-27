import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

// --- CONFIGURATION ---
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow time for SQL generation

// --- ENVIRONMENT VARIABLES ---
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must be Service Role Key
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY!;

// --- CONSTANTS & REGEX ---
const NO_ANSWER_FALLBACK =
  "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

// Regex to route to SQL (Analytics) vs Vector (Text)
const SQL_INTENT_PATTERN = /\b(count|how many|total|average|trend|stats|statistics|plot|graph|chart|visualize|compare|highest|lowest|usage|kwh|consumption)\b/i;
const TICKET_ID_PATTERN = /\bCL0*\d+\b/i;

// --- INITIALIZE CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- HELPER FUNCTIONS ---

// 1. Generate Embedding (HuggingFace)
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: [text], options: { wait_for_model: true } }),
      }
    );
    if (!response.ok) return [];
    const result = await response.json();
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (e) {
    console.error("Embedding Error:", e);
    return [];
  }
}

// 2. Extract JSON for Chart (Parses LLM output for the frontend)
const extractChartJson = (text: string): any | null => {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const candidate = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(candidate);
    if (parsed.type === 'chart') return parsed;
  } catch (e) { return null; }
  return null;
};

// --- HANDLERS ---

// A. Handle SQL/Analytics Questions
async function handleAnalyticsQuery(message: string, agentType: string) {
  const currentDate = new Date().toISOString().split('T')[0];

  // Step 1: Generate SQL
  const sqlSystemPrompt = `
    You are a PostgreSQL Expert.
    Current Date: ${currentDate}
    
    Table Schema:
    - tickets (call_id, customer_id, created_at, category, agent, resolution)
    - energy_usage (customer_id, account_type, month_date, consumption_kwh)
    - meter_readings (account_id, reading_time, kwh)
    
    Goal: Write a SQL query to answer the user's question.
    - If asking for trends, use GROUP BY date_trunc('day', created_at).
    - If asking for energy stats, query 'energy_usage'.
    - Return ONLY the SQL string. No markdown, no explanation.
  `;

  const sqlCompletion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: sqlSystemPrompt },
      { role: 'user', content: message }
    ],
    temperature: 0
  });

  const query = sqlCompletion.choices[0]?.message?.content?.replace(/```sql|```/g, '').trim();

  if (!query) throw new Error("Failed to generate SQL");

  // Step 2: Run SQL on Supabase
  const { data, error } = await supabase.rpc('execute_sql', { query_text: query });

  if (error) {
    console.error("SQL Error:", error);
    return { response: "I couldn't analyze the data due to a query error.", chartData: null };
  }

  if (!data || data.length === 0) {
    return { response: "I checked the database, but found no records matching your request.", chartData: null };
  }

  // Step 3: Interpret Data & Generate Chart JSON
  const chartPrompt = `
    You are a Data Analyst.
    User Question: "${message}"
    Data Retrieved: ${JSON.stringify(data).slice(0, 3000)} -- (Truncated if too long)

    Task:
    1. Summarize the findings briefly.
    2. If the user asked to visualize/plot/show trend, generate a JSON chart.
    
    Response Format:
    Return a text summary. IF a chart is needed, append this JSON block at the end:
    \`\`\`json
    {
      "type": "chart",
      "chartType": "line" | "bar" | "pie",
      "title": "Chart Title",
      "explanation": "Brief insight for the UI.",
      "data": { "labels": [...], "datasets": [{ "label": "...", "data": [...] }] }
    }
    \`\`\`
  `;

  const summaryCompletion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: chartPrompt }]
  });

  const responseText = summaryCompletion.choices[0]?.message?.content || "";
  const chartData = extractChartJson(responseText);

  // Clean raw JSON from text to avoid duplication in UI
  const cleanText = responseText.replace(/```json[\s\S]*```/g, '').trim();

  return { response: cleanText, chartData, sources: [{ source: "Live Database", score: 1.0 }] };
}

// B. Handle Text/Vector Questions
async function handleSemanticQuery(message: string, agentType: string) {
  // Step 1: Search Pinecone
  const vector = await generateEmbedding(message);
  if (!vector.length) throw new Error("Embedding failed");

  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.index(PINECONE_INDEX_NAME);

  // Optional: Filter by agent type if your metadata supports it
  // const filter = agentType === 'energy' ? { agent: { '$in': ['energy', 'general'] } } : undefined;

  const searchRes = await index.query({
    vector,
    topK: 5,
    includeMetadata: true,
    // filter
  });

  const matches = searchRes.matches || [];
  if (matches.length === 0) return { response: NO_ANSWER_FALLBACK, chartData: null };

  const context = matches.map(m => m.metadata?.text).join('\n---\n');

  // Step 2: Generate Answer
  const systemPrompt = `
    You are the ${agentType === 'energy' ? 'Energy Advisor' : 'City Services Agent'}.
    Answer based strictly on the context below.
    If the info is missing, say: "${NO_ANSWER_FALLBACK}"

    Context:
    ${context}
  `;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]
  });

  return { 
    response: completion.choices[0]?.message?.content || NO_ANSWER_FALLBACK,
    chartData: null,
    sources: matches.slice(0, 3).map(m => ({ source: m.metadata?.source || "Doc", score: m.score }))
  };
}

// --- MAIN API ROUTE ---
export async function POST(req: NextRequest) {
  try {
    const { message, agentType = 'customer' } = await req.json();

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // --- ROUTER LOGIC ---
    // 1. Check for specific ticket IDs (Force SQL lookup)
    const isTicketLookup = TICKET_ID_PATTERN.test(message);
    
    // 2. Check for Analytics keywords (Force SQL Trends)
    const isAnalytics = SQL_INTENT_PATTERN.test(message);

    let result;

    if (isAnalytics || isTicketLookup) {
      console.log(`[Router] SQL Path for: "${message}"`);
      result = await handleAnalyticsQuery(message, agentType);
    } else {
      console.log(`[Router] Vector Path for: "${message}"`);
      result = await handleSemanticQuery(message, agentType);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ 
      response: "System encountered an error. Please try again.",
      error: error.message 
    }, { status: 500 });
  }
}
