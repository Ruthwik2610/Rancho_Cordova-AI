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
const NO_ANSWER_FALLBACK =
  "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope.";

// 1. SQL INTENT: Words that strongly suggest Database/Analytics
const SQL_INTENT_PATTERN = /\b(count|how many|total|average|avg|sum|trend|stats|statistics|plot|graph|chart|visualize|compare|highest|lowest|usage|kwh|consumption|breakdown|reasons)\b/i;

// 2. VECTOR OVERRIDE: Words that imply Policy/Advice, preventing SQL routing
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
      * category examples: 'Billing question', 'Outage report', 'High usage inquiry'
    
    - energy_usage (customer_id, account_type, month_date, consumption_kwh)
      * account_type: 'Residential', 'Commercial' (Case Sensitive!)
      * month_date: YYYY-MM-DD (e.g., '2024-05-01')
      * To filter by 'May', use: TO_CHAR(month_date, 'Month') LIKE '%May%'
    
    - meter_readings (account_id, reading_time, kwh)
      * High frequency data. Limit to 100 rows if selecting raw data.
    
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

  // Clean the SQL
  let query = sqlCompletion.choices[0]?.message?.content || "";
  query = query.replace(/```sql|```/gi, '').trim(); 
  query = query.replace(/;+\s*$/, ''); 

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
    return { response: `I couldn't process that query. Database says: ${(data as any).error}`, chart
