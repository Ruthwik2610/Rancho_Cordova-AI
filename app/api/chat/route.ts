import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import Groq from 'groq-sdk';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rancho-cordova';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Helper function to retry the API call
async function getEmbeddingWithRetry(text: string, retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          },
          body: JSON.stringify({
            inputs: text,
            options: { wait_for_model: true, use_cache: false }
          }),
        }
      );

      // If successful, return data
      if (response.ok) {
        return await response.json();
      }

      // If model is loading (503), wait and retry
      if (response.status === 503) {
        const error = await response.json();
        const waitTime = error.estimated_time || delay / 1000;
        console.log(`Model loading, waiting ${waitTime}s... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        continue;
      }

      // If other error, throw
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);

    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!PINECONE_API_KEY || !GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing API keys' },
        { status: 500 }
      );
    }

    const { message, agentType = 'customer' } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Initialize Pinecone
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX_NAME);

    // 1. GENERATE EMBEDDING (With Retry Logic)
    let queryVector: number[];
    try {
      queryVector = await getEmbeddingWithRetry(message);
    } catch (embError) {
      console.error('Final Embedding Error:', embError);
      return NextResponse.json(
        { error: 'System is warming up. Please try again in 1
