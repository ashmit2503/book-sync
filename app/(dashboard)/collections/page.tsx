'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCollections, useTags, Collection, Tag } from '@/lib/hooks/useLibrary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  FolderOpen,
  Tag as TagIcon,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TAG_COLORS = [
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
]

export default function CollectionsPage() {
  const {
    collections,
    isLoading: collectionsLoading,
    createCollection,
    updateCollection,
    deleteCollection,
  } = useCollections()

  const {
    tags,
    isLoading: tagsLoading,
    createTag,
    updateTag,
    deleteTag,
  } = useTags()

  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editCollectionName, setEditCollectionName] = useState('')
  const [editCollectionDesc, setEditCollectionDesc] = useState('')
  const [isCreatingCollection, setIsCreatingCollection] = useState(false)
  const [showNewCollection, setShowNewCollection] = useState(false)

  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6b7280')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('')
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const [showNewTag, setShowNewTag] = useState(false)

  // Collection handlers
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    setIsCreatingCollection(true)
    await createCollection(newCollectionName.trim(), newCollectionDesc.trim() || undefined)
    setNewCollectionName('')
    setNewCollectionDesc('')
    setShowNewCollection(false)
    setIsCreatingCollection(false)
  }

  const handleUpdateCollection = async (id: string) => {
    if (!editCollectionName.trim()) return
    await updateCollection(id, {
      name: editCollectionName.trim(),
      description: editCollectionDesc.trim() || null,
    })
    setEditingCollectionId(null)
  }

  const handleDeleteCollection = async (id: string) => {
    if (confirm('Are you sure you want to delete this collection? Books will not be deleted.')) {
      await deleteCollection(id)
    }
  }

  // Tag handlers
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    setIsCreatingTag(true)
    await createTag(newTagName.trim(), newTagColor)
    setNewTagName('')
    setNewTagColor('#6b7280')
    setShowNewTag(false)
    setIsCreatingTag(false)
  }

  const handleUpdateTag = async (id: string) => {
    if (!editTagName.trim()) return
    await updateTag(id, { name: editTagName.trim(), color: editTagColor })
    setEditingTagId(null)
  }

  const handleDeleteTag = async (id: string) => {
    if (confirm('Are you sure you want to delete this tag?')) {
      await deleteTag(id)
    }
  }

  const startEditCollection = (collection: Collection) => {
    setEditingCollectionId(collection.id)
    setEditCollectionName(collection.name)
    setEditCollectionDesc(collection.description || '')
  }

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditTagName(tag.name)
    setEditTagColor(tag.color)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Collections & Tags</h1>
        <p className="mt-2 text-muted-foreground">
          Organize your library with collections and tags
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Collections Section */}
        <div className="rounded-lg border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <FolderOpen className="h-5 w-5" />
              Collections
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewCollection(true)}
              disabled={showNewCollection}
            >
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          </div>

          {/* New Collection Form */}
          {showNewCollection && (
            <div className="mb-4 rounded-lg border bg-muted/50 p-4">
              <Input
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                className="mb-2"
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                className="mb-3"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewCollection(false)
                    setNewCollectionName('')
                    setNewCollectionDesc('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim() || isCreatingCollection}
                >
                  {isCreatingCollection ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          )}

          {/* Collections List */}
          {collectionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : collections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 h-10 w-10 opacity-50" />
              <p>No collections yet</p>
              <p className="text-sm">Create one to organize your books</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((collection) =>
                editingCollectionId === collection.id ? (
                  <div key={collection.id} className="rounded-lg border bg-muted/50 p-3">
                    <Input
                      value={editCollectionName}
                      onChange={(e) => setEditCollectionName(e.target.value)}
                      className="mb-2"
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={editCollectionDesc}
                      onChange={(e) => setEditCollectionDesc(e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCollectionId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateCollection(collection.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <Link
                      href={`/library?collection=${collection.id}`}
                      className="flex flex-1 items-center gap-3"
                    >
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{collection.name}</div>
                        {collection.description && (
                          <div className="text-sm text-muted-foreground">
                            {collection.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {collection.book_count || 0} books
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEditCollection(collection)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => handleDeleteCollection(collection.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="rounded-lg border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <TagIcon className="h-5 w-5" />
              Tags
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewTag(true)}
              disabled={showNewTag}
            >
              <Plus className="mr-1 h-4 w-4" />
              New
            </Button>
          </div>

          {/* New Tag Form */}
          {showNewTag && (
            <div className="mb-4 rounded-lg border bg-muted/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <div
                        className="h-5 w-5 rounded"
                        style={{ backgroundColor: newTagColor }}
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setNewTagColor(color.value)}
                          className="h-6 w-6 rounded transition-transform hover:scale-110"
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewTag(false)
                    setNewTagName('')
                    setNewTagColor('#6b7280')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreatingTag}
                >
                  {isCreatingTag ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-4 w-4" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          )}

          {/* Tags List */}
          {tagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <TagIcon className="mx-auto mb-2 h-10 w-10 opacity-50" />
              <p>No tags yet</p>
              <p className="text-sm">Create tags to categorize your books</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) =>
                editingTagId === tag.id ? (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1"
                  >
                    <Input
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      className="h-6 w-24 px-1 text-sm"
                      autoFocus
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-4 w-4 rounded-full" style={{ backgroundColor: editTagColor }} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <div className="grid grid-cols-4 gap-1 p-2">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color.value}
                              onClick={() => setEditTagColor(color.value)}
                              className="h-6 w-6 rounded transition-transform hover:scale-110"
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={() => setEditingTagId(null)}>
                      <X className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleUpdateTag(tag.id)}>
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-1 rounded-full px-3 py-1"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm font-medium">{tag.name}</span>
                    <span className="text-xs opacity-70">({tag.book_count || 0})</span>
                    <button
                      onClick={() => startEditTag(tag)}
                      className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Help */}
      <div className="mt-8 rounded-lg border bg-muted/50 p-6">
        <h3 className="mb-3 font-semibold">How to use</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Collections</strong> group books into folders. Each book can belong to
              multiple collections.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Tags</strong> are color-coded labels for quick categorization. Add tags
              to books from the library view.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Filter your library by collection or tags using the dropdowns on the library
              page.
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
