'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000)
        })
        .catch(() => {})

      const handleOnline = () => {
        if ('sync' in navigator.serviceWorker) {
          navigator.serviceWorker.ready.then((registration) => {
            ;(registration as any).sync?.register('sync-reading-progress')
            ;(registration as any).sync?.register('sync-annotations')
          })
        }
      }

      window.addEventListener('online', handleOnline)

      return () => {
        window.removeEventListener('online', handleOnline)
      }
    }
  }, [])

  return null
}
