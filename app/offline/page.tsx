'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WifiOff, Home, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <WifiOff className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
        
        <h1 className="mb-4 text-3xl font-bold">You're Offline</h1>
        
        <p className="mb-8 text-muted-foreground">
          It looks like you've lost your internet connection. Don't worry - you can still
          read books that you've previously opened. They're cached for offline reading.
        </p>

        <div className="space-y-3">
          <Link href="/library" className="block">
            <Button className="w-full gap-2">
              <Home className="h-4 w-4" />
              Go to Library
            </Button>
          </Link>
          
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>

        <div className="mt-8 rounded-lg border bg-muted/50 p-4">
          <h3 className="mb-2 font-semibold">Offline Features</h3>
          <ul className="text-left text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Read previously opened books
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Your reading progress will sync when online
            </li>
            <li className="flex items-center gap-2">
              <span className="text-yellow-500">○</span>
              AI Assistant requires internet
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
