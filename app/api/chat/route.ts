import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';

// --- CONFIGURATION ---
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// 1. Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2. Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME!);

// 3. Initialize LLM
const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

// --- HELPER: Generate Embedding ---
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: [text], options: { wait_for_model: true } }),
      }
    );

    if (!response.ok) throw new Error(`HF API Error: ${response.statusText}`);
    const result = await response.json();
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return [];
  }
}

// --- MAIN API HANDLER ---
export async function POST(req: Request) {
  try {
    const { messages, agentType = 'customer' } = await req.json();
    const currentDate = new Date().toISOString().split('T')[0];

    // --- DYNAMIC THEME CONFIGURATION ---
    const isEnergyAgent = agentType === 'energy';
    const agentName = isEnergyAgent ? 'Energy Advisor' : 'City Services Agent';
    
    // Theme colors for Chart.js (Tailwind colors: Green-500 vs Blue-500)
    const chartColor = isEnergyAgent ? 'rgba(34, 197, 94, 1)' : 'rgba(59, 130, 246, 1)';
    const chartBg = isEnergyAgent ? 'rgba(34, 197, 94, 0.5)' : 'rgba(59, 130, 246, 0.5)';

    // --- SYSTEM PROMPT ---
    const systemPrompt = `
      You are the **${agentName}** for Rancho Cordova.
      Current Date: ${currentDate}

      **YOUR GOAL**:
      Answer the user's question accurately using the provided tools.
      
      **STRICT FALLBACK RULE**:
      If the user asks a question unrelated to Rancho Cordova, City Services, SMUD, Energy, or your datasets, respond EXACTLY with:
      "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope."

      **TOOL GUIDELINES**:
      
      1. **query_database (SQL)** - Use for HARD DATA:
         - Diagnostic: "Status of ticket CL0019", "Usage for account 1001".
         - Trends: "How many calls last week?", "Average energy usage in May".
         - Visualization: ANY request for charts, graphs, or visual trends.
         
         *Schema Reference*:
         - "tickets" (call_id, customer_id, created_at, category, agent, resolution)
         - "energy_usage" (customer_id, account_type, month_date, consumption_kwh)
         - "meter_readings" (account_id, reading_time, kwh) -> LIMIT queries to 100 rows unless aggregating!

      2. **search_documents (Vector)** - Use for KNOWLEDGE:
         - Policies: "How to apply for a permit?", "Rebate requirements".
         - General Info: "Who is the city manager?", "Office location".

      **CHART GENERATION**:
      If the user wants to "see", "show", "plot", or "graph" data:
      1. Call 'query_database' to get the numbers.
      2. In your final text response, include a JSON block EXACTLY like this:
      
      \`\`\`json
      {
        "type": "chart",
        "chartType": "line" | "bar" | "pie" | "doughnut",
        "title": "Clear Descriptive Title",
        "explanation": "One sentence insight about the data (e.g., 'Usage peaked on Tuesday.').",
        "data": { 
          "labels": ["Jan", "Feb", "Mar"], 
          "datasets": [{ 
            "label": "Metric Name", 
            "data": [10, 25, 15],
            "backgroundColor": "${chartBg}", 
            "borderColor": "${chartColor}"
          }] 
        }
      }
      \`\`\`
    `;

    // --- STREAMING LOGIC ---
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      maxSteps: 5, 
      
      tools: {
        // --- TOOL 1: SQL DATABASE ---
        query_database: tool({
          description: 'Executes SQL for trends, stats, or specific records.',
          parameters: z.object({
            query: z.string().describe(`
              PostgreSQL query. 
              - Trends: GROUP BY date_trunc('day', created_at)
              - Aggregations: SUM(consumption_kwh), COUNT(call_id)
              - Lookups: WHERE call_id = '...'
            `),
            explanation: z.string().describe('Explanation of the query logic.'),
          }),
          execute: async ({ query }) => {
            console.log(`[SQL] ${query}`);
            const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
            
            if (error) return `SQL Error: ${error.message}. Check schema and retry.`;
            if (!data || data.length === 0) return "Database returned no records.";
            
            return JSON.stringify(data);
          },
        }),

        // --- TOOL 2: KNOWLEDGE BASE ---
        search_documents: tool({
          description: 'Searches policies, rules, and general info.',
          parameters: z.object({
            query: z.string().describe('Semantic search query.'),
          }),
          execute: async ({ query }) => {
            console.log(`[Vector] ${query}`);
            const vector = await generateEmbedding(query);
            if (!vector.length) return "Error generating embedding.";

            // Filter context based on the active agent (optional optimization)
            // If your Pinecone metadata has an 'agent' field, this improves accuracy.
            const filter = isEnergyAgent 
              ? { agent: { '$in': ['energy', 'general'] } } 
              : { agent: { '$in': ['customer', 'general'] } };

            // Note: If you haven't tagged metadata with 'agent', remove the 'filter' property below.
            const searchRes = await pineconeIndex.query({
              vector: vector,
              topK: 5,
              includeMetadata: true,
              // filter: filter // Uncomment this if you have agent tags in Pinecone
            });

            if (!searchRes.matches.length) return "No relevant documents found.";

            return searchRes.matches
              .map(m => `[Source: ${m.metadata?.source}] ${m.metadata?.text}`)
              .join('\n\n');
          },
        }),
      },
    });

    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
