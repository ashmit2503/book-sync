-- Helper function to update reading progress
CREATE OR REPLACE FUNCTION update_reading_progress(
  p_book_id UUID,
  p_current_page INTEGER,
  p_total_pages INTEGER,
  p_percentage NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE books
  SET 
    reading_progress = jsonb_set(
      jsonb_set(
        jsonb_set(
          reading_progress,
          '{currentPage}',
          to_jsonb(p_current_page)
        ),
        '{totalPages}',
        to_jsonb(p_total_pages)
      ),
      '{percentage}',
      to_jsonb(p_percentage)
    ) || jsonb_build_object('lastRead', now()),
    updated_at = now()
  WHERE id = p_book_id
    AND user_id = auth.uid();
END;
$$;

-- Function to search books using full-text search
CREATE OR REPLACE FUNCTION search_books(
  search_query TEXT,
  user_uuid UUID
)
RETURNS SETOF books
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM books
  WHERE user_id = user_uuid
    AND (
      to_tsvector('english', title || ' ' || COALESCE(author, ''))
      @@ plainto_tsquery('english', search_query)
      OR title ILIKE '%' || search_query || '%'
      OR author ILIKE '%' || search_query || '%'
    )
  ORDER BY
    ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(author, '')),
      plainto_tsquery('english', search_query)
    ) DESC,
    created_at DESC;
END;
$$;

-- Function to get book statistics for a user
CREATE OR REPLACE FUNCTION get_user_book_stats(user_uuid UUID)
RETURNS TABLE (
  total_books BIGINT,
  books_read BIGINT,
  books_in_progress BIGINT,
  total_pages INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_books,
    COUNT(*) FILTER (WHERE (reading_progress->>'percentage')::numeric >= 100) as books_read,
    COUNT(*) FILTER (WHERE (reading_progress->>'percentage')::numeric > 0 AND (reading_progress->>'percentage')::numeric < 100) as books_in_progress,
    COALESCE(SUM(page_count), 0)::INTEGER as total_pages
  FROM books
  WHERE user_id = user_uuid AND processing_status = 'completed';
END;
$$;
