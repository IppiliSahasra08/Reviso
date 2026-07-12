'use client'

import { useState } from 'react'
import { FolderItem, type FolderNode } from './FolderItem'

export interface FolderTreeProps {
  folders: FolderNode[]
  onSelect: (id: string | null) => void
  selectedId: string | null
  defaultExpandedIds?: string[]
}

export function FolderTree({ folders, onSelect, selectedId, defaultExpandedIds = [] }: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(defaultExpandedIds))

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const rootFolders = folders.filter((f) => f.parent_id === null)

  if (rootFolders.length === 0) {
    return <p className="px-2 py-3 text-sm text-slate-400">No folders yet.</p>
  }

  return (
    <ul role="tree" className="flex flex-col gap-0.5">
      {rootFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          allFolders={folders}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
        />
      ))}
    </ul>
  )
}

export type { FolderNode }