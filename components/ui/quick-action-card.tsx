import Link from "next/link"

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
      <div className={`${color} p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1`}>
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/10 rounded-lg">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-white/80">{subtitle}</p>
          </div>
        </div>
      </div>
    </Link>
  )
} 