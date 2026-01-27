import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

// --- CONFIGURATION ---
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for SQL logic

// --- ENVIRONMENT VARIABLES ---
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must be Service Role Key
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY!;

// --- CONSTANTS ---
const NO_ANSWER_FALLBACK =
  "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

// Regex to detect SQL vs Vector intent
const SQL_INTENT_PATTERN = /\b(count|how many|total|average|trend|stats|statistics|plot|graph|chart|visualize|compare|highest|lowest|usage|kwh|consumption)\b/i;
const TICKET_ID_PATTERN = /\bCL0*\d+\b/i;

// --- INITIALIZE CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// --- HELPER 1: Generate Embedding ---
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
    // Handle nested array response from HF
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (e) {
    console.error("Embedding Error:", e);
    return [];
  }
}

// --- HELPER 2: Extract Chart JSON ---
const extractChartJson = (text: string): any | null => {
  // Look for JSON block or raw JSON
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  
  try {
    const candidate = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(candidate);
    if (parsed.type === 'chart') return parsed;
  } catch (e) { 
    return null; 
  }
  return null;
};

// --- HANDLER A: ANALYTICS (SQL) ---
async function handleAnalyticsQuery(message: string, agentType: string) {
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Generate SQL
  const sqlSystemPrompt = `
    You are a PostgreSQL Expert.
    Current Date: ${currentDate}
    
    Table Schema:
    - tickets (call_id, customer_id, created_at, category, agent, resolution)
    - energy_usage (customer_id, account_type, month_date, consumption_kwh)
    - meter_readings (account_id, reading_time, kwh)
    
    Goal: Write a SQL query for the user's question.
    - FOR TRENDS: Use GROUP BY date_trunc('day', created_at)
    - FOR COUNTS: Use COUNT(*)
    - Return ONLY the SQL string. No markdown.
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

  console.log("Executing SQL:", query);

  // 2. Run SQL
  const { data, error } = await supabase.rpc('execute_sql', { query_text: query });

  // 3. Handle Errors (Transport or Logic)
  if (error) {
    console.error("Supabase Transport Error:", error);
    return { response: "I encountered a connection error. Please try again.", chartData: null };
  }
  
  // Check if our SQL function returned a logic error object
  if (data && !Array.isArray(data) && (data as any).error) {
    console.error("SQL Logic Error:", (data as any).error);
    return { response: `I couldn't process that query. The database reported: ${(data as any).error}`, chartData: null };
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { response: "I checked the database but found no matching records.", chartData: null };
  }

  // 4. Summarize & Chart
  const isEnergy = agentType === 'energy';
  const chartColor = isEnergy ? 'rgba(34, 197, 94, 1)' : 'rgba(59, 130, 246, 1)';
  const chartBg = isEnergy ? 'rgba(34, 197, 94, 0.5)' : 'rgba(59, 130, 246, 0.5)';

  const chartPrompt = `
    You are a Data Analyst.
    User Question: "${message}"
    Data: ${JSON.stringify(data).slice(0, 4000)}

    Task:
    1. Summarize the data briefly.
    2. If the user asked for a "trend", "chart", "plot", or "graph", append a JSON chart.
    
    JSON Format:
    \`\`\`json
    {
      "type": "chart",
      "chartType": "line" | "bar" | "pie" | "doughnut",
      "title": "Descriptive Title",
      "explanation": "Brief insight for the UI.",
      "data": { 
        "labels": ["Label1", "Label2"], 
        "datasets": [{ 
           "label": "Metric", 
           "data": [10, 20],
           "backgroundColor": "${chartBg}",
           "borderColor": "${chartColor}"
        }] 
      }
    }
    \`\`\`
  `;

  const summaryCompletion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: chartPrompt }]
  });

  const responseText = summaryCompletion.choices[0]?.message?.content || "";
  const chartData = extractChartJson(responseText);
  
  // Remove the JSON block from the text shown to the user
  const cleanText = responseText.replace(/```json[\s\S]*```/g, '').replace(/\{[\s\S]*\}/g, '').trim();

  return { response: cleanText || "Here is the data you requested.", chartData, sources: [{ source: "Database", score: 1 }] };
}

// --- HANDLER B: SEMANTIC (Vector) ---
async function handleSemanticQuery(message: string, agentType: string) {
  // 1. Embedding
  const vector = await generateEmbedding(message);
  if (!vector.length) return { response: "I'm having trouble accessing my knowledge base.", chartData: null };

  // 2. Pinecone Search
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.index(PINECONE_INDEX_NAME);
  
  // Filter by agent if needed (optional)
  // const filter = agentType === 'energy' ? { agent: { $in: ['energy', 'general'] } } : undefined;

  const searchRes = await index.query({
    vector,
    topK: 5,
    includeMetadata: true
    // filter
  });

  const matches = searchRes.matches || [];
  if (matches.length === 0) return { response: NO_ANSWER_FALLBACK, chartData: null };

  const context = matches.map(m => m.metadata?.text).join('\n---\n');

  // 3. Generate Answer
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

// --- MAIN ROUTER ---
export async function POST(req: NextRequest) {
  try {
    const { message, agentType = 'customer' } = await req.json();

    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // Router Logic
    const isTicketLookup = TICKET_ID_PATTERN.test(message);
    const isAnalytics = SQL_INTENT_PATTERN.test(message);

    let result;
    if (isAnalytics || isTicketLookup) {
      console.log(`Routing to SQL: ${message}`);
      result = await handleAnalyticsQuery(message, agentType);
    } else {
      console.log(`Routing to Vector: ${message}`);
      result = await handleSemanticQuery(message, agentType);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
