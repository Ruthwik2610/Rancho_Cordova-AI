'use client';

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
  Filler,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { useRef, useEffect, useState } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface ChartData {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'doughnut';
  title: string;
  explanation: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string | string[];
    }[];
  };
}

// --- 1. EXPANDED COLOR PALETTES ---
const PALETTES = [
  { // Ocean Blue
    name: 'ocean',
    border: '#3b82f6', 
    start: 'rgba(59, 130, 246, 0.5)', 
    end: 'rgba(59, 130, 246, 0.05)',
    bubble: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: 'text-blue-500'
  },
  { // Emerald Nature
    name: 'emerald',
    border: '#10b981', 
    start: 'rgba(16, 185, 129, 0.5)', 
    end: 'rgba(16, 185, 129, 0.05)',
    bubble: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: 'text-emerald-500'
  },
  { // Sunset Orange
    name: 'sunset',
    border: '#f97316', 
    start: 'rgba(249, 115, 22, 0.5)', 
    end: 'rgba(249, 115, 22, 0.05)',
    bubble: 'bg-orange-50 text-orange-700 border-orange-100',
    icon: 'text-orange-500'
  },
  { // Royal Violet
    name: 'royal',
    border: '#8b5cf6', 
    start: 'rgba(139, 92, 246, 0.5)', 
    end: 'rgba(139, 92, 246, 0.05)',
    bubble: 'bg-violet-50 text-violet-700 border-violet-100',
    icon: 'text-violet-500'
  },
  { // Berry Pink
    name: 'berry',
    border: '#ec4899', 
    start: 'rgba(236, 72, 153, 0.5)', 
    end: 'rgba(236, 72, 153, 0.05)',
    bubble: 'bg-pink-50 text-pink-700 border-pink-100',
    icon: 'text-pink-500'
  }
];

// Helper: Pick a palette deterministically based on title text
const getPalette = (title: string) => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
};

export default function ChartDisplay({ chartData }: { chartData: ChartData }) {
  const chartRef = useRef<any>(null);
  const [gradientData, setGradientData] = useState<any>(null);

  // 1. Select Theme
  const theme = getPalette(chartData.title);

  // 2. Determine Size based on Type
  const isTrend = chartData.chartType === 'line' || chartData.chartType === 'bar';
  
  const containerClasses = isTrend 
    ? "min-w-[300px] sm:min-w-[550px] max-w-2xl" // Wide for Time Series
    : "min-w-[280px] sm:min-w-[380px] max-w-[420px]"; // Compact for Pie/Doughnut

  const heightClass = isTrend
    ? "h-72" // 288px height
    : "h-64"; // 256px height

  // --- CHART EFFECT ---
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const newDatasets = chartData.data.datasets.map((ds) => {
      const ctx = chart.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, theme.start);
      gradient.addColorStop(1, theme.end);

      return {
        ...ds,
        borderColor: theme.border,
        backgroundColor: isTrend ? gradient : ds.backgroundColor, 
        borderWidth: 2,
        fill: true,
        // For Pie charts, we generate an array of colors derived from the theme
        ...( !isTrend && {
             backgroundColor: [
               theme.border,                    // Strong
               theme.start.replace('0.5', '0.8'), // Medium
               theme.start.replace('0.5', '0.4'), // Light
               '#cbd5e1'                        // Grey for "Other"
             ],
             borderColor: '#ffffff',
             borderWidth: 2
        })
      };
    });

    setGradientData({ ...chartData.data, datasets: newDatasets });
  }, [chartData, theme, isTrend]);

  // --- OPTIONS ---
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: isTrend ? 'top' : 'right', // Legend on side for Pie looks cleaner
        align: isTrend ? 'end' : 'center',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
          color: '#64748b',
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: theme.border,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: 'bold' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowBlur: 12,
        shadowColor: 'rgba(0,0,0,0.1)',
      },
    },
    scales: isTrend ? {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9', drawBorder: false },
        ticks: { font: { size: 10 }, color: '#94a3b8', padding: 8 },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#64748b' },
        border: { display: false },
      },
    } : {
      x: { display: false },
      y: { display: false }
    },
    elements: {
      line: { tension: 0.4 },
      point: { radius: 0, hoverRadius: 6, backgroundColor: '#fff', borderWidth: 2, hoverBorderColor: theme.border },
      bar: { borderRadius: 6 },
    },
    layout: { padding: isTrend ? 0 : 10 }
  };

  const renderChart = () => {
    const data = gradientData || chartData.data;
    switch (chartData.chartType) {
      case 'line': return <Line ref={chartRef} options={options as any} data={data} />;
      case 'bar': return <Bar ref={chartRef} options={options as any} data={data} />;
      case 'pie': return <Pie ref={chartRef} options={options as any} data={data} />;
      // FIX: Added 'as any' to the options object here to fix the TypeScript error
      case 'doughnut': return <Doughnut ref={chartRef} options={{...options, cutout: '70%'} as any} data={data} />;
      default: return null;
    }
  };

  return (
    <div className={`flex flex-col bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/40 overflow-hidden mt-4 mb-2 transition-all hover:shadow-xl ${containerClasses}`}>
      
      {/* Title Header */}
      <div className="px-5 pt-5 pb-1 flex justify-between items-center">
        <h3 className="text-slate-800 font-bold text-sm tracking-tight">
          {chartData.title}
        </h3>
        {/* Tiny visual tag based on chart type */}
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.bubble.split(' ')[0]} ${theme.bubble.split(' ')[1]} opacity-80`}>
          {chartData.chartType}
        </span>
      </div>

      {/* Dynamic Chart Area */}
      <div className={`relative w-full px-4 pb-2 ${heightClass}`}>
        {renderChart()}
      </div>

      {/* Insight Footer */}
      {chartData.explanation && (
        <div className={`px-5 py-3 border-t border-dashed ${theme.bubble.replace('bg-', 'border-')} bg-opacity-30 backdrop-blur-sm flex gap-3 items-start`}>
          <div className="mt-0.5 shrink-0">
            <svg className={`w-4 h-4 ${theme.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {chartData.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
