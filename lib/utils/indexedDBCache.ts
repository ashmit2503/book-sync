'use client'

const DB_VERSION = 1
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CachedItem {
  bookId: string
  data: ArrayBuffer
  timestamp: number
}

interface CacheConfig {
  dbName: string
  storeName: string
}

const EPUB_CACHE: CacheConfig = { dbName: 'booksync-epub-cache', storeName: 'epubs' }
const PDF_CACHE: CacheConfig = { dbName: 'booksync-pdf-cache', storeName: 'pdfs' }

function openDB(config: CacheConfig): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(config.dbName, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(config.storeName)) {
        db.createObjectStore(config.storeName, { keyPath: 'bookId' })
      }
    }
  })
}

async function getCached(config: CacheConfig, bookId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB(config)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(config.storeName, 'readonly')
      const store = transaction.objectStore(config.storeName)
      const request = store.get(bookId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result as CachedItem | undefined
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

async function setCache(config: CacheConfig, bookId: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB(config)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(config.storeName, 'readwrite')
      const store = transaction.objectStore(config.storeName)
      const request = store.put({ bookId, data, timestamp: Date.now() })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch {
    // Caching is optional — silently fail
  }
}

// EPUB cache
export const getCachedEPUB = (bookId: string) => getCached(EPUB_CACHE, bookId)
export const cacheEPUB = (bookId: string, data: ArrayBuffer) => setCache(EPUB_CACHE, bookId, data)

// PDF cache
export const getCachedPDF = (bookId: string) => getCached(PDF_CACHE, bookId)
export const cachePDF = (bookId: string, data: ArrayBuffer) => setCache(PDF_CACHE, bookId, data)
