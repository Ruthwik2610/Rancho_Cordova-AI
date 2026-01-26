// app/login/page.tsx
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
      router.push('/');
    } else {
      setError('Invalid username or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      
     
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        
     
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
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-800">Welcome Back</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Please sign in </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="w-full space-y-4">
            
            {/* Username */}
            <div className="space-y-1">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl animate-in fade-in slide-in-from-top-1 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Text */}
          <div className="text-center text-[10px] text-slate-400 font-sans">
            
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
        
        <div className="absolute bottom-0 left-0 w-full p-16 text-white space-y-6">
          <div className="w-16 h-1 bg-blue-400 rounded-full" />
          <h2 className="text-4xl font-serif font-bold max-w-lg leading-tight">
            Empowering the Community with Intelligent Insights
          </h2>
          <p className="text-blue-100 text-lg max-w-md font-sans leading-relaxed">
            Your gateway to city services, energy analytics, and smart infrastructure management.
          </p>
        </div>
      </div>

    </div>
  );
}
