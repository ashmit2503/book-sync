import { createClient } from '@/lib/supabase/server'
import { BookUploadForm } from '@/components/upload/BookUploadForm'

export default async function UploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Upload Book</h1>
        <p className="mt-2 text-muted-foreground">
          Add PDF or EPUB files to your library
        </p>
      </div>

      <BookUploadForm userId={user.id} />

      <div className="mt-8 rounded-lg border p-6">
        <h2 className="mb-4 font-semibold">Supported Formats</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <strong>PDF</strong> - Portable Document Format
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <strong>EPUB</strong> - Electronic Publication
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Maximum file size: 5MB per book
        </p>
      </div>
    </div>
  )
}
