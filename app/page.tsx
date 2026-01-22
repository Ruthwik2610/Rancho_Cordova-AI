// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Send, LogOut, Paperclip, Menu, Plus, 
  X, AlertCircle, Copy, Check, Info, Bot
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
      try {
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

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Server Error");
          return data;
        } else {
          const text = await res.text();
          throw new Error(text || `Server returned ${res.status}`);
        }
      } catch (err: any) {
        throw err;
      }
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
      console.error("Message Error:", err);
      setError(err.message.length > 100 ? "An internal server error occurred." : err.message);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I apologize, but I encountered an error processing your request.",
        timestamp: new Date()
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR - Changed to Soft Gray (Slate-50) for contrast */}
      <AnimatePresence>
        {(sidebarOpen || mobileMenuOpen) && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/20 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed md:relative z-50 w-[280px] h-full bg-[#F8FAFC] border-r border-slate-200 flex flex-col shadow-2xl md:shadow-none`}
            >
              {/* Sidebar Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200/50">
                <div className="relative w-36 h-10 opacity-100">
                  <Image 
                    src="/static/images.png"
                    alt="Logo" 
                    fill 
                    className="object-contain object-left mix-blend-multiply" 
                    priority
                  />
                </div>
                <button onClick={() => { setSidebarOpen(false); setMobileMenuOpen(false); }} className="md:hidden p-2 text-slate-400 hover:bg-slate-200 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* CHANGED: Button is now Blue instead of Black */}
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all text-sm font-medium mb-8 group active:scale-95 duration-150"
                >
                  <Plus className="w-5 h-5" />
                  New Chat
                </button>

                <div className="space-y-8">
                  {MOCK_HISTORY.map((group, i) => (
                    <div key={i}>
                      <h3 className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        {group.label}
                      </h3>
                      <ul className="space-y-1">
                        {group.items.map((item, j) => (
                          <li key={j}>
                            <button className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white hover:shadow-sm text-[13px] text-slate-600 font-medium truncate transition-all border border-transparent hover:border-slate-100">
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
              <div className="p-4 border-t border-slate-200/50 bg-[#F8FAFC]">
                <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer group relative border border-transparent hover:border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                    RC
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Rancho Admin</p>
                    <p className="text-[11px] text-slate-500 truncate">admin@rancho.city</p>
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

      {/* MAIN CONTENT AREA - Changed to pure White for contrast */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
        
        {/* Header */}
        <header className="sticky top-0 z-20 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 h-16 flex items-center justify-between px-4 sm:px-8 transition-all">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:flex p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            
            <h1 className="text-sm font-semibold text-slate-700 hidden sm:block">
               {agentType === 'energy' ? 'Energy Advisor' : 'City Services Assistant'}
            </h1>
          </div>

          {/* Toggle Pills */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => handleAgentSwitch('customer')}
              className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
                agentType === 'customer' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/customer_service_ranchocordova.png" alt="CS" width={14} height={14} />
                  Services
               </span>
            </button>
            <button
              onClick={() => handleAgentSwitch('energy')}
              className={`relative px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-2 ${
                agentType === 'energy' 
                  ? 'bg-white text-emerald-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               <span className="relative z-10 flex items-center gap-1.5">
                  <Image src="/static/energy_agent_ranchocordova.png" alt="En" width={14} height={14} />
                  Energy
               </span>
            </button>
          </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 py-8 pb-4">
            
            {/* Empty State */}
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center mt-12 md:mt-20 text-center space-y-8"
              >
                <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm border ${
                  agentType === 'energy' 
                    ? 'bg-emerald-50 border-emerald-100' 
                    : 'bg-blue-50 border-blue-100'
                }`}>
                   <Image 
                     src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                     alt="Agent" width={48} height={48}
                     className="drop-shadow-sm"
                   />
                </div>
                <div className="space-y-2 max-w-lg">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Hello, I'm your {agentType === 'energy' ? 'Energy Advisor' : 'City Assistant'}.
                  </h2>
                  <p className="text-slate-500 text-base leading-relaxed">
                    {agentType === 'energy' 
                      ? 'I can analyze your SMUD usage, compare rates, check for solar rebates, and forecast your energy demand.' 
                      : 'I can help with building permits, garbage schedules, city events, and general inquiries.'}
                  </p>
                </div>
                
                {/* Suggestions Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg pt-4">
                   {(agentType === 'energy' 
                      ? ["Compare SMUD rates", "Solar rebates available?", "Forecast next month's bill", "EV Charger locations"]
                      : ["How do I get a permit?", "Garbage pickup schedule", "Upcoming city events", "Report a pothole"]
                   ).map((suggestion, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => { setInput(suggestion); if(inputRef.current) inputRef.current.focus(); }}
                        className="px-4 py-3 text-sm text-slate-600 bg-white border border-slate-100 shadow-sm rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left"
                      >
                        {suggestion}
                      </button>
                   ))}
                </div>
              </motion.div>
            )}

            {/* Message List */}
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`flex gap-4 mb-8 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant Avatar */}
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-100 bg-[#F8FAFC] flex items-center justify-center">
                         <Image 
                           src={agentType === 'energy' ? "/static/energy_agent_ranchocordova.png" : "/static/customer_service_ranchocordova.png"}
                           alt="AI" width={24} height={24} className="object-contain"
                         />
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* User Name / Bot Name */}
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {msg.role === 'user' ? 'You' : 'Rancho AI'}
                      </span>
                    </div>

                    {/* The Bubble */}
                    <div className={`relative px-5 py-4 shadow-sm text-[15px] leading-7 group ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-blue-600/10' 
                        : 'bg-[#F8FAFC] border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm'
                    }`}>
                      
                      {/* Markdown Content */}
                      <div className={`prose max-w-none ${
                        msg.role === 'user' 
                          ? 'prose-invert text-white prose-p:leading-relaxed' 
                          : 'prose-slate prose-p:text-slate-700 prose-headings:text-slate-800 prose-strong:text-slate-900 prose-strong:font-bold'
                      }`}>
                        {msg.content}
                      </div>

                      {/* Charts */}
                      {msg.chartData && (
                        <div className="mt-5 mb-2 -mx-2 sm:mx-0">
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                             <ChartDisplay chartData={msg.chartData} />
                          </div>
                        </div>
                      )}

                      {/* Copy Action */}
                      {msg.role === 'assistant' && (
                        <div className="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard(msg.content, msg.id)}
                             className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors"
                           >
                             {copiedId === msg.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                             {copiedId === msg.id ? 'Copied' : 'Copy'}
                           </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 px-1">
                          {msg.sources.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11px] bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 hover:border-blue-200 hover:text-blue-600 transition-colors cursor-default">
                              <Info className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{s.source}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking / Loading State */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 mb-8">
                 <div className="w-9 h-9 rounded-full border border-slate-100 bg-[#F8FAFC] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-slate-400" />
                 </div>
                 <div className="flex flex-col items-start">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                        Processing
                    </span>
                    <div className="bg-[#F8FAFC] border border-slate-100 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-[bounce_1s_infinite_0ms]" />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-[bounce_1s_infinite_400ms]" />
                    </div>
                 </div>
              </motion.div>
            )}

            {/* Error Toast */}
            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center mb-6">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area - Clean & Floating */}
        <div className="relative z-20 bg-white pb-6 pt-2 px-4">
          <div className="max-w-3xl mx-auto">
            {/* The Input Container - CHANGED: No border, softer shadow, light gray bg */}
            <div 
              className={`
                relative flex items-end gap-3 bg-[#F0F2F5] rounded-3xl p-3 
                shadow-sm border-transparent 
                focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:shadow-md
                transition-all duration-300 ease-out
                ${loading ? 'opacity-70 pointer-events-none grayscale' : ''}
              `}
            >
              
              {/* Attachment Icon */}
              <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors self-end" title="Attach file">
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={adjustTextareaHeight}
                onKeyDown={handleKeyDown}
                placeholder={agentType === 'energy' ? "Ask about SMUD usage, rates, or incentives..." : "Ask about permits, events, or services..."}
                className="w-full bg-transparent border-none text-slate-800 placeholder-slate-500 px-1 py-3 focus:ring-0 resize-none max-h-40 min-h-[48px] text-[15px] leading-relaxed custom-scrollbar"
                rows={1}
                disabled={loading}
              />
              
              {/* Send Button */}
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={`p-3 rounded-full transition-all duration-200 self-end shadow-sm ${
                  input.trim() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' 
                    : 'bg-slate-300 text-white cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-center text-[10px] text-slate-400 mt-4 font-medium tracking-wide">
              Rancho AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
