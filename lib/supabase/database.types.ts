export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          created_at: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string | null
        }
      }
      files: {
        Row: {
          id: string
          created_at: string
          name: string
          path: string
          size: number
          type: string
          user_id: string
          shared: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          path: string
          size: number
          type: string
          user_id: string
          shared?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          path?: string
          size?: number
          type?: string
          user_id?: string
          shared?: boolean
        }
      }
      file_access_requests: {
        Row: {
          id: string
          created_at: string
          file_id: string
          requester_id: string
          owner_id: string
          status: string
          message: string
          response_message: string | null
          responded_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          file_id: string
          requester_id: string
          owner_id: string
          status?: string
          message: string
          response_message?: string | null
          responded_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          file_id?: string
          requester_id?: string
          owner_id?: string
          status?: string
          message?: string
          response_message?: string | null
          responded_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          created_at: string
          user_id: string
          type: string
          title: string
          message: string
          read: boolean
          metadata: any | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          type: string
          title: string
          message: string
          read?: boolean
          metadata?: any | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          read?: boolean
          metadata?: any | null
        }
      }
      user_settings: {
        Row: {
          id: string
          created_at: string
          updated_at: string | null
          two_factor_enabled: boolean
          private_files_by_default: boolean
          require_approval_for_access: boolean
          email_notifications_enabled: boolean
          push_notifications_enabled: boolean
          language: string
          notification_types: any | null
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string | null
          two_factor_enabled?: boolean
          private_files_by_default?: boolean
          require_approval_for_access?: boolean
          email_notifications_enabled?: boolean
          push_notifications_enabled?: boolean
          language?: string
          notification_types?: any | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string | null
          two_factor_enabled?: boolean
          private_files_by_default?: boolean
          require_approval_for_access?: boolean
          email_notifications_enabled?: boolean
          push_notifications_enabled?: boolean
          language?: string
          notification_types?: any | null
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
