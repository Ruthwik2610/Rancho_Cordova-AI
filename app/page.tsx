'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Zap, User, Bot, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type ChartData = {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'doughnut';
  title: string;
  data: any;
  explanation: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData;
  sources?: Array<{ source: string; score: number }>;
};

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
    // Welcome message
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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content, 
          agentType 
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        chartData: data.chartData,
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error. Please try again or contact support if the issue persists.`
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const renderChart = (chartData: ChartData) => {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' as const },
        title: { display: true, text: chartData.title },
      },
    };

    const ChartComponent = {
      line: Line,
      bar: Bar,
      pie: Pie,
      doughnut: Doughnut,
    }[chartData.chartType];

    return (
      <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
        <div className="h-64">
          <ChartComponent data={chartData.data} options={chartOptions} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Rancho Cordova AI</h1>
                <p className="text-xs text-gray-500">Your City Assistant</p>
              </div>
            </div>

            {/* Agent Selector */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setAgentType('customer')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  agentType === 'customer'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <User className="w-4 h-4 inline mr-1" />
                City Services
              </button>
              <button
                onClick={() => setAgentType('energy')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  agentType === 'energy'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-1" />
                Energy Advisor
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-5xl mx-auto px-4 pt-4"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700 text-xl"
              >
                ×
              </button>
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
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-blue-600'
                    : agentType === 'energy'
                    ? 'bg-gradient-to-br from-green-600 to-emerald-600'
                    : 'bg-gradient-to-br from-purple-600 to-blue-600'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : agentType === 'energy' ? (
                    <Zap className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-3xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block px-6 py-4 rounded-2xl shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Chart Visualization */}
                  {msg.chartData && msg.role === 'assistant' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      {renderChart(msg.chartData)}
                    </motion.div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          <CheckCircle className="w-3 h-3" />
                          {source.source} ({source.score}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                agentType === 'energy'
                  ? 'bg-gradient-to-br from-green-600 to-emerald-600'
                  : 'bg-gradient-to-br from-purple-600 to-blue-600'
              }`}>
                {agentType === 'energy' ? (
                  <Zap className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className="inline-block px-6 py-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
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
            <div className="relative bg-white rounded-2xl shadow-lg border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  agentType === 'energy'
                    ? 'Ask about energy savings, SMUD programs, or request data visualizations...'
                    : 'Ask about city services, permits, utilities, or who to contact...'
                }
                rows={1}
                disabled={loading}
                className="w-full px-6 py-4 pr-14 bg-transparent border-none resize-none focus:outline-none text-gray-900 placeholder-gray-400 max-h-32"
                style={{ minHeight: '56px' }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-3 bottom-3 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors shadow-sm"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Press Enter to send • Shift + Enter for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
