import type { Folder } from '@/types/database'

export interface FolderNode {
    id: string
    name: string
    parent_id: string | null
    documentCount: number
}

export interface FlatFolderOption {
    id: string
    title: string
    depth: number
}

/**
 * Builds a flat list of FolderNodes from Database Folder rows, computing
 * recursive document counts for each folder if ownFileCounts is provided.
 */
export function buildFolderTree(
    folders: Folder[],
    ownFileCounts: Record<string, number> = {}
): FolderNode[] {
    const nodes: FolderNode[] = folders.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
        documentCount: ownFileCounts[f.id] || 0,
    }))

    // Recursive count helper
    function getRecursiveCount(folderId: string): number {
        const directCount = ownFileCounts[folderId] || 0
        const children = folders.filter((f) => f.parent_id === folderId)
        const childrenCount = children.reduce(
            (acc, child) => acc + getRecursiveCount(child.id),
            0
        )
        return directCount + childrenCount
    }

    // Update documentCount recursively for each node
    for (const node of nodes) {
        node.documentCount = getRecursiveCount(node.id)
    }

    return nodes
}

/**
 * Finds a folder node within the flat FolderNode list by ID.
 */
export function findFolderNode(
    nodes: FolderNode[],
    id: string
): FolderNode | undefined {
    return nodes.find((n) => n.id === id)
}

/**
 * Generates an array of breadcrumb segments from the active folder up to the subject root.
 * Trail format: [{ id: null, title: rootTitle }, ...parents, active]
 */
export function getBreadcrumbTrail(
    nodes: FolderNode[],
    selectedId: string | null,
    rootTitle: string
): { id: string | null; title: string }[] {
    const trail: { id: string | null; title: string }[] = []

    if (!selectedId) {
        return [{ id: null, title: rootTitle }]
    }

    let currentId: string | null = selectedId
    while (currentId) {
        const node = nodes.find((n) => n.id === currentId)
        if (!node) break
        trail.push({ id: node.id, title: node.name })
        currentId = node.parent_id
    }

    trail.reverse()
    return [{ id: null, title: rootTitle }, ...trail]
}

/**
 * Flattens a FolderNode list into a depth-sorted array of select options.
 * Sorted such that subfolders immediately succeed their parents.
 */
export function flattenFolderTree(nodes: FolderNode[]): FlatFolderOption[] {
    const result: FlatFolderOption[] = []

    function traverse(parentId: string | null, depth: number) {
        const children = nodes.filter((n) => n.parent_id === parentId)
        for (const child of children) {
            result.push({
                id: child.id,
                title: child.name, // maps to f.title in dropdown options
                depth,
            })
            traverse(child.id, depth + 1)
        }
    }

    traverse(null, 0)
    return result
}
