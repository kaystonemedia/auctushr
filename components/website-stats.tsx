'use client'

interface WebsiteStatsProps {
  websites: Array<{
    domain: string
    time: number
    visits: number
  }>
}

export function WebsiteStats({ websites }: WebsiteStatsProps) {
  return (
    <div className="space-y-3">
      {websites.map((website, index) => (
        <div key={index} className="flex justify-between items-center">
          <div className="flex-1">
            <div className="font-medium">{website.domain}</div>
            <div className="text-sm text-gray-500">{website.visits} visits</div>
          </div>
          <div className="text-sm font-medium">
            {Math.round(website.time / 60)}m
          </div>
        </div>
      ))}
    </div>
  )
} 