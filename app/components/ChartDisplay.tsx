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
  Filler, // Added for area charts if needed
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

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

export default function ChartDisplay({ chartData }: { chartData: ChartData }) {
  // --- MODERN STYLING CONFIGURATION ---
  
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const, // Aligns legend to the right for a cleaner header look
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
          color: '#64748b', // Slate-500
          padding: 15,
        },
      },
      title: {
        display: false, // We render the title in HTML for better control
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1e293b',
        bodyColor: '#475569',
        borderColor: '#e2e8f0', // Slate-200 border
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        titleFont: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)', // Subtle drop shadow
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9', // Very subtle grid
          drawBorder: false,
          borderDash: [5, 5], // Dashed lines look more modern
        },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#94a3b8', // Slate-400
          padding: 10,
        },
        border: { display: false }, // Hides the main Y-axis line
      },
      x: {
        grid: { display: false }, // Cleaner look without vertical lines
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: '#64748b',
        },
        border: { display: false },
      },
    },
  };

  // Specific overrides for different chart types
  const getChartOptions = () => {
    switch (chartData.chartType) {
      case 'line':
        return {
          ...commonOptions,
          elements: {
            line: { tension: 0.4 }, // Smooth curves
            point: { radius: 3, hoverRadius: 6, borderWidth: 2, backgroundColor: '#fff' },
          },
        };
      case 'bar':
        return {
          ...commonOptions,
          elements: {
            bar: { borderRadius: 6 }, // Rounded corners on bars
          },
        };
      case 'doughnut':
        return {
          ...commonOptions,
          cutout: '75%', // Thinner ring
          scales: { x: { display: false }, y: { display: false } }, // No axes for pie/doughnut
          plugins: {
            ...commonOptions.plugins,
            legend: { ...commonOptions.plugins.legend, position: 'right' }, // Legend on side looks pro for doughnuts
          }
        };
      case 'pie':
        return {
          ...commonOptions,
          scales: { x: { display: false }, y: { display: false } },
        };
      default:
        return commonOptions;
    }
  };

  const renderChart = () => {
    const options = getChartOptions();
    // Force specific styling onto datasets if not present
    const styledData = {
      ...chartData.data,
      datasets: chartData.data.datasets.map((ds) => ({
        ...ds,
        // Default transparency for area fills if line chart
        ...(chartData.chartType === 'line' ? { fill: true, backgroundColor: (ds.backgroundColor as string)?.replace('1)', '0.1)') } : {}),
        // Ensure white border for pie/doughnut segments to separate them
        ...(chartData.chartType === 'pie' || chartData.chartType === 'doughnut' ? { borderColor: '#fff', borderWidth: 2 } : {})
      }))
    };

    switch (chartData.chartType) {
      case 'line': return <Line options={options as any} data={styledData} />;
      case 'bar': return <Bar options={options as any} data={styledData} />;
      case 'pie': return <Pie options={options as any} data={styledData} />;
      case 'doughnut': return <Doughnut options={options as any} data={styledData} />;
      default: return <p className="text-red-500 text-sm">Unsupported chart type</p>;
    }
  };

  return (
    // Replaced the simple flex container with a "Card" style
    // bg-white/50 backdrop blur gives it a glassmorphic feel if on colored bg
    <div className="w-full flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-3 mb-2 min-w-[300px] sm:min-w-[480px]">
      
      {/* Header: Title */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-slate-800 font-semibold text-sm font-sans tracking-tight">
          {chartData.title}
        </h3>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative h-64 w-full px-4 pb-2">
        {renderChart()}
      </div>

      {/* Seamless Footer: Explanation */}
      {chartData.explanation && (
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex gap-3 items-start">
          <div className="mt-0.5 min-w-[16px]">
            <svg 
              className="w-4 h-4 text-blue-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {chartData.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
