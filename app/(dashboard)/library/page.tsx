import { createClient } from '@/lib/supabase/server'
import { LibraryClient } from '@/components/library/LibraryClient'

export default async function LibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: books } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <LibraryClient initialBooks={books || []} />
}
