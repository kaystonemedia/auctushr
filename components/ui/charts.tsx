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
} from 'recharts'

interface ChartData {
  name: string
  value: number
  [key: string]: any
}

interface ChartProps {
  data: ChartData[]
  height?: number
  width?: number
  className?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function BarChart({ data, height = 300, width = 500, className }: ChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineChart({ data, height = 300, width = 500, className }: ChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="value" stroke="#8884d8" />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PieChartProps extends ChartProps {
  dataKey?: string
  nameKey?: string
}

export function PieChart({
  data,
  height = 300,
  width = 500,
  className,
  dataKey = 'value',
  nameKey = 'name',
}: PieChartProps) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
} 