# BookSync

A cloud-based digital library for PDF and EPUB books with AI-powered reading assistance, text-to-speech, and accessibility features.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Styling:** Tailwind CSS + Radix UI primitives
- **State Management:** Zustand
- **Readers:** PDF.js, EPUB.js
- **AI:** Groq / OpenAI (configurable)
- **Deployment:** Vercel + Supabase

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An AI provider API key (Groq recommended, or OpenAI)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GROQ_API_KEY` | Groq API key (recommended — fast & free tier) |
| `OPENAI_API_KEY` | OpenAI API key (alternative to Groq) |

### 3. Set up Supabase

Run the migrations in order against your Supabase project:

```bash
supabase db push
```

Or apply them manually via the Supabase SQL Editor — files are in `supabase/migrations/`.

**Important:** You must also create two storage buckets manually in the Supabase Dashboard:

- `ebooks` — for uploaded book files
- `covers` — for generated book covers (set to public)

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

### Vercel

1. Push to GitHub and import in [Vercel](https://vercel.com)
2. Add all environment variables from `.env.example` in the Vercel project settings
3. Deploy — no special configuration needed

### Supabase

1. Create a production Supabase project
2. Run all migrations from `supabase/migrations/`
3. Create `ebooks` and `covers` storage buckets
4. Copy the project URL, anon key, and service role key to your Vercel env vars

## Project Structure

```
app/                  → Next.js App Router pages & API routes
  (auth)/             → Login & register pages
  (dashboard)/        → Authenticated pages (library, upload, settings, reader)
  api/                → API routes (AI assistant, books CRUD, tags)
components/
  ai/                 → AI assistant panel
  library/            → Book cards, library grid
  providers/          → Theme, accessibility, service worker providers
  readers/            → PDF and EPUB reader components
  ui/                 → Reusable UI primitives (shadcn/ui)
  upload/             → Book upload form
lib/
  hooks/              → React hooks (reading progress, sessions, preferences)
  stores/             → Zustand stores (AI chat, book context)
  supabase/           → Supabase client/server/middleware helpers
  utils/              → Utilities (caching, cover generation, upload validation)
supabase/
  migrations/         → Database schema migrations
```

## Features

- **Cloud Library** — Upload and manage PDF/EPUB books
- **AI Reading Assistant** — Chat, summarize, explain, quiz, translate, and analyze
- **Text-to-Speech** — Browser-native speech synthesis
- **Reading Progress Sync** — Automatic cross-device progress tracking
- **Offline Support** — PWA with service worker caching
- **Accessibility** — Dyslexia-friendly fonts, high contrast, customizable reading preferences
- **Auto-Generated Covers** — Extracts covers from PDFs and EPUBs
- **Collections & Tags** — Organize your library
