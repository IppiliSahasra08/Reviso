'use client'

import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbSegment {
    id: string | null
    title: string
}

interface FolderBreadcrumbProps {
    segments: BreadcrumbSegment[]
    onNavigate: (id: string | null) => void
}

export function FolderBreadcrumb({ segments, onNavigate }: FolderBreadcrumbProps) {
    return (
        <nav aria-label="Breadcrumb" className="flex items-center space-x-1 text-sm text-slate-500">
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1
                return (
                    <div key={segment.id ?? 'root'} className="flex items-center">
                        {index > 0 && <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
                        <button
                            type="button"
                            onClick={() => onNavigate(segment.id)}
                            disabled={isLast}
                            className={`hover:text-slate-800 focus:outline-none focus:underline truncate max-w-[120px] sm:max-w-[200px] ${isLast ? 'font-medium text-slate-800 cursor-default' : 'cursor-pointer'
                                }`}
                        >
                            {index === 0 && !segment.id ? (
                                <span className="flex items-center gap-1">
                                    <Home className="h-3.5 w-3.5" />
                                    {segment.title}
                                </span>
                            ) : (
                                segment.title
                            )}
                        </button>
                    </div>
                )
            })}
        </nav>
    )
}
