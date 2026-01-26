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

// Smart detection functions
const isNumericalChartQuery = (message: string): boolean => {
  const numericalKeywords = /\b(forecast|trend|usage|consumption|cost|bill|price|rate|volume|analytics|statistics|growth|decline|increase|decrease|over time|monthly|yearly|annual)\b/i;
  const comparisonKeywords = /\b(compare|comparison|vs|versus|difference between)\b/i;
  const chartKeywords = /\b(graph|chart|plot|visualize|show me a|line chart|bar chart|pie chart)\b/i;
  
  const hasNumericalContext = numericalKeywords.test(message);
  const hasComparisonWithNumbers = comparisonKeywords.test(message) && numericalKeywords.test(message);
  const explicitChartRequest = chartKeywords.test(message);
  
  return hasNumericalContext || hasComparisonWithNumbers || explicitChartRequest;
};

const isTextBreakdownQuery = (message: string): boolean => {
  const textBreakdownKeywords = /\b(breakdown|list|departments|divisions|types|categories|names|locations|addresses|contacts|services|programs|who|what are|which)\b/i;
  const numericalKeywords = /\b(forecast|trend|usage|consumption|cost|bill|price|rate|volume|analytics)\b/i;
  
  return textBreakdownKeywords.test(message) && !numericalKeywords.test(message);
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

    // 1. GENERATE EMBEDDING
    const modelUrl = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction";
    let queryVector: number[] = [];
    
    try {
      const response = await fetch(modelUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [message],
          options: { wait_for_model: false, use_cache: true }
        }),
      });

      if (response.status === 503) {
        return NextResponse.json({ error: 'Model loading', estimated_time: 20 }, { status: 503 });
      }

      if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

      const result = await response.json();
      if (Array.isArray(result)) {
         queryVector = (Array.isArray(result[0]) ? result[0] : result) as number[];
      } else {
        throw new Error("Invalid embedding format");
      }
    } catch (error: any) {
      console.error('Embedding failed:', error);
      return NextResponse.json({ error: "Search system temporary unavailable." }, { status: 500 });
    }

    // 2. QUERY PINECONE
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true,
      filter: { agent: { $eq: agentType } }
    });

    const context = queryResponse.matches
      .filter(match => (match.score || 0) > 0.4)
      .map(doc => doc.metadata?.text).join('\n\n');

    // 3. DETERMINE QUERY TYPE
    const shouldGenerateChart = isNumericalChartQuery(message);
    const isTextList = isTextBreakdownQuery(message);

    const fallbackMessage = "I am sorry, I have access to only publicly available City of Rancho Cordova and SMUD data, and I won't be able to answer any questions outside my scope";

    // 4. BUILD APPROPRIATE SYSTEM PROMPT
    let systemPrompt = '';

    if (shouldGenerateChart && !isTextList) {
      systemPrompt = `You are a data visualization assistant for Rancho Cordova.

Context: ${context}

CRITICAL INSTRUCTIONS:

1. CHECK IF CONTEXT IS RELEVANT:
   - Does the Context contain information related to the user's question?
   - IF NO relevant information exists: Respond with exactly: "${fallbackMessage}"
   - IF YES: Proceed to Step 2.

2. EVALUATE DATA AVAILABILITY:
   - Does the Context contain ANY numerical data, rates, values, or quantitative information?
   - Can you extract or reasonably infer numbers from the Context (even if not in a table)?
   - IF YES: Generate a chart (Step 3)
   - IF NO clear numbers exist: Respond with exactly: "${fallbackMessage}"

3. GENERATE CHART JSON:
   You MUST respond with ONLY valid JSON in this exact format:

{
  "type": "chart",
  "chartType": "line" | "bar" | "pie" | "doughnut",
  "title": "Descriptive Chart Title",
  "explanation": "1-2 sentence explanation of what the chart shows and data source",
  "data": {
    "labels": ["Label1", "Label2", ...],
    "datasets": [{
      "label": "Dataset Name",
      "data": [value1, value2, ...],
      "backgroundColor": "#3B82F6" or ["#3B82F6", "#10B981", "#F59E0B", ...],
      "borderColor": "#2563EB"
    }]
  }
}

CHART TYPE SELECTION:
- "line": Trends over time or continuous data
- "bar": Comparisons between categories (e.g., Summer vs Non-Summer, Apartment vs House)
- "pie" or "doughnut": Percentage breakdowns or distribution (must total 100% or represent parts of a whole)

DATA EXTRACTION RULES:
- If exact numbers are in the Context, use them
- If rates are described (e.g., "Summer rates are 15% higher"), calculate reasonable values
- If only qualitative comparisons exist (e.g., "higher in summer"), use representative values that show the relationship
- Always base your data on what's stated in the Context - don't invent information

COLOR GUIDELINES:
- Use blue tones (#3B82F6, #2563EB) for primary data
- Use green (#10B981) for positive/energy-saving data
- Use orange (#F59E0B) for higher costs/summer data
- For pie charts, use an array: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"]

IMPORTANT:
- DO NOT include any explanatory text outside the JSON
- DO NOT use markdown code blocks around the JSON
- Ensure all JSON is valid and parseable`;

    } else if (isTextList) {
      systemPrompt = `You are a knowledgeable assistant for Rancho Cordova.

Context: ${context}

CRITICAL INSTRUCTION:
1. CHECK CONTEXT: Does the provided Context contain the information needed to answer this question?
   - IF NO: Respond with exactly: "${fallbackMessage}"
   - IF YES: Provide a well-formatted text answer.

2. FORMATTING RULES:
   - Use Markdown formatting
   - Always insert a BLANK LINE before starting a list
   - Always insert a BLANK LINE between bullet points
   - Use **bold** for important terms, names, and contact info
   - Use clear section headers if listing multiple categories
   - Be concise but informative

3. STRUCTURE:
   - Start with a brief intro sentence
   - Then provide the requested breakdown/list
   - End with any relevant additional info

DO NOT generate JSON or charts. This is a text-based query requiring a structured list.`;

    } else {
      systemPrompt = `You are a knowledgeable assistant for Rancho Cordova.

Context: ${context}

CRITICAL INSTRUCTION:
If the provided Context does not contain the information needed to answer the question, respond with exactly:
"${fallbackMessage}"

Otherwise, provide a helpful, conversational answer using Markdown formatting.

FORMATTING RULES:
- Use Markdown for structure
- Insert blank lines before lists and between bullet points
- Use **bold** for emphasis on key information (phone numbers, emails, addresses)
- Keep tone professional and helpful

DO NOT generate JSON unless explicitly asked for data visualization.`;
    }

    // 5. CALL GROQ API
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: shouldGenerateChart ? 0.2 : 0.25, // Slightly higher for more flexibility
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content || 'I could not generate a response.';

    // 6. PARSE & CLEAN RESPONSE
    let chartData = null;
    let finalText = rawContent;

    if (shouldGenerateChart && (rawContent.includes('"type": "chart"') || rawContent.includes('"type":"chart"'))) {
      try {
        let cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBrace = cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
           const jsonString = cleanContent.substring(firstBrace, lastBrace + 1);
           const parsed = JSON.parse(jsonString);
            
           if (parsed.data && parsed.chartType) {
             chartData = parsed;
             finalText = parsed.explanation || "Here is the visualization you requested.";
           }
        }
      } catch (e) {
        console.warn('Chart Parse Error:', e);
        // Fall back to text response if chart parsing fails
        finalText = rawContent;
      }
    }
    
    return NextResponse.json({
      response: finalText,
      chartData: chartData,
      sources: queryResponse.matches.slice(0, 3).map(d => ({ source: d.metadata?.source, score: d.score }))
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: "An internal system error occurred." }, { status: 500 });
  }
}
