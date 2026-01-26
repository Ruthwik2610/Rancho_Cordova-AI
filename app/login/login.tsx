'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    
    await new Promise(resolve => setTimeout(resolve, 800));

    if (username === 'admin' && password === 'admin') {
      sessionStorage.setItem('isAuthenticated', 'true');
      router.push('/');
    } else {
      setError('Invalid credentials');
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden bg-slate-100">
      
      {/* Background Image (Full Screen) */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/static/image_a8ecc8.jpg" 
          alt="Login Background" 
          fill 
          className="object-cover opacity-90"
          priority
        />
        {/* Dark Overlay for better contrast */}
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      </div>

      {/* --- THE BUBBLE (Login Card) --- */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-white/20 flex flex-col items-center gap-6">
          
          {/* 1. Logo */}
          <div className="relative w-40 h-12 mb-2">
            <Image 
              src="/static/images.png" 
              alt="Rancho Cordova Logo" 
              fill 
              className="object-contain" 
              priority
            />
          </div>

          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
            <p className="text-sm text-slate-500">Sign in to access the AI Assistant</p>
          </div>

          {/* 2. Login Form */}
          <form onSubmit={handleLogin} className="w-full space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-sm rounded-lg animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* 3. Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Text */}
          <p className="text-xs text-center text-slate-400">
            Authorized personnel only. <br/> Contact support for access issues.
          </p>
        </div>
      </div>
    </div>
  );
}
