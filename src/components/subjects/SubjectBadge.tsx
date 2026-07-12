'use client'

export interface SubjectBadgeProps {
  name: string
  color: string
  onClick?: () => void
}

export function SubjectBadge({ name, color, onClick }: SubjectBadgeProps) {
  const content = (
    <>
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </>
  )

  if (!onClick) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
    >
      {content}
    </button>
  )
}