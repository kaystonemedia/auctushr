import React from 'react'
import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'full' | 'icon' | 'text'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showText?: boolean
}

export function Logo({ 
  variant = 'full', 
  size = 'md', 
  className,
  showText = true 
}: LogoProps) {
  const sizeClasses = {
    sm: {
      icon: 'w-6 h-6',
      text: 'text-sm',
      gap: 'gap-2',
      iconText: 'text-xs'
    },
    md: {
      icon: 'w-8 h-8',
      text: 'text-lg',
      gap: 'gap-3',
      iconText: 'text-sm'
    },
    lg: {
      icon: 'w-10 h-10',
      text: 'text-xl',
      gap: 'gap-3',
      iconText: 'text-base'
    },
    xl: {
      icon: 'w-12 h-12',
      text: 'text-2xl',
      gap: 'gap-4',
      iconText: 'text-lg'
    }
  }

  const currentSize = sizeClasses[size]

  if (variant === 'icon') {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20',
        currentSize.icon,
        className
      )}>
        <span className={cn('text-white font-bold', currentSize.iconText)}>A</span>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <div className={cn(
        'font-bold text-corporate-navy tracking-tight',
        currentSize.text,
        className
      )}>
        Auctushr
      </div>
    )
  }

  return (
    <div className={cn(
      'flex items-center',
      currentSize.gap,
      className
    )}>
      <div className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20 transition-all duration-200 hover:shadow-xl hover:scale-105',
        currentSize.icon
      )}>
        <span className={cn('text-white font-bold', currentSize.iconText)}>A</span>
      </div>
      {showText && (
        <div className={cn(
          'font-bold text-corporate-navy tracking-tight',
          currentSize.text
        )}>
          Auctushr
        </div>
      )}
    </div>
  )
}

// Specialized logo variants for different contexts
export function SidebarLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20 flex items-center justify-center">
        <span className="text-white font-bold text-base">A</span>
      </div>
      <div className="text-xl font-bold text-white tracking-tight">
        Auctushr
      </div>
    </div>
  )
}

export function HeaderLogo({ className, size = 'lg' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl', 
    lg: 'text-xl',
    xl: 'text-2xl'
  }
  
  return (
    <div className={cn(
      'font-bold text-corporate-navy tracking-tight',
      sizeClasses[size],
      className
    )}>
      Auctushr
    </div>
  )
}

export function AuthLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20 flex items-center justify-center">
          <span className="text-white font-bold text-lg">A</span>
        </div>
        <div className="text-2xl font-bold text-corporate-navy tracking-tight">
        Auctushr
      </div>
    </div>
  )
}

export function FaviconLogo({ className }: { className?: string }) {
  return (
    <div className={cn(
      'flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-mint via-emerald-500 to-corporate-navy shadow-lg ring-2 ring-emerald-mint/20',
      'w-8 h-8',
      className
    )}>
      <span className="text-white font-bold text-sm">A</span>
    </div>
  )
}

// Compact logo for small spaces
export function CompactLogo({ className }: { className?: string }) {
  return (
    <Logo 
      variant="icon" 
      size="sm" 
      className={className}
    />
  )
}

// Logo with tagline
export function LogoWithTagline({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <Logo variant="full" size="lg" />
      <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">HR Management</p>
    </div>
  )
}
