import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isValid } from 'date-fns'
import { FileText, Presentation, File } from 'lucide-react'

/**
 * Merge Tailwind CSS classes intelligently, resolving conflicts
 * and allowing conditional class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format an ISO date string (or Date) into a human-readable format.
 * Defaults to "MMM d, yyyy" (e.g. "Jul 11, 2026").
 * Pass `relative: true` to get a relative time string (e.g. "3 days ago").
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: { pattern?: string; relative?: boolean }
): string {
  if (!date) return '—'

  const parsed = typeof date === 'string' ? new Date(date) : date

  if (!isValid(parsed)) return '—'

  if (options?.relative) {
    return formatDistanceToNow(parsed, { addSuffix: true })
  }

  return format(parsed, options?.pattern ?? 'MMM d, yyyy')
}

/**
 * Convert a duration in seconds into a compact human-readable string.
 * Examples: 90 -> "1m 30s", 4980 -> "1h 23m", 45 -> "45s"
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0s'

  const seconds = Math.floor(totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${remainingSeconds}s`
}

/**
 * Human-readable names for each spaced repetition stage.
 * Index 0 is intentionally blank (unstarted / stage 0 placeholder).
 */
export const stageNames = [
  '',
  'Day 1',
  'Day 3',
  'Week 1',
  'Month 1',
  'Quarterly',
  'Mastered',
] as const

export type StageName = (typeof stageNames)[number]

/**
 * Maps a file type extension to a corresponding Lucide React icon.
 */
export function fileTypeIcon(type: string | null | undefined) {
  switch (type?.toLowerCase()) {
    case 'pdf':
      return FileText
    case 'ppt':
    case 'pptx':
      return Presentation
    default:
      return File
  }
}

/**
 * Formats a file size in bytes into a human-readable string (e.g. "1.5 MB").
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  if (bytes < 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}