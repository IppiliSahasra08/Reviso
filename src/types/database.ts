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
      subjects: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          subject_id: string | null
          title: string
          file_url: string
          file_size: number
          page_count: number
          current_page: number
          current_stage: number
          next_review_date: string
          last_reviewed_at: string
          review_count: number
          uploaded_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subject_id?: string | null
          title: string
          file_url: string
          file_size: number
          page_count: number
          current_page?: number
          current_stage?: number
          next_review_date: string
          last_reviewed_at?: string
          review_count?: number
          uploaded_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subject_id?: string | null
          title?: string
          file_url?: string
          file_size?: number
          page_count?: number
          current_page?: number
          current_stage?: number
          next_review_date?: string
          last_reviewed_at?: string
          review_count?: number
          uploaded_at?: string
          deleted_at?: string | null
        }
      }
      review_log: {
        Row: {
          id: string
          user_id: string
          document_id: string
          started_at: string
          ended_at: string
          duration_seconds: number
          pages_read: number
          review_completed: boolean
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          started_at?: string
          ended_at: string
          duration_seconds: number
          pages_read: number
          review_completed?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          started_at?: string
          ended_at?: string
          duration_seconds?: number
          pages_read?: number
          review_completed?: boolean
        }
      }
      active_sessions: {
        Row: {
          id: string
          user_id: string
          document_id: string
          started_at: string
          last_active_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          started_at?: string
          last_active_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          started_at?: string
          last_active_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Subject = Database['public']['Tables']['subjects']['Row']
export type SubjectInsert = Database['public']['Tables']['subjects']['Insert']
export type SubjectUpdate = Database['public']['Tables']['subjects']['Update']

export type Document = Database['public']['Tables']['documents']['Row']
export type DocumentInsert = Database['public']['Tables']['documents']['Insert']
export type DocumentUpdate = Database['public']['Tables']['documents']['Update']

export type ReviewLog = Database['public']['Tables']['review_log']['Row']
export type ReviewLogInsert = Database['public']['Tables']['review_log']['Insert']
export type ReviewLogUpdate = Database['public']['Tables']['review_log']['Update']

export type ActiveSession = Database['public']['Tables']['active_sessions']['Row']
export type ActiveSessionInsert = Database['public']['Tables']['active_sessions']['Insert']
export type ActiveSessionUpdate = Database['public']['Tables']['active_sessions']['Update']