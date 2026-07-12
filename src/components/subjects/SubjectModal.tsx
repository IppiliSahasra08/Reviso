'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

export interface SubjectFormData {
  name: string
  color: string
}

export interface SubjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SubjectFormData) => void | Promise<void>
  /** Pass the subject being edited to switch the modal into edit mode. */
  initialData?: SubjectFormData | null
}

export const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
] as const

const DEFAULT_COLOR = PRESET_COLORS[4].value // blue

export function SubjectModal({ isOpen, onClose, onSave, initialData = null }: SubjectModalProps) {
  const isEditMode = Boolean(initialData)

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset the form each time the modal transitions from closed -> open
  // (covers both create and edit). Adjusting state during render, rather
  // than in an effect, avoids an extra render pass on open.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setName(initialData?.name ?? '')
      setColor(initialData?.color ?? DEFAULT_COLOR)
      setError(null)
      setSaving(false)
    }
  }

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter a subject name.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      await onSave({ name: trimmed, color })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Edit Subject' : 'Add Subject'}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSave()
            }
          }}
          placeholder="e.g. Mathematics"
          error={error ?? undefined}
          disabled={saving}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Color</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => {
              const isSelected = preset.value === color
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  aria-label={preset.name}
                  aria-pressed={isSelected}
                  disabled={saving}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-transform',
                    'hover:scale-110 focus:outline-none disabled:pointer-events-none disabled:opacity-50',
                    isSelected && 'ring-2 ring-offset-2'
                  )}
                  style={{
                    backgroundColor: preset.value,
                    ...(isSelected ? { ['--tw-ring-color' as string]: preset.value } : {}),
                  }}
                >
                  {isSelected && <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {isEditMode ? 'Save Changes' : 'Create Subject'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}