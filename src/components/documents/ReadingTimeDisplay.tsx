import { Clock } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

export interface ReadingTimeDisplayProps {
  elapsedSeconds: number
  className?: string
}

/** Small, non-intrusive "1h 23m" session-time readout. */
export function ReadingTimeDisplay({ elapsedSeconds, className }: ReadingTimeDisplayProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs text-slate-400 tabular-nums', className)}
      title="Time spent reading this session"
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {formatDuration(elapsedSeconds)}
    </span>
  )
}