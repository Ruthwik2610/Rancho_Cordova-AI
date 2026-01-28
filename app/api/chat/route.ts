import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

// --- CONFIGURATION ---
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// --- ENVIRONMENT VARIABLES ---
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY!;

// --- CONSTANTS ---
const NO_ANSWER_FALLBACK = "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

// 1. SQL INTENT
const SQL_INTENT_PATTERN = /\b(count|how many|total|average|avg|sum|trend|stats|statistics|plot|graph|chart|visualize|compare|highest|lowest|usage|kwh|consumption|breakdown|reasons)\b/i;

// 2. VECTOR OVERRIDE
const VECTOR_OVERRIDE_PATTERN = /\b(rebate|incentive|program|dishwasher|washing|dryer|appliance|how to|ways to|reduce|save|contact|manager|location|address|phone|email|process|steps|apply|permit)\b/i;

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
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (e) {
    console.error("Embedding Error:", e);
    return [];
  }
}

// --- HELPER 2: Extract Chart JSON ---
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

// --- HANDLER A: ANALYTICS (SQL) ---
async function handleAnalyticsQuery(message: string, agentType: string) {
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Generate SQL
  const sqlSystemPrompt = `
    You are a PostgreSQL Expert.
    Current Date: ${currentDate} (Data is mostly 2024-2025)
    
    Table Schema:
    - tickets (call_id, customer_id, created_at, category, agent, resolution)
    - energy_usage (customer_id, account_type, month_date, consumption_kwh)
      * account_type: 'Residential', 'Commercial' (Case Sensitive!)
      * month_date: YYYY-MM-DD
    - meter_readings (account_id, reading_time, kwh)
    
    Goal: Write a SQL query for the user's question.
    Rules:
    - FOR TRENDS: Use GROUP BY date_trunc('day', created_at) OR month_date.
    - FOR PIE CHARTS: Use GROUP BY category (tickets) or account_type (energy).
    - FOR AVERAGES: Use AVG(consumption_kwh).
    - DO NOT use a semicolon (;) at the end.
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

  let query = sqlCompletion.choices[0]?.message?.content || "";
  query = query.replace(/```sql|```/gi, '').trim().replace(/;+\s*$/, ''); 

  if (!query) throw new Error("Failed to generate SQL");
  console.log("Executing SQL:", query);

  // 2. Run SQL
  const { data, error } = await supabase.rpc('execute_sql', { query_text: query });

  if (error) {
    console.error("Supabase Error:", error);
    return { response: "I encountered a technical error connecting to the database.", chartData: null };
  }
  
  if (data && !Array.isArray(data) && (data as any).error) {
    console.error("SQL Logic Error:", (data as any).error);
    return { 
      response: `I couldn't process that query. Database says: ${(data as any).error}`, 
      chartData: null 
    };
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { response: "I checked the database but found no records matching your criteria.", chartData: null };
  }

  // 3. Summarize & Chart
  // UPDATED PROMPT: STRICTER RULES ON CHART GENERATION
  const chartPrompt = `
    You are a Data Analyst.
    User Question: "${message}"
    Data: ${JSON.stringify(data).slice(0, 4000)}

    Task:
    1. Analyze the data.
    2. Decide if a chart is necessary:
       - **SINGLE NUMBER (Count/Sum/Avg):** NO CHART. Output text only.
       - **LIST/TREND (Multiple rows):** YES CHART. Generate JSON.
    3. Generate the response text.
    
    CRITICAL TEXT RULES:
    - State the actual numbers from the data (e.g., "There were 53 tickets.").
    - Do NOT be vague (e.g., "Ticket volume was low"). Be specific.
    - Do NOT say "Here is the chart".
    
    OUTPUT FORMAT:
    If NO Chart: Just return the text.
    If YES Chart: Return text followed by the JSON block.
    
    JSON Format (Only if needed):
    \`\`\`json
    {
      "type": "chart",
      "chartType": "line" | "bar" | "pie" | "doughnut",
      "title": "Specific Title",
      "explanation": "Brief insight (max 10 words).",
      "data": { 
        "labels": ["Label1", "Label2"], 
        "datasets": [{ "label": "Metric", "data": [10, 20] }] 
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
  
  // Clean text
  let cleanText = responseText
    .replace(/```json[\s\S]*```/g, '') // Remove JSON block
    .replace(/\{[\s\S]*\}/g, '') // Remove raw JSON objects
    .replace(/(Here is|I have generated|This is) (a|the) (JSON)?\s*(chart|graph|visualization|response).*?:?/i, '')
    .replace(/[*#]*\s*JSON Chart\s*[*#]*:?/i, '')
    .replace(/[*#]*\s*Data Insight\s*[*#]*:?/i, '')
    .trim();
  
  if (!cleanText && chartData) cleanText = "I have visualized the data for you above.";

  return { response: cleanText, chartData, sources: [{ source: "Live Database", score: 1 }] };
}

// --- HANDLER B: SEMANTIC (Vector) ---
async function handleSemanticQuery(message: string, agentType: string) {
  
  // 1. QUERY EXPANSION
  let searchTerms = message;
  if (agentType === 'energy') {
    searchTerms += " SMUD Time-of-Day rates peak off-peak electricity cost rebates incentive";
  } else if (agentType === 'customer') {
    searchTerms += " city department contact phone location service request process";
  }

  // 2. Generate Embedding
  const vector = await generateEmbedding(searchTerms);
  if (!vector.length) return { response: "I'm having trouble accessing my knowledge base.", chartData: null };

  // 3. Pinecone Search
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.index(PINECONE_INDEX_NAME);
  
  const searchRes = await index.query({
    vector,
    topK: 15,
    includeMetadata: true,
    filter: { agent: agentType } 
  });

  const matches = searchRes.matches || [];
  if (matches.length === 0) return { response: NO_ANSWER_FALLBACK, chartData: null };

  const context = matches.map(m => m.metadata?.text).join('\n---\n');

  // 4. Generate Answer
  const systemPrompt = `
    You are the ${agentType === 'energy' ? 'Energy Advisor' : 'City Services Agent'}.
    
    You have access to the following reference data (Context):
    ${context}

    YOUR GOAL:
    Answer the user's question using ONLY the provided context.
    
    CRITICAL INSTRUCTIONS:
    1. **Inference Permitted:** If the user asks about "best times" for appliances, use "Time-of-Day" rate data. 
       - "Off-Peak" (Low Rate) = Best Time.
    2. **Missing Info:** If context is missing, say: "${NO_ANSWER_FALLBACK}"
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

    const isTicketLookup = TICKET_ID_PATTERN.test(message);
    const isAnalytics = SQL_INTENT_PATTERN.test(message);
    const isVectorOverride = VECTOR_OVERRIDE_PATTERN.test(message);

    let result;
    
    if (isTicketLookup || (isAnalytics && !isVectorOverride)) {
      console.log(`[Router] SQL Path for: "${message}"`);
      result = await handleAnalyticsQuery(message, agentType);
    } else {
      console.log(`[Router] Vector Path for: "${message}"`);
      result = await handleSemanticQuery(message, agentType);
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
