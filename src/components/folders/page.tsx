'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, FolderPlus, Plus, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FolderTree, type FolderNode } from '@/components/folders/FolderTree'
import { CreateFolderModal } from '@/components/folders/CreateFolderModal'
import { DocumentCard, type DocumentCardData } from '@/components/documents/DocumentCard'
import { UploadModal } from '@/components/documents/UploadModal'
import { Button } from '@/components/ui/Button'

interface SubjectInfo {
  id: string
  name: string
  color: string
}

interface DocumentRow {
  id: string
  title: string
  file_type: 'pdf' | 'ppt' | 'pptx'
  current_stage: number
  next_review_date: string
  last_reviewed_at: string | null
  uploaded_at: string
  folder_id: string | null
}

export default function FoldersPage() {
  const params = useParams<{ subject_id: string }>()
  const subjectId = params.subject_id
  const router = useRouter()
  const supabase = createClient()

  const [subject, setSubject] = useState<SubjectInfo | null>(null)
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  // --- Load subject + folder tree (with document counts) ------------------

  async function fetchFoldersAndSubject() {
    const { data: subjectData } = await supabase
      .from('subjects')
      .select('id, name, color')
      .eq('id', subjectId)
      .single()

    if (subjectData) setSubject(subjectData)

    const { data: folderData } = await (supabase
      .from('folders') as any)
      .select('id, title, parent_id, documents(count)')
      .eq('subject_id', subjectId)
      .order('title', { ascending: true })

    if (folderData) {
      setFolders(
        folderData.map((f: any) => ({
          id: f.id,
          name: f.title,
          parent_id: f.parent_id,
          documentCount:
            (f.documents as unknown as { count: number }[])?.[0]?.count ?? 0,
        }))
      )
    }
  }

  useEffect(() => {
    fetchFoldersAndSubject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId])

  // --- Load documents for the selected folder (or the whole subject) ------

  async function fetchDocuments() {
    setLoadingDocs(true)

    let query = supabase
      .from('documents')
      .select(
        'id, title, file_type, current_stage, next_review_date, last_reviewed_at, uploaded_at, folder_id'
      )
      .eq('subject_id', subjectId)
      .is('deleted_at', null)
      .order('next_review_date', { ascending: true })

    if (selectedFolderId) {
      query = query.eq('folder_id', selectedFolderId)
    }

    const { data } = await query
    setDocuments(data ?? [])
    setLoadingDocs(false)
  }

  useEffect(() => {
    fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, selectedFolderId])

  // --- Breadcrumb: Subject > Folder > Subfolder ----------------------------

  const breadcrumbFolders = useMemo(() => {
    if (!selectedFolderId) return []

    const chain: FolderNode[] = []
    let current = folders.find((f) => f.id === selectedFolderId)
    while (current) {
      chain.unshift(current)
      const parentId = current.parent_id
      current = parentId ? folders.find((f) => f.id === parentId) : undefined
    }
    return chain
  }, [selectedFolderId, folders])

  const cards: (DocumentCardData & { id: string })[] = documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    fileType: doc.file_type,
    subject: { name: subject?.name ?? '', color: subject?.color ?? '#94a3b8' },
    currentStage: doc.current_stage,
    nextReviewDate: doc.next_review_date,
    lastReviewedAt: doc.last_reviewed_at,
    uploadedAt: doc.uploaded_at,
  }))

  async function handleDeleteDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    await (supabase
      .from('documents') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }

  async function handleUploadComplete(documentId: string) {
    // Assign the freshly uploaded document to the currently selected folder, if any.
    if (selectedFolderId) {
      await (supabase
        .from('documents') as any)
        .update({ folder_id: selectedFolderId })
        .eq('id', documentId)
    }
    await fetchFoldersAndSubject()
    await fetchDocuments()
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Subject header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {subject && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
              aria-hidden="true"
            />
          )}
          <h1 className="text-2xl font-semibold text-slate-900">
            {subject?.name ?? 'Loading…'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCreateFolderOpen(true)}>
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            Create Folder
          </Button>
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
        <button
          type="button"
          onClick={() => setSelectedFolderId(null)}
          className={!selectedFolderId ? 'font-medium text-slate-900' : 'hover:text-slate-700'}
        >
          {subject?.name ?? 'Subject'}
        </button>
        {breadcrumbFolders.map((folder, i) => (
          <span key={folder.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setSelectedFolderId(folder.id)}
              className={
                i === breadcrumbFolders.length - 1
                  ? 'font-medium text-slate-900'
                  : 'hover:text-slate-700'
              }
            >
              {folder.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Tree (1/3) + document list (2/3) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-1/3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <FolderTree
              folders={folders}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
            />
          </div>
        </aside>

        <div className="min-w-0 lg:w-2/3">
          {loadingDocs ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-slate-700">No documents here</p>
              <p className="text-sm text-slate-500">
                Upload a PDF to this {selectedFolderId ? 'folder' : 'subject'}.
              </p>
              <Button variant="primary" size="sm" className="mt-2" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Upload Document
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <DocumentCard
                  key={card.id}
                  document={card}
                  onOpen={() => router.push(`/review/${card.id}`)}
                  onDelete={() => handleDeleteDocument(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateFolderModal
        isOpen={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        subjectId={subjectId}
        initialParentId={selectedFolderId}
        onCreated={() => fetchFoldersAndSubject()}
      />

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}