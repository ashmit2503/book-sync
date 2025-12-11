-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Books table
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'epub')),
  cover_url TEXT,
  page_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  reading_progress JSONB DEFAULT '{"currentPage": 0, "totalPages": 0, "percentage": 0, "lastRead": null}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Collections/Shelves table
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many relationship between collections and books
CREATE TABLE collection_books (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, book_id)
);

-- Reading sessions for analytics
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  pages_read INTEGER,
  duration_minutes INTEGER
);

-- Indexes for performance
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_created_at ON books(user_id, created_at DESC);
CREATE INDEX idx_books_processing_status ON books(processing_status) WHERE processing_status != 'completed';
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collection_books_collection ON collection_books(collection_id);
CREATE INDEX idx_collection_books_book ON collection_books(book_id);
CREATE INDEX idx_reading_sessions_user_book ON reading_sessions(user_id, book_id, started_at DESC);

-- Full-text search index on book titles and authors
CREATE INDEX idx_books_search ON books USING gin(to_tsvector('english', title || ' ' || COALESCE(author, '')));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_books_updated_at 
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
