'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface DepartmentData {
  department: string
  value: number
  color: string
}

interface DepartmentChartProps {
  title: string
  data: DepartmentData[]
  maxValue?: number
}

export function DepartmentChart({ title, data, maxValue = 100 }: DepartmentChartProps) {
  const chartData = {
    labels: data.map(item => item.department),
    datasets: [
      {
        label: title,
        data: data.map(item => item.value),
        backgroundColor: data.map(item => item.color),
        borderRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 600,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: maxValue,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
    },
  }

  return (
    <div className="h-[300px]">
      <Bar data={chartData} options={options} />
    </div>
  )
} 