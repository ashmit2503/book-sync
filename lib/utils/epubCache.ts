'use client'

const DB_NAME = 'booksync-epub-cache'
const STORE_NAME = 'epubs'
const DB_VERSION = 1
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000

interface CachedEPUB {
  bookId: string
  data: ArrayBuffer
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' })
      }
    }
  })
}

export async function getCachedEPUB(bookId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(bookId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result as CachedEPUB | undefined
        if (result && Date.now() - result.timestamp < CACHE_EXPIRY) {
          resolve(result.data)
        } else {
          resolve(null)
        }
      }
    })
  } catch {
    return null
  }
}

export async function cacheEPUB(bookId: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({
        bookId,
        data,
        timestamp: Date.now(),
      })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    // Caching is optional
  }
}
