'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { FolderPlus, Upload, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FolderTree } from '@/components/folders/FolderTree'
import { CreateFolderModal } from '@/components/folders/CreateFolderModal'
import { FolderBreadcrumb } from '@/components/folders/FolderBreadcrumb'
import { FolderFileGrid } from '@/components/folders/FolderFileGrid'
import { UploadModal } from '@/components/documents/UploadModal'
import { buildFolderTree, findFolderNode, getBreadcrumbTrail } from '@/lib/folders'
import type { Folder, Subject } from '@/types/database'

export default function SubjectFoldersPage() {
  const params = useParams<{ subject_id: string }>()
  const subjectId = params.subject_id
  const supabase = createClient()

  const [subject, setSubject] = useState<Subject | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [ownFileCounts, setOwnFileCounts] = useState<Record<string, number>>({})
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      setLoadError('You must be signed in to view this subject.')
      return
    }

    const [subjectRes, foldersRes, docsRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('id', subjectId).eq('user_id', user.id).single(),
      supabase
        .from('folders')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id),
      // Own (non-recursive) counts are derived client-side from folder_id
      // on each document — cheap for typical library sizes, no RPC needed.
      supabase
        .from('documents')
        .select('folder_id')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id)
        .is('deleted_at', null),
    ])

    if (subjectRes.error || !subjectRes.data) {
      setLoadError(subjectRes.error?.message ?? 'Subject not found.')
      setLoading(false)
      return
    }
    if (foldersRes.error) {
      setLoadError(foldersRes.error.message)
      setLoading(false)
      return
    }

    const counts: Record<string, number> = {}
    for (const row of docsRes.data ?? []) {
      if (row.folder_id) counts[row.folder_id] = (counts[row.folder_id] ?? 0) + 1
    }

    setSubject(subjectRes.data)
    setFolders(foldersRes.data ?? [])
    setOwnFileCounts(counts)
    setLoading(false)
  }, [supabase, subjectId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const tree = useMemo(() => buildFolderTree(folders, ownFileCounts), [folders, ownFileCounts])

  const activeNode = useMemo(
    () => (selectedFolderId ? findFolderNode(tree, selectedFolderId) : null),
    [tree, selectedFolderId]
  )

  const breadcrumbSegments = useMemo(
    () => getBreadcrumbTrail(tree, selectedFolderId, subject?.name ?? 'Subject'),
    [tree, selectedFolderId, subject]
  )

  function handleFolderCreated(folder: { id: string; title: string; parent_id: string | null }) {
    setFolders((prev) => [
      ...prev,
      {
        id: folder.id,
        title: folder.title,
        parent_id: folder.parent_id,
        subject_id: subjectId,
        user_id: '', // not needed for tree rendering; refetch will fill it in accurately
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    setSelectedFolderId(folder.id)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Subject header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {subject && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: subject.color }}
                  aria-hidden="true"
                />
              )}
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {loading ? 'Loading subject…' : subject?.name ?? 'Subject'}
              </h1>
            </div>
            <FolderBreadcrumb
              segments={breadcrumbSegments}
              onNavigate={(id) => setSelectedFolderId(id)}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Create Folder
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </Button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-6">
          {loadError}
        </div>
      )}

      {/* Split body: 1/3 tree, 2/3 grid */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-3 md:w-1/3 md:border-b-0 md:border-r">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading folders…
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={
                  selectedFolderId === null
                    ? 'mb-1 flex w-full items-center rounded-lg bg-indigo-50 px-2 py-1.5 text-left text-sm font-medium text-indigo-700'
                    : 'mb-1 flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100'
                }
              >
                All files in {subject?.name ?? 'subject'}
              </button>
              <FolderTree
                tree={tree}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                defaultExpandedIds={breadcrumbSegments
                  .filter((s) => s.id)
                  .map((s) => s.id as string)}
              />
            </>
          )}
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <FolderFileGrid
            subjectId={subjectId}
            folderId={selectedFolderId}
            activeFolderTitle={activeNode?.title ?? subject?.name ?? 'This folder'}
            onUploadClick={() => setIsUploadModalOpen(true)}
          />
        </main>
      </div>

      <CreateFolderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        subjectId={subjectId}
        tree={tree}
        initialParentId={selectedFolderId}
        onCreated={handleFolderCreated}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        lockedSubjectId={subjectId}
        initialFolderId={selectedFolderId}
        onUploadComplete={() => {
          setIsUploadModalOpen(false)
          loadAll()
        }}
      />
    </div>
  )
}