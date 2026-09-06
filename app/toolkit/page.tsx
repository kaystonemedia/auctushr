'use client'

import { useMemo, useState } from 'react'
import {
  Grid3x3,
  Search,
  Video,
  Mail,
  ListTodo,
  MessageSquare,
  KeyRound,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ToolStatus = 'live' | 'coming-soon'

interface ToolItem {
  title: string
  description: string
  icon: React.ReactNode
  status: ToolStatus
  href?: string
}

interface ToolCategory {
  heading: string
  items: ToolItem[]
}

const categories: ToolCategory[] = [
  {
    heading: 'Tools',
    items: [
      {
        title: 'Auctus Meet',
        description: 'Join or start a video call with your team — no account or download needed.',
        icon: <Video className="h-5 w-5" />,
        status: 'live',
        href: 'https://meet.srv909914.hstgr.cloud/',
      },
      {
        title: 'Auctus Mail',
        description: 'Your company inbox — send, receive, and manage email from one place.',
        icon: <Mail className="h-5 w-5" />,
        status: 'live',
        href: 'https://app.titan.email/mail/',
      },
      {
        title: 'Auctus Flow',
        description: 'Plan, assign, and track work across your team — boards, deadlines, and progress in one view.',
        icon: <ListTodo className="h-5 w-5" />,
        status: 'coming-soon',
      },
      {
        title: 'Auctus Pulse',
        description: 'Team chat and channels for quick conversations, without leaving the app.',
        icon: <MessageSquare className="h-5 w-5" />,
        status: 'coming-soon',
      },
      {
        title: 'Auctus Vault',
        description: 'Securely store and share passwords for shared tools and accounts.',
        icon: <KeyRound className="h-5 w-5" />,
        status: 'live',
        href: 'https://lastpass.com/login/',
      },
    ],
  },
]

const allItems = categories.flatMap(category =>
  category.items.map(item => ({ ...item, category: category.heading }))
)

export default function ToolkitPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return categories

    return categories
      .map(category => ({
        ...category,
        items: category.items.filter(
          item =>
            item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term)
        ),
      }))
      .filter(category => category.items.length > 0)
  }, [searchTerm])

  const visibleCount = filteredCategories.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 p-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-card-foreground">
          <Grid3x3 className="h-8 w-8 text-primary" />
          Toolkit
        </h1>
        <p className="mt-2 text-muted-foreground">
          Every internal tool and resource your team needs, in one place.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search the toolkit..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {visibleCount} of {allItems.length}
          </p>
        </CardContent>
      </Card>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No tools found for "{searchTerm}"</p>
            <Button variant="outline" onClick={() => setSearchTerm('')} className="mt-4">
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        filteredCategories.map(category => (
          <div key={category.heading} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {category.heading}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map(item => (
                <Card key={item.title} className="flex flex-col transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2 text-primary">
                        {item.icon}
                      </div>
                      {item.status === 'coming-soon' && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Coming soon
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="pt-2">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-1 flex-col justify-between gap-4">
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    {item.status === 'live' && item.href ? (
                      <Button asChild className="w-full">
                        <a href={item.href} target="_blank" rel="noopener noreferrer">
                          Open tool
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled className="w-full">
                        <Lock className="mr-2 h-4 w-4" />
                        Not available yet
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Footer note */}
      <p className="pt-4 text-center text-xs text-muted-foreground">
        Internal use only &middot; More tools coming soon
      </p>
    </div>
  )
}
