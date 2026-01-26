// app/select-agent/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Zap, HeadphonesIcon, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SelectAgentPage() {
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [router]);

  const handleAgentSelect = (agentType: 'customer' | 'energy') => {
    // Store the selected agent type
    sessionStorage.setItem('selectedAgent', agentType);
    router.push('/');
  };

  const handleLogout = () => {
    sessionStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="relative w-60 h-16">
            <Image
              src="/static/images.png"
              alt="City of Rancho Cordova"
              fill
              className="object-contain object-left"
            />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Choose Your AI Agent
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select the agent that best fits your needs. Each specializes in specific services.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Customer Service Agent */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={() => handleAgentSelect('customer')}
            className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-blue-500"
          >
            {/* Decorative Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
              {/* Icon */}
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Image
                  src="/static/customer_service_ranchocordova.png"
                  alt="Customer Service"
                  width={48}
                  height={48}
                />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                City Services Agent
                <ArrowRight className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>

              {/* Description */}
              <p className="text-slate-600 mb-6 leading-relaxed">
                Your go-to resource for navigating city services, permits, events, and community programs.
              </p>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  </div>
                  <span>Building permits and planning applications</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  </div>
                  <span>City events, meetings, and community programs</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  </div>
                  <span>Public utilities and waste management schedules</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  </div>
                  <span>Parks, recreation, and local facilities</span>
                </li>
              </ul>

              {/* CTA Button */}
              <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 group-hover:shadow-lg">
                Start Interaction with Agent
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Energy Advisor */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onClick={() => handleAgentSelect('energy')}
            className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-emerald-500"
          >
            {/* Decorative Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10">
              {/* Icon */}
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Image
                  src="/static/energy_agent_ranchocordova.png"
                  alt="Energy Advisor"
                  width={48}
                  height={48}
                />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                Energy Advisor Agent
                <ArrowRight className="w-5 h-5 text-emerald-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>

              {/* Description */}
              <p className="text-slate-600 mb-6 leading-relaxed">
                Optimize your energy consumption with insights on SMUD rates, solar incentives, and usage analytics.
              </p>

              {/* Features List */}
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  </div>
                  <span>SMUD rate comparisons and cost forecasting</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  </div>
                  <span>Solar panel rebates and green incentives</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  </div>
                  <span>Energy usage patterns and trend analysis</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  </div>
                  <span>EV charging locations and infrastructure</span>
                </li>
              </ul>

              {/* CTA Button */}
              <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 group-hover:shadow-lg">
                Start Interaction with Agent
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 max-w-3xl mx-auto"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Need Help Choosing?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Switch between agents anytime using the chat toggle. Both have full access to city data and handle all inquiries.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );

}

