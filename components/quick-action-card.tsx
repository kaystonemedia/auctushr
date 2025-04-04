import type React from "react"
import Link from "next/link"

interface QuickActionCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  color: string
  progress?: number
  href?: string
}

export function QuickActionCard({ title, subtitle, icon, color, progress, href }: QuickActionCardProps) {
  const CardContent = () => (
    <div className={`${color} p-4 rounded-lg text-center`}>
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-white/80 mb-6">{subtitle}</p>

      <div className="flex justify-center mb-2">
        {progress !== undefined ? (
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="white"
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                transform="rotate(-90 50 50)"
                strokeLinecap="round"
              />
              <text x="50" y="55" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">
                {progress}%
              </text>
            </svg>
          </div>
        ) : (
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">{icon}</div>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:scale-105">
        <CardContent />
      </Link>
    )
  }

  return <CardContent />
}

