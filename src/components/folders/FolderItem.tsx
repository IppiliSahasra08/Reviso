'use client'

import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FolderNode {
  id: string
  name: string
  parent_id: string | null
  documentCount: number
}

export interface FolderItemProps {
  folder: FolderNode
  /** The full flat folder list, used to look up this folder's children. */
  allFolders: FolderNode[]
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}

const INDENT_PX = 16

export function FolderItem({
  folder,
  allFolders,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
}: FolderItemProps) {
  const children = allFolders.filter((f) => f.parent_id === folder.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(folder.id)
  const isSelected = selectedId === folder.id

  return (
    <li>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        onClick={() => onSelect(folder.id)}
        style={{ paddingLeft: depth * INDENT_PX + 8 }}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm transition-colors',
          isSelected
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-slate-600 hover:bg-slate-100'
        )}
      >
        {/* Expand/collapse arrow — reserve the space even when absent, to keep icons aligned */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggleExpand(folder.id)
          }}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400',
            hasChildren ? 'hover:bg-slate-200' : 'invisible'
          )}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            ))}
        </button>

        {/* Folder icon */}
        <span className={cn('shrink-0', isSelected ? 'text-indigo-500' : 'text-slate-400')}>
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Folder className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1 truncate">{folder.name}</span>

        {folder.documentCount > 0 && (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium',
              isSelected ? 'bg-white/70 text-indigo-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {folder.documentCount}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul role="group">
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      )}
    </li>
  )
}