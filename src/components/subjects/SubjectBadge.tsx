import { cn } from '@/lib/utils'

export type SubjectBadgeSize = 'sm' | 'md' | 'lg'

export interface SubjectBadgeProps {
  name: string
  color: string
  onClick?: () => void
  size?: SubjectBadgeSize
  className?: string
}

const dotSizes: Record<SubjectBadgeSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

const textSizes: Record<SubjectBadgeSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
}

const gapSizes: Record<SubjectBadgeSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2',
}

/**
 * Displays a subject as a colored dot + its name.
 * Renders as a <button> when `onClick` is provided, otherwise a plain <span>.
 *
 * @example
 * <SubjectBadge name="Mathematics" color="#ef4444" />
 * <SubjectBadge name="Physics" color="#3b82f6" size="lg" onClick={() => setActive('physics')} />
 */
export function SubjectBadge({ name, color, onClick, size = 'md', className }: SubjectBadgeProps) {
  const content = (
    <>
      <span
        className={cn('shrink-0 rounded-full', dotSizes[size])}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className={cn('truncate font-medium text-slate-700', textSizes[size])}>{name}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-1 transition-colors',
          'hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
          gapSizes[size],
          className
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={cn('inline-flex items-center', gapSizes[size], className)}>{content}</span>
  )
}