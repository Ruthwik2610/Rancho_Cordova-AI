'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Send, LogOut, Sparkles, AlertCircle, Paperclip, ChevronDown } from 'lucide-react';
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

  // Auth Check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) router.push('/login');
  }, [router]);

  // Initial Greeting with specific styling
  useEffect(() => {
    const initialMsg = agentType === 'energy' 
      ? "Hello. I am your Energy Advisor.\nI can analyze usage patterns, compare SMUD rates, or forecast demand."
      : "Welcome. I am your City Services Assistant.\nHow can I facilitate your interaction with Rancho Cordova today?";
    
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

    // Reset height of textarea
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const fetchWithRetry = async (attempt = 1): Promise<any> => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, agentType })
      });
      if (res.status === 503) {
        if (attempt > 5) throw new Error("System is warming up...");
        setError(`Connecting to Neural Network... (Attempt ${attempt}/5)`);
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
        content: "I apologize, but I am unable to process that request at this moment."
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

  // Auto-resize textarea
  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9FB] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. Refined Header (Glassmorphic) */}
      <header className="sticky top-0 z-30 w-full bg-[#F9F9FB]/80 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo Area - FIXED WITH MIX-BLEND-MULTIPLY */}
          <div className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-opacity cursor-default">
            <div className="relative w-44 h-12"> {/* Increased width/height slightly */}
              <Image 
                src="/static/ranchocordova.jpeg" 
                alt="Rancho Cordova" 
                fill 
                className="object-contain object-left mix-blend-multiply" 
              />
            </div>
          </div>

          {/* Center: Agent Toggle (Pill Design) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 hidden md:flex bg-slate-200/50 p-1 rounded-full items-center gap-1 shadow-inner">
            <button
              onClick={() => setAgentType('customer')}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                agentType === 'customer' 
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               {agentType === 'customer' && (
                 <motion.div layoutId="active-pill" className="absolute inset-0 bg-white rounded-full shadow-sm" transition={{ type: "spring", duration: 0.5 }} />
               )}
               <span className="relative z-10 flex items-center gap-2">
                 <div className="relative w-4 h-4 rounded-full overflow-hidden">
                   <Image src="/static/customer_service_ranchocordova.png" alt="CS" fill className="object-cover" />
                 </div>
                 Services
               </span>
            </button>
            <button
              onClick={() => setAgentType('energy')}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                agentType === 'energy' 
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {agentType === 'energy' && (
                 <motion.div layoutId="active-pill" className="absolute inset-0 bg-white rounded-full shadow-sm" transition={{ type: "spring", duration: 0.5 }} />
               )}
               <span className="relative z-10 flex items-center gap-2">
                 <div className="relative w-4 h-4 rounded-full overflow-hidden">
                   <Image src="/static/energy_agent_ranchocordova.png" alt="En" fill className="object-cover" />
                 </div>
                 Energy
               </span>
            </button>
          </div>

          {/* Right: User & Logout */}
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-xs font-bold">
                RC
             </div>
             <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Sign Out"
             >
                <LogOut className="w-5 h-5" />
             </button>
          </div>
        </div>
      </header>

      {/* 2. Main Chat Canvas */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto px-4 py-12 pb-40">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className={`group flex gap-6 mb-8 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar Column */}
                <div className="flex-shrink-0 mt-1">
                  {msg.role === 'assistant' ? (
                     <div className={`w-9 h-9 rounded-full overflow-hidden shadow-sm border ${agentType === 'energy' ? 'border-emerald-100' : 'border-blue-100'}`}>
                        <Image 
                          src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                          alt="AI" 
                          width={36} 
                          height={36}
                          className="object-cover h-full w-full"
                        />
                     </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                      <div className="w-2 h-2 bg-slate-400 rounded-full" />
                    </div>
                  )}
                </div>

                {/* Content Column */}
                <div className={`flex-1 max-w-2xl ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  
                  {/* Name Label */}
                  <div className="mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {msg.role === 'assistant' ? 'Rancho AI' : 'You'}
                  </div>

                  {/* Message Bubble */}
                  <div className={`prose prose-slate max-w-none text-[15px] leading-7 ${
                    msg.role === 'user' ? 'text-slate-800' : 'text-slate-700'
                  }`}>
                    {/* Styling the "Welcome" message differently (Serif font) */}
                    <div className={msg.id === 'init' ? 'font-serif text-lg text-slate-800' : 'whitespace-pre-wrap'}>
                       {msg.content}
                    </div>
                  </div>

                  {/* Chart Rendering */}
                  {msg.chartData && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-1 bg-white rounded-xl border border-slate-200 shadow-sm"
                    >
                      <ChartDisplay chartData={msg.chartData} />
                    </motion.div>
                  )}

                  {/* Sources */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                       {msg.sources.map((s, i) => (
                         <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md shadow-sm transition-colors hover:bg-slate-50 cursor-default">
                           <Sparkles className="w-3 h-3 text-blue-500" />
                           <span className="text-xs font-medium text-slate-600 truncate max-w-[150px]">{s.source}</span>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-6 mb-8">
               <div className="w-9 h-9 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center">
                 <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
               </div>
               <div className="flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100" />
                 <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200" />
               </div>
             </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-8">
               <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                 <AlertCircle className="w-4 h-4" />
                 {error}
               </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 3. Floating Input Area (Claude Style) */}
      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-[#F9F9FB] via-[#F9F9FB] to-transparent pb-6 pt-10 px-4 z-20">
        <div className="max-w-3xl mx-auto">
          <motion.div 
            layout 
            className={`relative bg-white rounded-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.1)] border border-slate-200 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50 transition-all duration-300 overflow-hidden ${
              loading ? 'opacity-80 grayscale' : ''
            }`}
          >
            <form onSubmit={sendMessage} className="flex flex-col">
              <textarea
                ref={inputRef}
                value={input}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask about energy forecasts, rates, or trends..." : "Ask about permits, city events, or services..."}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 px-5 py-4 focus:ring-0 resize-none max-h-48 min-h-[60px] text-[15px] leading-relaxed"
                rows={1}
                disabled={loading}
              />
              
              {/* Input Toolbar */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-2 px-2">
                   <button type="button" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                      <Paperclip className="w-4 h-4" />
                   </button>
                   <div className="h-4 w-px bg-slate-200 mx-1" />
                   <div className="text-xs text-slate-400 font-medium select-none">
                     {agentType === 'energy' ? 'Energy Agent Active' : 'Service Agent Active'}
                   </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className={`p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
                    input.trim() 
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:scale-105 active:scale-95' 
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
          
          <div className="mt-3 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              City AI can make mistakes. Please verify critical data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
