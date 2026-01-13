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
  Legend
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
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { family: "'Inter', sans-serif", size: 11 }
        }
      },
      title: {
        display: true,
        text: chartData.title,
        font: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
        color: '#1e293b', // slate-800
        padding: { bottom: 20 }
      },
    },
    scales: {
      y: {
        grid: { color: '#f1f5f9' }, // slate-100
        ticks: { font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  };

  const renderChart = () => {
    switch (chartData.chartType) {
      case 'line': return <Line options={options as any} data={chartData.data} />;
      case 'bar': return <Bar options={options as any} data={chartData.data} />;
      case 'pie': return <Pie options={options as any} data={chartData.data} />;
      case 'doughnut': return <Doughnut options={options as any} data={chartData.data} />;
      default: return <p className="text-red-500 text-sm">Unsupported chart type</p>;
    }
  };

  return (
    <div className="w-full">
      <div className="relative h-64 w-full">
        {renderChart()}
      </div>
      {chartData.explanation && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex gap-2 items-start">
            <span className="text-blue-500 text-lg leading-none">💡</span>
            <p className="text-xs text-slate-600 leading-relaxed">
              {chartData.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}