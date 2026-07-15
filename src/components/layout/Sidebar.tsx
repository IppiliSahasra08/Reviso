'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Library,
  BookOpen,
  BarChart3,
  X,
  BrainCircuit,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/auth/UserMenu'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]

export interface SidebarProps {
  /** Whether the off-canvas sidebar is open on mobile. Ignored on desktop, where the sidebar is always visible. */
  isOpen: boolean
  /** Called when the sidebar should close on mobile (backdrop click, link click, or the X button). */
  onClose: () => void
  user: {
    name: string
    email?: string
    avatarUrl?: string | null
  }
}

export function Sidebar({ isOpen, onClose, user }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out',
          'md:static md:z-auto md:w-64 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-semibold text-foreground">Reviso</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground md:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-ink-700 hover:bg-surface-muted hover:text-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User menu */}
        <div className="shrink-0 border-t border-border p-3">
          <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
        </div>
      </aside>
    </>
  )
}