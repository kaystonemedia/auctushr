import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  value: string | number
  valueColor?: string
  icon?: React.ReactNode
  subtitle?: string
  trend?: string | number
  trendColor?: string
  onClick?: () => void
  className?: string
}

export function StatsCard({ 
  title, 
  value, 
  valueColor = 'text-gray-900',
  icon,
  subtitle,
  trend,
  trendColor,
  onClick,
  className
}: StatsCardProps) {
  return (
    <Card className={className} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <div className="flex items-center justify-between">
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs font-medium ${trendColor || 'text-gray-500'}`}>
              {trend}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 