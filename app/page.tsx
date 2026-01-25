// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Send, LogOut, Paperclip, Menu, Plus, 
  X, AlertCircle, Copy, Check, Info, Bot, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const selectedAgent = sessionStorage.getItem('selectedAgent') as AgentType;
    if (selectedAgent) setAgentType(selectedAgent);
  }, [router]);

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

  return (
    <div className="flex h-screen bg-[#F5F5F7] text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <AnimatePresence>
        {(sidebarOpen || mobileMenuOpen) && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/10 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed md:relative z-50 w-[280px] h-full bg-[#EBEBEF] border-r border-slate-200/60 flex flex-col`}
            >
              <div className="h-16 flex items-center justify-between px-5">
                <div className="relative w-32 h-8 opacity-80 mix-blend-multiply">
                  <Image 
                    src="/static/images.png"
                    alt="Logo" 
                    fill 
                    className="object-contain object-center"
                    priority
                  />
                </div>
                <button onClick={() => { setSidebarOpen(false); setMobileMenuOpen(false); }} className="md:hidden p-2 text-slate-500 hover:bg-white rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2.5 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all text-sm font-medium mb-8"
                >
                  <Plus className="w-4 h-4 text-slate-400" />
                  New Chat
                </button>

                <div className="space-y-8">
                  {MOCK_HISTORY.map((group, i) => (
                    <div key={i}>
                      <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                        {group.label}
                      </h3>
                      <ul className="space-y-0.5">
                        {group.items.map((item, j) => (
                          <li key={j}>
                            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-200/50 text-[13px] text-slate-600 font-medium truncate transition-colors">
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200/50">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-all cursor-pointer group">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                    RC
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">Rancho Admin</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
        
        <header className="sticky top-0 z-20 w-full bg-white/90 backdrop-blur-xl h-14 flex items-center justify-between px-4 transition-all">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="hidden md:flex p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-full border border-slate-100">
               <div className={`w-2 h-2 rounded-full animate-pulse ${agentType === 'energy' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
               <span className="text-xs font-medium text-slate-600">
                  {agentType === 'energy' ? 'Energy Advisor' : 'City Services'}
               </span>
            </div>
          </div>

          <div className="flex bg-[#F2F2F5] p-1 rounded-lg">
            <button
              onClick={() => handleAgentSwitch('customer')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                agentType === 'customer' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               Services
            </button>
            <button
              onClick={() => handleAgentSwitch('energy')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                agentType === 'energy' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
               Energy
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-2xl mx-auto px-4 py-8 pb-4">
            
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center justify-center mt-24 text-center"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                   <Sparkles className={`w-8 h-8 ${agentType === 'energy' ? 'text-emerald-500' : 'text-blue-500'}`} />
                </div>
                <h2 className="text-2xl font-serif font-medium text-slate-800 mb-3">
                   Good morning, Admin
                </h2>
                <p className="text-slate-500 max-w-md text-[15px] leading-relaxed mb-8">
                  I can help you with {agentType === 'energy' ? 'SMUD rates, usage analytics, and rebate forecasting.' : 'building permits, city events, and general inquiries.'}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                   {(agentType === 'energy' 
                      ? ["Compare SMUD rates", "Solar rebates available?", "Forecast next month's bill", "EV Charger locations"]
                      : ["How do I get a permit?", "Garbage pickup schedule", "Upcoming city events", "Report a pothole"]
                   ).map((suggestion, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => { setInput(suggestion); if(inputRef.current) inputRef.current.focus(); }}
                        className="px-4 py-3 text-[13px] text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-left shadow-sm"
                      >
                        {suggestion}
                      </button>
                   ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 mb-8 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                     <div className="w-7 h-7 mt-1.5 flex-shrink-0 rounded-lg bg-[#F2F2F5] flex items-center justify-center text-slate-500">
                        <Bot className="w-4 h-4" />
                     </div>
                  )}

                  <div className={`flex flex-col max-w-[90%] sm:max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    <span className="text-[11px] font-medium text-slate-400 mb-1 px-1">
                      {msg.role === 'user' ? 'You' : 'Rancho AI'}
                    </span>

                    <div className={`relative px-5 py-3.5 text-[16px] leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#F2F2F5] text-slate-800 rounded-2xl rounded-tr-sm font-sans'
                        : 'bg-white text-slate-800 font-serif' 
                    }`}>
                      
                     
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          
                          p: ({node, ...props}) => <p className="mb-5 last:mb-0 leading-7 text-slate-700" {...props} />,
                          
                          
                          ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-5 space-y-3 text-slate-700" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-5 space-y-3 text-slate-700" {...props} />,
                          
                          // List Items
                          li: ({node, ...props}) => <li className="pl-1 leading-7" {...props} />,
                          
                          // Links
                          a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors" target="_blank" {...props} />,
                          
                          // Bold Text
                          strong: ({node, ...props}) => <strong className="font-semibold text-slate-900" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>

                      {msg.chartData && (
                        <div className="mt-4 mb-2">
                           <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm font-sans">
                              <ChartDisplay chartData={msg.chartData} />
                           </div>
                        </div>
                      )}

                      {msg.role === 'assistant' && (
                        <button 
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors font-sans"
                        >
                           {copiedId === msg.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                           {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 mb-8">
                 <div className="w-7 h-7 mt-1 flex-shrink-0 rounded-lg bg-[#F2F2F5] flex items-center justify-center text-slate-500">
                    <Bot className="w-4 h-4" />
                 </div>
                 <div className="flex items-center gap-1 mt-3">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                 </div>
              </motion.div>
            )}

            {error && (
              <div className="flex justify-center mb-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Seamless Input Footer */}
        <div className="w-full bg-white px-4 pb-6 pt-2">
           <div className="max-w-2xl mx-auto">
              <div 
                 className={`
                    relative bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 
                    transition-all duration-300 focus-within:shadow-xl focus-within:border-slate-300/80
                    ${loading ? 'opacity-80' : ''}
                 `}
              >
                 <textarea
                    ref={inputRef}
                    value={input}
                    onChange={adjustTextareaHeight}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply to Rancho AI..."
                    className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 px-4 py-4 focus:ring-0 resize-none max-h-48 min-h-[56px] text-[15px] leading-relaxed custom-scrollbar outline-none"
                    rows={1}
                    disabled={loading}
                    style={{ outline: 'none', boxShadow: 'none' }}
                 />
                 
                 <div className="flex justify-between items-center px-2 pb-2">
                    <div className="flex gap-1">
                       <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                          <Paperclip className="w-4 h-4" />
                       </button>
                    </div>
                    <button 
                       onClick={sendMessage}
                       disabled={!input.trim() || loading}
                       className={`p-2 rounded-lg transition-all ${
                          input.trim() 
                             ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                             : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                       }`}
                    >
                       <Send className="w-4 h-4" />
                    </button>
                 </div>
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-3 font-medium">
                 Rancho AI can make mistakes. Please verify important information.
              </p>
           </div>
        </div>

      </main>
    </div>
  );
}
