'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useSession } from '@/components/providers/SessionProvider'
import { usePathname } from 'next/navigation'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading } = useSession()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
        )
    }

    // Auth middleware checks session, we return null to avoid flash of dashboard
    if (!user) return null

    // Determine dynamic title for header based on current route
    let title = 'Dashboard'
    if (pathname === '/library') title = 'Library'
    else if (pathname === '/subjects') title = 'Subjects'
    else if (pathname?.startsWith('/folders/')) title = 'Folders'
    else if (pathname === '/analytics') title = 'Analytics'
    else if (pathname?.startsWith('/documents/')) title = 'Reviewing Document'

    const sidebarUser = {
        name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'User',
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url as string | null | undefined,
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar navigation */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                user={sidebarUser}
            />

            {/* Main app layout area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header
                    title={title}
                    onMenuClick={() => setSidebarOpen(true)}
                />

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
