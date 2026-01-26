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
          <div className="relative w-60 h-16">
            <Image 
              src="/static/images.png" 
              alt="Logo" 
              fill 
              className="object-contain" 
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

          {/* CONTACT BOX (Replaced Demo Credentials) */}
          <div className="w-full mt-4 p-5 border border-slate-200 rounded-2xl bg-slate-50/80 text-center space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Contact
            </p>
            <p className="text-base  text-black-400">
              Jothi Periasamy
            </p>
            <p className="text-sm text-black-400 font-medium">
              Chief Architect 
            </p>
            <p className="text-sm text-black-400 font-semibold">
              LLM at Scale.AI
            </p>
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
