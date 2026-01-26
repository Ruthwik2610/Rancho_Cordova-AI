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

    // Simulate login delay
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
      
      {/* 1. Background Image */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/static/image_a8ecc8.jpg" 
          alt="Login Background" 
          fill 
          className="object-cover"
          priority
        />
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
      </div>

      {/* 2. THE SILVER BUBBLE CARD */}
      <div className="relative z-10 w-full max-w-[380px] px-6">
        
        <div className="
          bg-white/80                /* Translucent white background */
          backdrop-blur-xl           /* Frosted glass effect */
          p-8                        /* Spacing inside the bubble */
          rounded-[2.5rem]           /* SUPER ROUNDED CORNERS (The Bubble Shape) */
          shadow-2xl                 /* Deep shadow to make it float */
          border-2 border-slate-300  /* THE SILVER BORDER */
          flex flex-col items-center gap-6
        ">
          
          {/* Logo */}
          <div className="relative w-44 h-12">
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
            <h1 className="text-xl font-bold text-slate-800">Welcome</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Please sign in to continue</p>
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
                  className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
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
                  className="block w-full pl-11 pr-4 py-3 bg-white/60 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
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
        </div>
        
        <p className="text-center text-[10px] text-white/80 mt-6 font-semibold tracking-wide drop-shadow-md">
          CITY OF RANCHO CORDOVA
        </p>
      </div>
    </div>
  );
}
