import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

interface QuickActionCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  href: string
}

export function QuickActionCard({
  title,
  subtitle,
  icon,
  color,
  href
}: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-lg ${color}`}>
              {icon}
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
} 