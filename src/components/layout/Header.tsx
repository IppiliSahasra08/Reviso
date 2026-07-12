'use client'

import { useState } from 'react'
import { Menu, Search, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HeaderProps {
  title: string
  onMenuClick: () => void
  /** Called on submit / Enter with the current search query. */
  onSearch?: (query: string) => void
  /** Shows a red dot on the bell when true. */
  hasUnreadNotifications?: boolean
  onNotificationsClick?: () => void
}

export function Header({
  title,
  onMenuClick,
  onSearch,
  hasUnreadNotifications = false,
  onNotificationsClick,
}: HeaderProps) {
  const [query, setQuery] = useState('')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSearch?.(query)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <h1 className="shrink-0 text-lg font-semibold text-slate-900">{title}</h1>

      <form onSubmit={handleSubmit} className="ml-2 hidden flex-1 max-w-md sm:block">
        <label htmlFor="global-search" className="sr-only">
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="global-search"
            type="search"
            placeholder="Search documents, subjects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onNotificationsClick}
          aria-label="Notifications"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {hasUnreadNotifications && (
            <span
              className={cn(
                'absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white'
              )}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </header>
  )
}