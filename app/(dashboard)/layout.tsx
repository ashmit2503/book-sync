import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { BookOpen, Upload, LogOut, FolderOpen, Settings } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/library" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">BookSync</span>
            </Link>
            
            <nav className="hidden items-center gap-1 md:flex">
              <Link href="/library">
                <Button variant="ghost" size="sm" className="gap-2 transition-colors">
                  <BookOpen className="h-4 w-4" />
                  Library
                </Button>
              </Link>
              <Link href="/collections">
                <Button variant="ghost" size="sm" className="gap-2 transition-colors">
                  <FolderOpen className="h-4 w-4" />
                  Collections
                </Button>
              </Link>
              <Link href="/upload">
                <Button variant="ghost" size="sm" className="gap-2 transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-2 transition-colors">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden text-sm text-muted-foreground md:block">
              {user.email}
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="sm" className="gap-2 transition-colors hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  )
}
