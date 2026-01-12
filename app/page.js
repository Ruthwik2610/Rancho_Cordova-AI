'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Zap, Send, LogOut, User, Lock, 
  Loader2, Building2 
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// --- LOGIN COMPONENT ---
const Login = ({ onLogin }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleAuth = () => {
    if (user === 'rancho_admin' && pass === 'cordova2024') {
      onLogin(true);
    } else {
      setErr('Invalid Credentials');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-teal-800 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-blue-50 rounded-full mb-4">
            <Building2 className="w-10 h-10 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">City of Rancho Cordova</h1>
          <p className="text-gray-500">Authorized Personnel Only</p>
        </div>
        <div className="space-y-4">
          <input 
            className="w-full p-3 border rounded-lg"
            placeholder="Username"
            value={user} onChange={e => setUser(e.target.value)}
          />
          <input 
            type="password"
            className="w-full p-3 border rounded-lg"
            placeholder="Password"
            value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
          />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button onClick={handleAuth} className="w-full bg-blue-700 text-white py-3 rounded-lg font-bold hover:bg-blue-800">
            Authenticate
          </button>
        </div>
      </div>
    </div>
  );
};

// --- AGENT SELECTOR ---
const AgentSelector = ({ onSelect, onLogout }) => (
  <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
    <div className="w-full max-w-4xl flex justify-between mb-8">
      <h1 className="text-3xl font-bold text-gray-800">Select Agent</h1>
      <button onClick={onLogout} className="flex items-center gap-2 text-red-600 font-medium">
        <LogOut size={18} /> Logout
      </button>
    </div>
    <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
      <div onClick={() => onSelect('customer')} className="bg-white p-8 rounded-2xl shadow-lg cursor-pointer hover:border-blue-500 border-2 border-transparent transition hover:-translate-y-1">
        <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
          <MessageSquare className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Customer Service</h2>
        <p className="text-gray-600">Permits, city hall info, and general inquiries.</p>
      </div>
      <div onClick={() => onSelect('energy')} className="bg-white p-8 rounded-2xl shadow-lg cursor-pointer hover:border-teal-500 border-2 border-transparent transition hover:-translate-y-1">
        <div className="bg-teal-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
          <Zap className="w-8 h-8 text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Energy Expert</h2>
        <p className="text-gray-600">Consumption analysis, SMUD rebates, and cost savings.</p>
      </div>
    </div>
  </div>
);

// --- CHAT INTERFACE ---
const ChatInterface = ({ agent, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMsg.content,
          agentType: agent,
          history: messages.slice(-4)
        })
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.content, chart: data.chart }]);
    } catch (e) {
      console.error(e);
      setMessages(p => [...p, { role: 'assistant', content: "Error connecting to server." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderChart = (chart, key) => {
    if (!chart || !chart.data) return null;
    return (
      <div key={key} className="my-4 bg-white p-4 rounded-xl shadow-sm border h-64 w-full">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{chart.title}</h4>
        <ResponsiveContainer width="100%" height="90%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={chart.data} dataKey="value" cx="50%" cy="50%" outerRadius={60} label>
                {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill={agent === 'energy' ? '#00C49F' : '#0088FE'} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  const theme = agent === 'energy' ? 'bg-teal-700' : 'bg-blue-700';

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className={`${theme} text-white p-4 flex items-center gap-4 shadow-md`}>
        <button onClick={onBack} className="hover:bg-white/20 px-3 py-1 rounded">← Back</button>
        <h2 className="font-bold capitalize">{agent} Agent</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {renderChart(m.chart, `c-${i}`)}
            </div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-gray-500 p-4"><Loader2 className="animate-spin" size={16} /> Thinking...</div>}
        <div ref={scrollRef} />
      </div>
      <div className="p-4 bg-white border-t flex gap-2">
        <input 
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSend} disabled={loading} className={`${theme} text-white p-3 rounded-xl hover:opacity-90`}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [auth, setAuth] = useState(false);
  const [agent, setAgent] = useState(null);
  if (!auth) return <Login onLogin={setAuth} />;
  if (!agent) return <AgentSelector onSelect={setAgent} onLogout={() => setAuth(false)} />;
  return <ChatInterface agent={agent} onBack={() => setAgent(null)} />;
}