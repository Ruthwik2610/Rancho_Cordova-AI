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

// Register Chart.js components globally for this component
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
      },
      title: {
        display: true,
        text: chartData.title,
      },
    },
  };

  const renderChart = () => {
    switch (chartData.chartType) {
      case 'line':
        return <Line options={options} data={chartData.data} />;
      case 'bar':
        return <Bar options={options} data={chartData.data} />;
      case 'pie':
        return <Pie options={options} data={chartData.data} />;
      case 'doughnut':
        return <Doughnut options={options} data={chartData.data} />;
      default:
        return <p className="text-red-500">Unsupported chart type</p>;
    }
  };

  return (
    <div className="w-full mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 h-72">
        {renderChart()}
      </div>
      {chartData.explanation && (
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
            💡 {chartData.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
