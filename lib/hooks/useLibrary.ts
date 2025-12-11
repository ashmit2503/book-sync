'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Collection {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  book_count?: number
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
  book_count?: number
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  // Load collections
  useEffect(() => {
    async function loadCollections() {
      setIsLoading(true)

      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      // Get collections with book counts
      const { data, error } = await supabaseRef.current
        .from('collections')
        .select(`
          *,
          collection_books(count)
        `)
        .eq('user_id', user.id)
        .order('name')

      if (data && !error) {
        const collectionsWithCounts = data.map((c: any) => ({
          ...c,
          book_count: c.collection_books?.[0]?.count || 0,
        }))
        setCollections(collectionsWithCounts)
      }

      setIsLoading(false)
    }

    loadCollections()
  }, [])

  // Create collection
  const createCollection = useCallback(
    async (name: string, description?: string): Promise<Collection | null> => {
      const supabase = createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error during collection creation:', authError)
        return null
      }
      if (!user) {
        console.error('No authenticated user for collection creation')
        return null
      }

      const { data, error } = await supabase
        .from('collections')
        .insert({
          user_id: user.id,
          name,
          description: description || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create collection:', error.message, error)
        return null
      }

      const newCollection: Collection = { ...data, book_count: 0 }
      setCollections((prev) => [...prev, newCollection])
      return newCollection
    },
    []
  )

  // Update collection
  const updateCollection = useCallback(
    async (collectionId: string, update: { name?: string; description?: string | null }) => {
      const { data, error } = await supabaseRef.current
        .from('collections')
        .update(update)
        .eq('id', collectionId)
        .select()
        .single()

      if (error) {
        console.error('Failed to update collection:', error)
        return null
      }

      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, ...data } : c))
      )
      return data
    },
    []
  )

  // Delete collection
  const deleteCollection = useCallback(
    async (collectionId: string) => {
      const { error } = await supabaseRef.current
        .from('collections')
        .delete()
        .eq('id', collectionId)

      if (error) {
        console.error('Failed to delete collection:', error)
        return false
      }

      setCollections((prev) => prev.filter((c) => c.id !== collectionId))
      return true
    },
    []
  )

  // Add book to collection
  const addBookToCollection = useCallback(
    async (collectionId: string, bookId: string) => {
      const { error } = await supabaseRef.current
        .from('collection_books')
        .insert({
          collection_id: collectionId,
          book_id: bookId,
        })

      if (error) {
        if (error.code === '23505') {
          // Duplicate key - book already in collection
          return true
        }
        console.error('Failed to add book to collection:', error)
        return false
      }

      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, book_count: (c.book_count || 0) + 1 }
            : c
        )
      )
      return true
    },
    []
  )

  // Remove book from collection
  const removeBookFromCollection = useCallback(
    async (collectionId: string, bookId: string) => {
      const { error } = await supabaseRef.current
        .from('collection_books')
        .delete()
        .eq('collection_id', collectionId)
        .eq('book_id', bookId)

      if (error) {
        console.error('Failed to remove book from collection:', error)
        return false
      }

      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, book_count: Math.max(0, (c.book_count || 0) - 1) }
            : c
        )
      )
      return true
    },
    []
  )

  // Get books in collection
  const getBooksInCollection = useCallback(
    async (collectionId: string) => {
      const { data, error } = await supabaseRef.current
        .from('collection_books')
        .select('book_id, books(*)')
        .eq('collection_id', collectionId)

      if (error) {
        console.error('Failed to get books in collection:', error)
        return []
      }

      return data?.map((item: any) => item.books) || []
    },
    []
  )

  // Get collections for a book
  const getCollectionsForBook = useCallback(
    async (bookId: string) => {
      const { data, error } = await supabaseRef.current
        .from('collection_books')
        .select('collection_id')
        .eq('book_id', bookId)

      if (error) {
        console.error('Failed to get collections for book:', error)
        return []
      }

      return data?.map((item) => item.collection_id) || []
    },
    []
  )

  return {
    collections,
    isLoading,
    createCollection,
    updateCollection,
    deleteCollection,
    addBookToCollection,
    removeBookFromCollection,
    getBooksInCollection,
    getCollectionsForBook,
  }
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  // Load tags
  useEffect(() => {
    async function loadTags() {
      setIsLoading(true)

      const { data: { user } } = await supabaseRef.current.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      // Get tags with book counts
      const { data, error } = await supabaseRef.current
        .from('tags')
        .select(`
          *,
          book_tags(count)
        `)
        .eq('user_id', user.id)
        .order('name')

      if (data && !error) {
        const tagsWithCounts = data.map((t: any) => ({
          ...t,
          book_count: t.book_tags?.[0]?.count || 0,
        }))
        setTags(tagsWithCounts)
      }

      setIsLoading(false)
    }

    loadTags()
  }, [])

  // Create tag via API route (server-side Supabase handles auth/RLS)
  const createTag = useCallback(
    async (name: string, color?: string): Promise<Tag | null> => {
      if (!name.trim()) return null

      try {
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: name.trim(), color }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          console.error('Tag creation failed:', err)
          return null
        }

        const result = await response.json()
        const tag = result?.tag as Tag | undefined

        if (!tag) {
          console.error('Tag creation missing tag in response', result)
          return null
        }

        const newTag: Tag = { ...tag, book_count: 0 }
        setTags((prev) => (prev.some(t => t.id === newTag.id) ? prev : [...prev, newTag]))
        return newTag
      } catch (err) {
        console.error('Tag creation exception:', err)
        return null
      }
    },
    []
  )

  // Update tag
  const updateTag = useCallback(
    async (tagId: string, update: { name?: string; color?: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tags')
        .update(update)
        .eq('id', tagId)
        .select()
        .single()

      if (error) {
        console.error('Failed to update tag:', error)
        return null
      }

      setTags((prev) =>
        prev.map((t) => (t.id === tagId ? { ...t, ...data } : t))
      )
      return data
    },
    []
  )

  // Delete tag
  const deleteTag = useCallback(
    async (tagId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)

      if (error) {
        console.error('Failed to delete tag:', error)
        return false
      }

      setTags((prev) => prev.filter((t) => t.id !== tagId))
      return true
    },
    []
  )

  // Add tag to book
  const addTagToBook = useCallback(
    async (bookId: string, tagId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('book_tags')
        .insert({
          book_id: bookId,
          tag_id: tagId,
        })

      if (error) {
        if (error.code === '23505') {
          // Duplicate - tag already on book
          return true
        }
        console.error('Failed to add tag to book:', error)
        return false
      }

      setTags((prev) =>
        prev.map((t) =>
          t.id === tagId ? { ...t, book_count: (t.book_count || 0) + 1 } : t
        )
      )
      return true
    },
    []
  )

  // Remove tag from book
  const removeTagFromBook = useCallback(
    async (bookId: string, tagId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('book_tags')
        .delete()
        .eq('book_id', bookId)
        .eq('tag_id', tagId)

      if (error) {
        console.error('Failed to remove tag from book:', error)
        return false
      }

      setTags((prev) =>
        prev.map((t) =>
          t.id === tagId
            ? { ...t, book_count: Math.max(0, (t.book_count || 0) - 1) }
            : t
        )
      )
      return true
    },
    []
  )

  // Get tags for a book
  const getTagsForBook = useCallback(
    async (bookId: string) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('book_tags')
        .select('tag_id, tags(*)')
        .eq('book_id', bookId)

      if (error) {
        console.error('Failed to get tags for book:', error)
        return []
      }

      return data?.map((item: any) => item.tags) || []
    },
    []
  )

  return {
    tags,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    addTagToBook,
    removeTagFromBook,
    getTagsForBook,
  }
}
