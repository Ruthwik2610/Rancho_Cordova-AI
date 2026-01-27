import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';

// --- VERCEL CONFIGURATION ---
export const maxDuration = 60; // Allow 60 seconds for complex SQL reasoning
export const dynamic = 'force-dynamic'; // Prevent static caching

// 1. Initialize Clients using Vercel Environment Variables
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST use Service Role Key for SQL execution
);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME!);

// 2. Initialize LLM
// (Using OpenAI SDK, which works with Groq, OpenAI, Perplexity, etc.)
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
    // Handle HuggingFace API response variations (nested arrays vs flat)
    return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return [];
  }
}

// --- MAIN API ROUTE ---
export async function POST(req: Request) {
  try {
    const { messages, agentType = 'customer' } = await req.json();
    const currentDate = new Date().toISOString().split('T')[0];

    // --- SYSTEM PROMPT ---
    const systemPrompt = `
      You are the AI Assistant for the City of Rancho Cordova and SMUD.
      Current Date: ${currentDate}

      **YOUR GOAL**:
      Answer the user's question using the provided tools. 
      
      **STRICT FALLBACK RULE**:
      If the user asks a question that is NOT related to Rancho Cordova, City Services, SMUD, Energy, or the provided data, OR if your tools return no relevant information, you MUST respond EXACTLY with:
      "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope."

      **TOOL USAGE GUIDELINES**:
      
      1. USE 'query_database' (SQL) for:
         - **Diagnostic**: Specific lookups (e.g., "status of ticket CL0019", "usage for account 1001").
         - **Prescriptive/Predictive**: Trends, aggregations (e.g., "average usage", "most common complaints").
         - **Visualization**: ANY request for a chart, graph, plot, or trend.
         
         *Database Schema*:
         - "tickets": columns(call_id, customer_id, created_at, category, agent, resolution)
         - "energy_usage": columns(customer_id, account_type, month_date, consumption_kwh)
         - "meter_readings": columns(account_id, reading_time, kwh) (Limit to 100 rows unless aggregating)

      2. USE 'search_documents' (Vector Search) for:
         - **Descriptive**: General info (e.g., "Who is the manager?", "Where is the office?", "Rebate details").
         - **Prescriptive**: Processes (e.g., "How to start service?", "When to run dishwasher").
         
      **CHART GENERATION RULES**:
      - Triggers: If the user asks to "show", "plot", "graph", "visualize", "compare" (visually), or asks for a "trend".
      - Action: Return a standard text explanation AND a JSON block in this EXACT format at the end:
        \`\`\`json
        {
          "type": "chart",
          "chartType": "line" | "bar" | "pie",
          "title": "Descriptive Title",
          "data": { 
            "labels": ["Label1", "Label2"], 
            "datasets": [{ "label": "Series Name", "data": [10, 20] }] 
          }
        }
        \`\`\`
    `;

    // --- STREAMING LOGIC ---
    const result = streamText({
      model: groq('llama-3.3-70b-versatile'), // Or 'gpt-4o' if using OpenAI
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      maxSteps: 4, // Allow AI to retry SQL if it fails initially
      
      tools: {
        // --- TOOL 1: SQL DATABASE (Hard Data & Trends) ---
        query_database: tool({
          description: 'Executes a SQL query for specific records, counts, trends, or energy stats.',
          parameters: z.object({
            query: z.string().describe(`
              Valid PostgreSQL query. 
              - For tickets: SELECT * FROM tickets WHERE call_id = '...'
              - For trends: GROUP BY date_trunc('day', created_at)
              - For energy: SELECT SUM(consumption_kwh) FROM energy_usage...
            `),
            explanation: z.string().describe('Briefly explain what you are checking.'),
          }),
          execute: async ({ query }) => {
            console.log(`[SQL Tool] ${query}`);
            
            // Execute using the RPC function we created in Supabase
            const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
            
            if (error) return `SQL Error: ${error.message}. Try correcting the table/column names.`;
            if (!data || data.length === 0) return "No records found in the database.";
            
            return JSON.stringify(data);
          },
        }),

        // --- TOOL 2: KNOWLEDGE BASE (Text & Policies) ---
        search_documents: tool({
          description: 'Searches for policies, office locations, managers, rebates, and general guides.',
          parameters: z.object({
            query: z.string().describe('The semantic search terms.'),
          }),
          execute: async ({ query }) => {
            console.log(`[Vector Tool] ${query}`);
            const vector = await generateEmbedding(query);
            if (!vector.length) return "Error: Could not generate embedding.";

            const searchRes = await pineconeIndex.query({
              vector: vector,
              topK: 5,
              includeMetadata: true,
              // Optional: Filter based on agent type if your metadata has 'agent' field
              // filter: { agent: agentType === 'energy' ? 'energy' : 'customer' } 
            });

            if (!searchRes.matches.length) return "No relevant documents found.";

            // Return the text chunks to the LLM
            return searchRes.matches
              .map(m => `[Source: ${m.metadata?.source}] ${m.metadata?.text}`)
              .join('\n\n');
          },
        }),
      },
    });

    return result.toDataStreamResponse();

  } catch (error: any) {
    console.error("Route Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
