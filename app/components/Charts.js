'use client';

import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ChartRenderer({ chart }) {
  if (!chart || !chart.data) return null;

  return (
    <div className="mt-4 mb-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-72 w-full max-w-lg">
      <h4 className="text-sm font-bold text-gray-700 mb-4 text-center">{chart.title}</h4>
      <ResponsiveContainer width="100%" height="90%">
        {chart.type === 'line' ? (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey || 'name'} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={chart.dataKey || 'value'} stroke="#0088FE" strokeWidth={2} />
          </LineChart>
        ) : chart.type === 'pie' ? (
          <PieChart>
            <Pie
              data={chart.data}
              cx="50%" cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label
            >
              {chart.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey || 'name'} style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={chart.dataKey || 'value'} fill="#00C49F" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}