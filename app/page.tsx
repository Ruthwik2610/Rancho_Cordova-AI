'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Zap, User, Bot, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// Import the new component
import ChartDisplay, { ChartData } from './components/ChartDisplay';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData;
  sources?: Array<{ source: string; score: number }>;
}

type AgentType = 'customer' | 'energy';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>('customer');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([{
      id: '0',
      role: 'assistant',
      content: agentType === 'energy' 
        ? 'Hello! I\'m your Energy Advisor. Ask me about SMUD programs, energy savings, rebates, or request data visualizations!'
        : 'Hello! I\'m your Customer Service assistant. How can I help you with city services today?'
    }]);
  }, [agentType]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    const fetchWithRetry = async (attempt = 1): Promise<any> => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, agentType })
      });

      if (res.status === 503) {
        if (attempt > 10) throw new Error("Server is busy. Please try again later.");
        setError(`Waking up AI Brain... (Attempt ${attempt}/5)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return fetchWithRetry(attempt + 1);
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      return res.json();
    };

    try {
      const data = await fetchWithRetry();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        chartData: data.chartData,
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
      setError(null);
    } catch (error: unknown) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(errorMessage);
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error. Please try again.`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Rancho Cordova AI</h1>
              <p className="text-xs text-gray-500">Your City Assistant</p>
            </div>
          </div>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setAgentType('customer')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${agentType === 'customer' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <User className="w-4 h-4 inline mr-1" /> Services
            </button>
            <button onClick={() => setAgentType('energy')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${agentType === 'energy' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Zap className="w-4 h-4 inline mr-1" /> Energy
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto px-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-blue-700">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-blue-600' : agentType === 'energy' ? 'bg-green-600' : 'bg-purple-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>

                <div className={`flex-1 max-w-3xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {/* Text Bubble */}
                  <div className={`inline-block px-6 py-4 rounded-2xl shadow-sm ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 border border-gray-200'
                    }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Chart Rendering - Uses new Component */}
                  {msg.chartData && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <ChartDisplay chartData={msg.chartData} />
                    </motion.div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.sources.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          <CheckCircle className="w-3 h-3" /> {s.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-6">
        <div className="max-w-5xl mx-auto px-4">
          <form onSubmit={sendMessage} className="relative">
            <div className="relative bg-white rounded-2xl shadow-lg border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask about energy usage..." : "Ask about city services..."}
                rows={1}
                disabled={loading}
                className="w-full px-6 py-4 pr-14 bg-transparent border-none resize-none focus:outline-none max-h-32"
                style={{ minHeight: '56px' }}
              />
              <button type="submit" disabled={loading || !input.trim()} className="absolute right-3 bottom-3 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
