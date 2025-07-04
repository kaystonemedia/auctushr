'use client'

import * as React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart as RechartsAreaChart,
} from 'recharts'

interface ChartData {
  name: string
  value: number
  [key: string]: string | number
}

interface ChartProps {
  data: ChartData[]
  height?: number
  width?: number | string
  className?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

// Custom mobile-friendly tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function BarChart({ data, height = 250, width = '100%', className }: ChartProps) {
  return (
    <div className={className} style={{ width, height: `${height}px` }}>
      <ResponsiveContainer>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            fontSize={12}
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={12} tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineChart({ data, height = 250, width = '100%', className }: ChartProps) {
  return (
    <div className={className} style={{ width, height: `${height}px` }}>
      <ResponsiveContainer>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            fontSize={12}
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={12} tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PieChartProps extends ChartProps {
  dataKey?: string
  nameKey?: string
}

export function PieChart({ data, height = 250, width = '100%', className }: ChartProps) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316']
  
  return (
    <div className={className} style={{ width, height: `${height}px` }}>
      <ResponsiveContainer>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={Math.min(height * 0.35, 80)}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AreaChart({ data, height = 250, width = '100%', className }: ChartProps) {
  return (
    <div className={className} style={{ width, height: `${height}px` }}>
      <ResponsiveContainer>
        <RechartsAreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            fontSize={12}
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={12} tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            fill="#3b82f6"
            fillOpacity={0.6}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Mobile-specific chart wrapper
export function MobileChartWrapper({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {title && <h3 className="text-lg font-medium mb-4">{title}</h3>}
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
} 