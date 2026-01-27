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
  ScriptableContext,
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

// --- VIBRANT NATURAL PALETTES ---
// We map the incoming "monotonic" colors to these lush gradients
const THEMES = {
  blue: {
    border: '#0ea5e9', // Sky 500
    start: 'rgba(14, 165, 233, 0.6)', 
    end: 'rgba(99, 102, 241, 0.05)', // Indigo fade
    bubble: 'bg-sky-50 text-sky-700',
    icon: 'text-sky-500'
  },
  green: {
    border: '#10b981', // Emerald 500
    start: 'rgba(16, 185, 129, 0.6)',
    end: 'rgba(20, 184, 166, 0.05)', // Teal fade
    bubble: 'bg-emerald-50 text-emerald-700',
    icon: 'text-emerald-500'
  },
  default: {
    border: '#8b5cf6', // Violet 500
    start: 'rgba(139, 92, 246, 0.6)',
    end: 'rgba(217, 70, 239, 0.05)', // Fuchsia fade
    bubble: 'bg-violet-50 text-violet-700',
    icon: 'text-violet-500'
  }
};

export default function ChartDisplay({ chartData }: { chartData: ChartData }) {
  const chartRef = useRef<any>(null);
  const [gradientData, setGradientData] = useState<any>(null);

  // Detect theme based on incoming color (simple heuristic)
  const incomingColor = chartData.data.datasets[0]?.borderColor || '';
  const theme = incomingColor.includes('34, 197, 94') ? THEMES.green : 
                incomingColor.includes('59, 130, 246') ? THEMES.blue : 
                THEMES.default;

  // --- GRADIENT GENERATION ---
  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) return;

    const newDatasets = chartData.data.datasets.map((ds) => {
      // Create gradient for this dataset
      const ctx = chart.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, theme.start);
      gradient.addColorStop(1, theme.end);

      return {
        ...ds,
        borderColor: theme.border,
        backgroundColor: chartData.chartType === 'line' || chartData.chartType === 'bar' 
          ? gradient 
          : ds.backgroundColor, // Keep pie/doughnut segments distinct
        fill: true,
      };
    });

    setGradientData({
      ...chartData.data,
      datasets: newDatasets
    });
  }, [chartData, theme]);

  // --- CHART OPTIONS ---
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 10,
          font: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          color: '#64748b',
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: theme.border, // Border matches the chart theme
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        boxPadding: 6,
        titleFont: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        shadowOffsetX: 0,
        shadowOffsetY: 8,
        shadowBlur: 16,
        shadowColor: 'rgba(0,0,0,0.12)',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
          drawBorder: false,
          borderDash: [8, 8], // Softer dash
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#94a3b8',
          padding: 10,
        },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#64748b',
        },
        border: { display: false },
      },
    },
    elements: {
      line: { tension: 0.45 }, // Extra smooth organic curves
      point: { 
        radius: 0, // Clean look, only show on hover
        hoverRadius: 8, 
        borderWidth: 3, 
        backgroundColor: '#fff',
        hoverBorderColor: theme.border
      },
      bar: { borderRadius: 8, borderSkipped: false },
    },
  };

  const renderChart = () => {
    // Use gradientData if ready, otherwise fallback to raw chartData
    const dataToUse = gradientData || chartData.data;

    switch (chartData.chartType) {
      case 'line': return <Line ref={chartRef} options={options as any} data={dataToUse} />;
      case 'bar': return <Bar ref={chartRef} options={options as any} data={dataToUse} />;
      case 'pie': return <Pie ref={chartRef} options={{...options, scales:{x:{display:false},y:{display:false}}}} data={dataToUse} />;
      case 'doughnut': return <Doughnut ref={chartRef} options={{...options, cutout:'75%', scales:{x:{display:false},y:{display:false}}}} data={dataToUse} />;
      default: return null;
    }
  };

  return (
    // UPDATED CONTAINER: Larger sizes (min-w-[600px] on desktop)
    <div className="w-full flex flex-col bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 overflow-hidden mt-6 mb-4 min-w-[350px] sm:min-w-[600px] transition-all duration-300 hover:shadow-xl">
      
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-slate-800 font-bold text-base font-sans tracking-tight">
          {chartData.title}
        </h3>
      </div>

      {/* Chart Canvas Area - INCREASED HEIGHT (h-80 = 20rem = 320px) */}
      <div className="relative h-80 w-full px-4 pb-4">
        {renderChart()}
      </div>

      {/* "Bubble" Footer - Theme Aware */}
      {chartData.explanation && (
        <div className={`px-6 py-4 flex gap-3 items-start ${theme.bubble} backdrop-blur-sm bg-opacity-60`}>
          <div className="mt-0.5 min-w-[18px]">
            <svg 
              className={`w-5 h-5 ${theme.icon}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed font-medium opacity-90">
            {chartData.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
