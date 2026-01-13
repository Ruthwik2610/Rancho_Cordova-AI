'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Send, LogOut, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>('customer');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) router.push('/login');
  }, [router]);

  useEffect(() => {
    const initialMsg = agentType === 'energy' 
      ? "Hello! I'm your Energy Advisor. I can visualize usage trends, compare rates, or analyze forecast data for you."
      : "Welcome! I'm your City Services Assistant. How can I help you with permits, events, or general city inquiries today?";
    
    setMessages([{
      id: 'init',
      role: 'assistant',
      content: initialMsg
    }]);
  }, [agentType]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom() }, [messages]);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
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
        if (attempt > 5) throw new Error("Server warming up...");
        setError(`Initializing AI Model... (Attempt ${attempt}/5)`);
        await new Promise(r => setTimeout(r, 4000));
        return fetchWithRetry(attempt + 1);
      }
      if (!res.ok) throw new Error((await res.json()).error || "Server Error");
      return res.json();
    };

    try {
      const data = await fetchWithRetry();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        chartData: data.chartData,
        sources: data.sources
      }]);
      setError(null);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-50 z-0">
        <Image 
          src="/static/reactanglehalf.png" 
          alt="bg" 
          width={800} 
          height={800} 
          className="absolute top-[-300px] right-[-200px] rotate-12 blur-3xl opacity-20"
        />
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-32 h-12">
              <Image 
                src="/static/ranchocordova.jpeg" 
                alt="Logo" 
                fill 
                className="object-contain" 
              />
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-800">AI Assistant</h1>
              <p className="text-xs text-slate-500">Official City Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Agent Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
              <button 
                onClick={() => setAgentType('customer')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  agentType === 'customer' 
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                   <Image src="/static/customer_service_ranchocordova.png" alt="CS" fill className="object-cover" />
                </div>
                <span className="hidden sm:inline">Services</span>
              </button>
              <button 
                onClick={() => setAgentType('energy')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  agentType === 'energy' 
                    ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="relative w-5 h-5 rounded-full overflow-hidden">
                   <Image src="/static/energy_agent_ranchocordova.png" alt="Energy" fill className="object-cover" />
                </div>
                <span className="hidden sm:inline">Energy</span>
              </button>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto z-0 p-4 pb-32 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Agent Avatar */}
                {msg.role === 'assistant' && (
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 overflow-hidden bg-white shadow-sm mt-1 ${
                    agentType === 'energy' ? 'border-emerald-100' : 'border-blue-100'
                  }`}>
                    <Image 
                      src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                      alt="Agent" 
                      width={40} 
                      height={40}
                      className="object-cover p-1"
                    />
                  </div>
                )}

                <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-6 py-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>

                  {msg.chartData && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full mt-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm"
                    >
                      <ChartDisplay chartData={msg.chartData} />
                    </motion.div>
                  )}

                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 px-1">
                      {msg.sources.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/50 border border-slate-200 text-slate-500 text-xs rounded-full shadow-sm">
                          <Sparkles className="w-3 h-3 text-blue-400" /> 
                          {s.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm mt-1">
                    <span className="text-blue-600 font-bold text-xs">YOU</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="bg-white px-6 py-4 rounded-2xl rounded-bl-none shadow-sm border border-slate-100 flex gap-2 items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
              </div>
            </motion.div>
          )}
          
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center my-4">
              <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-sm flex items-center gap-2 border border-amber-100 shadow-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Footer */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-10 pb-6 px-4 z-20">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={sendMessage} className="relative group">
            <div className="absolute inset-0 bg-blue-100 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask to visualize energy forecasts, compare rates..." : "Ask about permits, city council meetings..."}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 px-5 py-4 focus:ring-0 resize-none max-h-32 min-h-[60px]"
                rows={1}
                disabled={loading}
              />
              <div className="p-2">
                <button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center justify-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-3">
              AI can make mistakes. Please verify important information with City Hall.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}