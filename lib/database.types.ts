export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      books: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string | null
          file_path: string
          file_size: number
          file_type: 'pdf' | 'epub'
          cover_url: string | null
          page_count: number | null
          metadata: Json
          reading_progress: Json
          created_at: string
          updated_at: string
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          author?: string | null
          file_path: string
          file_size: number
          file_type: 'pdf' | 'epub'
          cover_url?: string | null
          page_count?: number | null
          metadata?: Json
          reading_progress?: Json
          created_at?: string
          updated_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          author?: string | null
          file_path?: string
          file_size?: number
          file_type?: 'pdf' | 'epub'
          cover_url?: string | null
          page_count?: number | null
          metadata?: Json
          reading_progress?: Json
          created_at?: string
          updated_at?: string
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
        }
      }
      collections: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      collection_books: {
        Row: {
          collection_id: string
          book_id: string
          added_at: string
        }
        Insert: {
          collection_id: string
          book_id: string
          added_at?: string
        }
        Update: {
          collection_id?: string
          book_id?: string
          added_at?: string
        }
      }
      reading_sessions: {
        Row: {
          id: string
          user_id: string
          book_id: string
          started_at: string
          ended_at: string | null
          pages_read: number | null
          duration_minutes: number | null
        }
        Insert: {
          id?: string
          user_id: string
          book_id: string
          started_at?: string
          ended_at?: string | null
          pages_read?: number | null
          duration_minutes?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          book_id?: string
          started_at?: string
          ended_at?: string | null
          pages_read?: number | null
          duration_minutes?: number | null
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          font_size: number
          font_family: string
          line_spacing: number
          margins: 'narrow' | 'normal' | 'wide'
          reading_theme: 'light' | 'dark' | 'sepia' | 'system'
          scroll_mode: 'vertical' | 'horizontal'
          auto_save_interval: number
          show_reading_time: boolean
          enable_tts: boolean
          tts_speed: number
          tts_voice: string | null
          dyslexia_font: boolean
          high_contrast: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          font_size?: number
          font_family?: string
          line_spacing?: number
          margins?: 'narrow' | 'normal' | 'wide'
          reading_theme?: 'light' | 'dark' | 'sepia' | 'system'
          scroll_mode?: 'vertical' | 'horizontal'
          auto_save_interval?: number
          show_reading_time?: boolean
          enable_tts?: boolean
          tts_speed?: number
          tts_voice?: string | null
          dyslexia_font?: boolean
          high_contrast?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          font_size?: number
          font_family?: string
          line_spacing?: number
          margins?: 'narrow' | 'normal' | 'wide'
          reading_theme?: 'light' | 'dark' | 'sepia' | 'system'
          scroll_mode?: 'vertical' | 'horizontal'
          auto_save_interval?: number
          show_reading_time?: boolean
          enable_tts?: boolean
          tts_speed?: number
          tts_voice?: string | null
          dyslexia_font?: boolean
          high_contrast?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      book_tags: {
        Row: {
          book_id: string
          tag_id: string
          added_at: string
        }
        Insert: {
          book_id: string
          tag_id: string
          added_at?: string
        }
        Update: {
          book_id?: string
          tag_id?: string
          added_at?: string
        }
      }
    }
  }
}
