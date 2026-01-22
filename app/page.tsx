// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Send, LogOut, Paperclip, Menu, Plus, 
  X, User as UserIcon, AlertCircle, Copy, Check, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChartDisplay, { ChartData } from './components/ChartDisplay';

// --- Types ---
interface Source {
  source: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData;
  sources?: Source[];
  timestamp: Date;
}

type AgentType = 'customer' | 'energy';

// --- Mock Data ---
const MOCK_HISTORY = [
  { label: 'Today', items: ['Solar Panel Rebates', 'Permit Application Status'] },
  { label: 'Yesterday', items: ['Garbage Collection Schedule', 'SMUD Rate Comparison'] },
  { label: 'Previous 7 Days', items: ['City Council Meeting', 'EV Charger Locations'] },
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- Effects ---

  // 1. Auth Check
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const selectedAgent = sessionStorage.getItem('selectedAgent') as AgentType;
    if (selectedAgent) setAgentType(selectedAgent);
  }, [router]);

  // 2. Scroll to bottom
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom() }, [messages, loading]);

  // --- Handlers ---

  const handleLogout = () => {
    sessionStorage.clear();
    router.push('/login');
  };

  const handleNewChat = () => {
    setMessages([]);
    setMobileMenuOpen(false);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleAgentSwitch = (newType: AgentType) => {
    if (agentType !== newType) {
      setAgentType(newType);
      sessionStorage.setItem('selectedAgent', newType);
      setMessages([]);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const fetchWithRetry = async (attempt = 1): Promise<any> => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, agentType })
      });
      if (res.status === 503) {
        if (attempt > 3) throw new Error("System is warming up... please try again.");
        await new Promise(r => setTimeout(r, 2000));
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
        sources: data.sources,
        timestamp: new Date()
      }]);
    } catch (err: any) {
      setError(err.message || "An error occurred");
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // --- Render Helpers ---

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <AnimatePresence>
        {(sidebarOpen || mobileMenuOpen) && (
          <>
            {/* Mobile Backdrop */}
            <div 
              className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed md:relative z-50 w-[280px] h-full bg-[#FAFAFA] border-r border-slate-200 flex flex-col`}
            >
              {/* Sidebar Header */}
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
                <div className="relative w-32 h-8 opacity-90">
                  <Image 
                    src="/static/images.png"
                    alt="Logo" 
                    fill 
                    className="object-contain object-left mix-blend-multiply" 
                  />
                </div>
                <button onClick={() => { setSidebarOpen(false); setMobileMenuOpen(false); }} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm font-semibold mb-8 group"
                >
                  <Plus className="w-5 h-5" />
                  New Chat
                </button>

                <div className="space-y-8">
                  {MOCK_HISTORY.map((group, i) => (
                    <div key={i}>
                      <h3 className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        {group.label}
                      </h3>
                      <ul className="space-y-1">
                        {group.items.map((item, j) => (
                          <li key={j}>
                            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-200/60 text-sm text-slate-600 truncate transition-colors">
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
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    RC
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">Rancho Admin</p>
                    <p className="text-xs text-slate-500 truncate">admin@rancho.city</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white shadow-xl z-0">
        
        {/* Header */}
        <header className="sticky top-0 z-20 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <div className="md:hidden relative w-32 h-8">
               <Image src="/static/images.png" alt="Logo" fill className="object-contain object-left" />
            </div>
          </div>

          {/* Agent Switcher Pills */}
          <div className="flex bg-slate-100 p-1.5 rounded-full items-center">
            <button
              onClick={() => handleAgentSwitch('customer')}
              className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                agentType === 'customer' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/customer_service_ranchocordova.png" alt="CS" width={16} height={16} />
                  Services
               </span>
            </button>
            <button
              onClick={() => handleAgentSwitch('energy')}
              className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                agentType === 'energy' 
                  ? 'bg-white text-emerald-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/energy_agent_ranchocordova.png" alt="En" width={16} height={16} />
                  Energy
               </span>
            </button>
          </div>
        </header>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto w-full bg-[#FFFFFF]">
          <div className="max-w-4xl mx-auto px-4 py-8">
            
            {/* Welcome State */}
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center mt-20 text-center space-y-6"
              >
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl ${
                  agentType === 'energy' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                   <Image 
                     src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                     alt="Agent" width={64} height={64}
                   />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 mb-2">
                    {agentType === 'energy' ? 'Energy Advisor' : 'City Services Assistant'}
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-lg">
                    {agentType === 'energy' 
                      ? 'Analyze usage, compare rates, and forecast demand.' 
                      : 'Ask about permits, events, and city services.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Message List */}
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 flex-shrink-0 mt-1 shadow-sm">
                      <Image 
                        src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                        alt="AI" width={32} height={32} className="object-cover h-full w-full"
                      />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    <div className={`relative px-5 py-3.5 shadow-sm text-base leading-relaxed group ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                    }`}>
                      
                      {/* Message Content */}
                      <div className={`prose max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'}`}>
                        {msg.content}
                      </div>

                      {/* Charts */}
                      {msg.chartData && (
                        <div className="mt-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                           <ChartDisplay chartData={msg.chartData} />
                        </div>
                      )}

                      {/* Copy Button (Hover) */}
                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-200 hover:text-slate-600"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>

                    {/* Metadata: Sources & Timestamp */}
                    <div className={`flex items-center gap-3 mt-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatTime(msg.timestamp)}
                      </span>
                      
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex gap-2">
                          {msg.sources.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 max-w-[150px] truncate">
                              <Info className="w-3 h-3" />
                              <span className="truncate">{s.source}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0 mt-1">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading Indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 mb-6">
                 <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 flex-shrink-0 shadow-sm bg-white p-1">
                    <div className="w-full h-full bg-slate-100 rounded-full animate-pulse" />
                 </div>
                 <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                 </div>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-full border border-red-200 shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Footer */}
        <div className="bg-white border-t border-slate-200 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">
            <div className={`relative flex items-end gap-2 bg-[#F8FAFC] rounded-2xl border border-slate-200 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all ${loading ? 'opacity-70 pointer-events-none' : ''}`}>
              
              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors self-end mb-0.5">
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask about SMUD rates, consumption..." : "Ask about permits, garbage pickup..."}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 px-2 py-3 focus:ring-0 resize-none max-h-48 min-h-[44px] text-base leading-relaxed custom-scrollbar"
                rows={1}
                disabled={loading}
              />
              
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={`p-2.5 rounded-xl transition-all self-end mb-0.5 flex-shrink-0 ${
                  input.trim() 
                    ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg transform active:scale-95' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-3">
              Rancho AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
