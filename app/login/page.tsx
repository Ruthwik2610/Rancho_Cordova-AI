'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (username === 'admin' && password === 'rancho2024') {
      sessionStorage.setItem('isAuthenticated', 'true');
      router.push('/select-agent');
    } else {
      setError('Invalid username or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      
      {/* --- LEFT SIDE: THE BUBBLE FORM --- */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        
        {/* THE BUBBLE CARD */}
        <div className="
          w-full max-w-[500px]
          bg-transparent
          p-10
          rounded-[3rem]
          border-2 border-slate-200
          flex flex-col items-center gap-6
        ">
          
          {/* Logo */}
          <div className="relative w-64 h-16">
            <Image 
              src="/static/images.png"
              alt="Logo" 
              fill 
              className="object-contain object-center" 
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-800">Welcome to City Services</h1>
            <p className="text-sm text-slate-500 font-medium">24/7 AI Assistance for Rancho Cordova Residents</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="w-full space-y-6">
            
            {/* Username */}
            <div className="space-y-1">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <User className="h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl animate-in fade-in slide-in-from-top-1 font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <Loader2 className="animate-spin h-6 w-6" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* IMPROVED CONTACT BOX */}
          <div className="w-full mt-8 p-6 border-2 border-slate-200 rounded-2xl bg-gradient-to-br from-slate-50 to-white shadow-sm hover:shadow-md transition-all duration-300">
            
            {/* Decorative Top Element */}
            <div className="flex items-center justify-center mb-5">
              <div className="w-16 h-1 bg-slate-800 rounded-full" />
            </div>
            
            {/* LABEL */}
            <p className="text-[11px] font-bold text-black uppercase tracking-[0.15em] text-center mb-4 opacity-70">
              Contact
            </p>

            {/* NAME with Decorative Divider */}
            <div className="text-center mb-4">
              <p className="text-lg text-black font-bold tracking-tight mb-2">
                Jothi Periasamy
              </p>
              <div className="w-12 h-0.5 bg-slate-300 mx-auto rounded-full" />
            </div>

            {/* TITLE & COMPANY with Better Spacing */}
            <div className="text-[13px] text-black font-medium text-center space-y-1 mb-5">
              <p className="leading-relaxed">Chief Architect</p>
              <p className="leading-relaxed opacity-80">LLM at Scale.AI</p>
            </div>

            {/* EMAIL in Enhanced Button Style */}
            <div className="pt-4 border-t border-slate-200/80">
              <a 
                href="mailto:jothi@llmatscale.ai" 
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-black font-semibold rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group"
              >
                <svg className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>jothi@llmatscale.ai</span>
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* --- RIGHT SIDE: HERO IMAGE --- */}
      <div className="hidden lg:block lg:w-1/2 relative bg-slate-900">
        <Image 
          src="/static/login_1.jpg" 
          alt="Rancho Cordova Landscape" 
          fill
          className="object-cover opacity-90"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 via-blue-900/40 to-blue-900/20" />
        
        <div className="absolute bottom-0 left-0 w-full p-20 text-white space-y-8">
          <div className="w-20 h-1.5 bg-blue-400 rounded-full" />
          <h2 className="text-4xl font-serif font-bold max-w-lg leading-tight">
            Empowering the Community with Intelligent Insights
          </h2>
          <p className="text-blue-100 text-xl max-w-md font-sans leading-relaxed">
            Your gateway to city services, energy analytics, and smart infrastructure management.
          </p>
        </div>
      </div>

    </div>
  );
}
