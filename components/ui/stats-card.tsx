import { Card } from "./card"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  valueColor?: string
  icon?: React.ReactNode
  trend?: string
  trendColor?: string
}

export function StatsCard({
  title,
  value,
  valueColor = "text-gray-900",
  icon,
  trend,
  trendColor = "text-gray-500"
}: StatsCardProps) {
  return (
    <Card className="p-6 bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
          {trend && (
            <p className={`text-sm font-medium mt-1 ${trendColor}`}>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-gray-50 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
} 