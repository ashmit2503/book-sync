const CACHE_NAME = 'booksync-v1'
const STATIC_ASSETS = [
  '/',
  '/library',
  '/upload',
  '/collections',
  '/offline',
]

const PRECACHE_ASSETS = [
  '/manifest.json',
]

// Install event - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname.includes('supabase')) return

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline')
          })
        })
    )
    return
  }

  // Static assets: cache-first with background update
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/) ||
    url.pathname.startsWith('/_next/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress())
  }
  if (event.tag === 'sync-annotations') {
    event.waitUntil(syncAnnotations())
  }
})

// Sync reading progress when back online
async function syncReadingProgress() {
  try {
    const db = await openOfflineDB()
    const pendingProgress = await db.getAll('pending-progress')

    for (const item of pendingProgress) {
      try {
        await fetch(`/api/books/${item.bookId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reading_progress: item.progress }),
        })
        await db.delete('pending-progress', item.id)
      } catch {
        // Will retry on next sync
      }
    }
  } catch {
    // DB not available
  }
}

// Sync annotations when back online
async function syncAnnotations() {
  try {
    const db = await openOfflineDB()
    const pendingAnnotations = await db.getAll('pending-annotations')

    for (const item of pendingAnnotations) {
      try {
        await fetch(`/api/books/${item.bookId}/annotations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.annotation),
        })
        await db.delete('pending-annotations', item.id)
      } catch {
        // Will retry on next sync
      }
    }
  } catch {
    // DB not available
  }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('booksync-offline', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      resolve({
        getAll: (store) =>
          new Promise((res, rej) => {
            const tx = db.transaction(store, 'readonly')
            const req = tx.objectStore(store).getAll()
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          }),
        delete: (store, key) =>
          new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite')
            const req = tx.objectStore(store).delete(key)
            req.onsuccess = () => res()
            req.onerror = () => rej(req.error)
          }),
      })
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('pending-progress')) {
        db.createObjectStore('pending-progress', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('pending-annotations')) {
        db.createObjectStore('pending-annotations', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: data.url,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data))
  }
})
