// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, User, ArrowRight, Loader2 } from 'lucide-react';

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

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (username === 'admin' && password === 'rancho2024') {
      // CHANGED: Use sessionStorage instead of localStorage
      // This clears when the browser is closed
      sessionStorage.setItem('isAuthenticated', 'true');
      
      // Redirect to agent selection page instead of directly to chat
      router.push('/select-agent');
    } else {
      setError('Invalid username or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white selection:bg-blue-100 selection:text-blue-900">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50 to-white -z-10" />
        <Image
          src="/static/reactanglehalf.png"
          alt="Decoration"
          width={600}
          height={600}
          className="absolute top-[-20%] left-[-10%] opacity-10 blur-3xl -z-10"
        />

        <div className="w-full max-w-md space-y-10">
          <div className="text-center space-y-4">
            <div className="relative w-80 h-24 mx-auto">
              <Image
                src="/static/images.png"
                alt="City of Rancho Cordova"
                fill
                className="object-contain"
                priority
              />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900">
                Welcome Back
              </h1>
              <p className="text-slate-500 font-sans">
                Sign in to access the City AI Assistant
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <div className="w-1 h-4 bg-red-500 rounded-full" />
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 focus:bg-white font-sans tracking-tight"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 focus:bg-white font-sans tracking-tight"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 font-sans tracking-tight"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {loading ? (
                  <Loader2 className="h-5 w-5 text-blue-300 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5 text-blue-300 group-hover:translate-x-1 transition-transform" />
                )}
              </span>
              {loading ? 'Authenticating...' : 'Sign in to Dashboard'}
            </button>
          </form>

          <div className="pt-6 text-center text-xs text-slate-400 font-sans">
            <p>Demo Credentials: <strong>admin</strong> / <strong>rancho2024</strong></p>
          </div>
        </div>
      </div>

      {/* Right Side - Hero Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-slate-900">
        <Image 
          src="/static/image_a8ecc8.jpg" 
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
