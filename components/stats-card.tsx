import { RefreshCw } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string
  comparison?: string
  valueColor?: string
}

export function StatsCard({
  title,
  value,
  comparison = "vs. Previous month",
  valueColor = "text-blue-500",
}: StatsCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-700 font-medium">{title}</h3>
        <button className="text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>
      <div className={`text-3xl font-bold ${valueColor} mb-2`}>{value}</div>
      <div className="text-sm text-gray-500">{comparison}</div>
    </div>
  )
}

