'use client'

interface ActivityChartProps {
  data: Array<{
    hour: number
    active: number
    idle: number
  }>
}

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-64 flex items-end justify-between space-x-1">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div className="w-full bg-blue-200 rounded-t" style={{ height: `${(item.active / 60) * 100}%` }}></div>
          <div className="w-full bg-gray-200" style={{ height: `${(item.idle / 60) * 100}%` }}></div>
          <span className="text-xs text-gray-500 mt-1">{item.hour}:00</span>
        </div>
      ))}
    </div>
  )
} 