'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Send, LogOut, Paperclip, Menu, Plus, 
  X, User as UserIcon, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChartDisplay, { ChartData } from './components/ChartDisplay';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData;
  sources?: Array<{ source: string; score: number }>;
}

type AgentType = 'customer' | 'energy';

// --- Mock History ---
const MOCK_HISTORY = [
  { label: 'Today', items: ['Solar Panel Rebates', 'Permit Application Status'] },
  { label: 'Yesterday', items: ['Garbage Collection Schedule', 'SMUD Rate Comparison'] },
  { label: 'Previous 7 Days', items: ['City Council Meeting', 'EV Charger Locations', 'Water Heater Repair'] },
];

export default function Home() {
  const router = useRouter();
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentType, setAgentType] = useState<AgentType>('customer');
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 1. Auth Check
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) router.push('/login');
  }, [router]);

  // 2. Initial Greeting (Resets whenever chat is cleared or agent changes)
  useEffect(() => {
    if (messages.length === 0) {
      const initialMsg = agentType === 'energy' 
        ? "Hello. I am your Energy Advisor.\nI can analyze usage patterns, compare SMUD rates, or forecast demand."
        : "Welcome. I am your City Services Assistant.\nHow can I facilitate your interaction with Rancho Cordova today?";
      
      setMessages([{
        id: 'init',
        role: 'assistant',
        content: initialMsg
      }]);
    }
  }, [agentType, messages.length]);

  // Scroll to bottom
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom() }, [messages]);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  };

  // New Chat
  const handleNewChat = () => {
    setMessages([]);
    setMobileMenuOpen(false);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // Handle Agent Switch (Updated Logic)
  const handleAgentSwitch = (newType: AgentType) => {
    if (agentType !== newType) {
      setAgentType(newType);
      setMessages([]); // Clears chat to trigger the new greeting immediately
    }
  };

  // Send Message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

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

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex h-screen bg-[#F9F9FB] text-slate-800 font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <AnimatePresence>
        {(sidebarOpen || mobileMenuOpen) && (
          <>
            <div 
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed md:relative z-50 w-[280px] h-full bg-[#F5F5F7] border-r border-slate-200 flex flex-col shadow-xl md:shadow-none`}
            >
              {/* Sidebar Header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200/50">
                <div className="relative w-32 h-8 opacity-80">
                  <Image 
                    src="/static/images.png"
                    alt="Logo" 
                    fill 
                    className="object-contain object-left mix-blend-multiply" 
                  />
                </div>
                <button onClick={() => { setSidebarOpen(false); setMobileMenuOpen(false); }} className="md:hidden p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-medium text-slate-700 group mb-6"
                >
                  <div className="bg-slate-100 p-1 rounded-md group-hover:bg-slate-200 transition-colors">
                    <Plus className="w-4 h-4 text-slate-600" />
                  </div>
                  New Chat
                </button>

                <div className="space-y-6">
                  {MOCK_HISTORY.map((group, i) => (
                    <div key={i}>
                      <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        {group.label}
                      </h3>
                      <ul className="space-y-0.5">
                        {group.items.map((item, j) => (
                          <li key={j}>
                            <button className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-200/50 text-[13px] text-slate-600 truncate transition-colors">
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-slate-200 bg-[#F5F5F7]">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer group relative">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    RC
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">Rancho Admin</p>
                    <p className="text-xs text-slate-500 truncate">admin@cityof.rancho</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    title="Log Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
        
        {/* Header */}
        <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:flex p-2 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-md">
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden relative w-32 h-8 ml-2">
               <Image src="/static/images.png" alt="Logo" fill className="object-contain object-left" />
            </div>
          </div>

          <div className="flex bg-slate-100/80 p-1 rounded-full items-center gap-1">
            <button
              onClick={() => handleAgentSwitch('customer')}
              className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                agentType === 'customer' 
                  ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               {agentType === 'customer' && <motion.div layoutId="pill" className="absolute inset-0 bg-white rounded-full shadow-sm" />}
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/customer_service_ranchocordova.png" alt="CS" width={16} height={16} />
                  Services
               </span>
            </button>
            <button
              onClick={() => handleAgentSwitch('energy')}
              className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                agentType === 'energy' 
                  ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {agentType === 'energy' && <motion.div layoutId="pill" className="absolute inset-0 bg-white rounded-full shadow-sm" />}
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/energy_agent_ranchocordova.png" alt="En" width={16} height={16} />
                  Energy
               </span>
            </button>
          </div>
        </header>

        {/* Chat Area - Padded Bottom */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 py-8 pb-60">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group flex gap-5 mb-8 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {msg.role === 'assistant' ? (
                      <div className={`w-8 h-8 rounded-full overflow-hidden border ${agentType === 'energy' ? 'border-emerald-100' : 'border-blue-100'}`}>
                          <Image 
                            src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                            alt="AI" width={32} height={32} className="object-cover h-full w-full"
                          />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className={`flex-1 max-w-2xl ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className="mb-1 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      {msg.role === 'assistant' ? 'Rancho AI' : 'You'}
                    </div>

                    <div className={`prose prose-slate max-w-none text-base leading-7 text-slate-700 whitespace-pre-wrap`}>
                       {msg.content}
                    </div>

                    {msg.chartData && (
                      <div className="mt-4 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                        <ChartDisplay chartData={msg.chartData} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-5 mb-8">
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-200" />
                </div>
              </motion.div>
            )}

            {error && (
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-full border border-red-100">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area (Floating) */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/95 to-transparent pb-6 pt-12 px-4">
          <div className="max-w-3xl mx-auto">
            <div className={`relative bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all overflow-hidden ${loading ? 'opacity-80 grayscale' : ''}`}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask about energy usage, rates, or trends..." : "Ask about city events, permits, or services..."}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 px-4 py-3 focus:ring-0 resize-none max-h-48 min-h-[52px] text-base leading-relaxed"
                rows={1}
                disabled={loading}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1 px-2">
                   <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                      <Paperclip className="w-4 h-4" />
                   </button>
                   <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest ml-2">
                     {agentType === 'energy' ? 'Energy Advisor' : 'City Services'}
                   </span>
                </div>
                <button 
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className={`p-2 rounded-xl transition-all ${
                    input.trim() 
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                      : 'bg-slate-100 text-slate-300'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2">
              Rancho AI can make mistakes. Please verify critical information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
