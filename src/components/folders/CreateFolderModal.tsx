'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import type { FolderNode } from './FolderTree'

interface SubjectOption {
  id: string
  name: string
  color: string
}

export interface CreateFolderModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Lock the modal to a specific subject (e.g. when opened from
   * /folders/[subject_id]). If omitted, a subject dropdown is shown so the
   * modal can be used from a more general context.
   */
  subjectId?: string
  /** Pre-select a parent folder, e.g. when "New subfolder" is clicked from within a folder. */
  initialParentId?: string | null
  onCreated?: (folder: { id: string; title: string; parent_id: string | null }) => void | Promise<void>
}

export function CreateFolderModal({
  isOpen,
  onClose,
  subjectId,
  initialParentId = null,
  onCreated,
}: CreateFolderModalProps) {
  const supabase = createClient()

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>(initialParentId ?? '')
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectId ?? '')
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [parentOptions, setParentOptions] = useState<FolderNode[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveSubjectId = subjectId ?? selectedSubjectId

  // Reset on open.
  useEffect(() => {
    if (!isOpen) return
    setName('')
    setParentId(initialParentId ?? '')
    setSelectedSubjectId(subjectId ?? '')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Only fetch the subject list when no subjectId is locked in.
  useEffect(() => {
    if (!isOpen || subjectId) return
    let cancelled = false

    async function loadSubjects() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('subjects')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (!cancelled && data) setSubjects(data)
    }

    loadSubjects()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subjectId])

  // Fetch existing folders for the effective subject, to populate the parent dropdown.
  useEffect(() => {
    if (!isOpen || !effectiveSubjectId) {
      setParentOptions([])
      return
    }
    let cancelled = false

    async function loadFolders() {
      const { data } = await (supabase
        .from('folders') as any)
        .select('id, title, parent_id')
        .eq('subject_id', effectiveSubjectId)
        .order('title', { ascending: true })

      if (!cancelled && data) {
        setParentOptions(
          data.map((f: any) => ({
            id: f.id,
            name: f.title,
            parent_id: f.parent_id,
            documentCount: 0,
          }))
        )
      }
    }

    loadFolders()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, effectiveSubjectId])

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Give this folder a name.')
      return
    }
    if (!effectiveSubjectId) {
      setError('Choose a subject for this folder.')
      return
    }

    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      setError('You must be signed in.')
      return
    }

    const { data, error: insertError } = await (supabase
      .from('folders') as any)
      .insert({
        user_id: user.id,
        subject_id: effectiveSubjectId,
        parent_id: parentId || null,
        title: trimmedName,
      })
      .select('id, title, parent_id')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create the folder.')
      return
    }

    onCreated?.({ id: data.id, title: data.title, parent_id: data.parent_id })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create folder">
      <div className="flex flex-col gap-4">
        <Input
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Week 1 Readings"
          autoFocus
        />

        {!subjectId && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="folder-subject" className="text-sm font-medium text-slate-700">
              Subject
            </label>
            <select
              id="folder-subject"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value)
                setParentId('')
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <option value="">Choose a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="folder-parent" className="text-sm font-medium text-slate-700">
            Parent folder
          </label>
          <select
            id="folder-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={!effectiveSubjectId}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No parent (top level)</option>
            {parentOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={saving}>
            Create folder
          </Button>
        </div>
      </div>
    </Modal>
  )
}