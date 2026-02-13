export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      airbnb_reservations: {
        Row: {
          airbnb_booking_id: string
          created_at: string
          description: string | null
          end_date: string
          guest_name: string | null
          id: string
          number_of_guests: number | null
          property_id: string
          raw_event_data: Json | null
          start_date: string
          summary: string
          updated_at: string
        }
        Insert: {
          airbnb_booking_id: string
          created_at?: string
          description?: string | null
          end_date: string
          guest_name?: string | null
          id?: string
          number_of_guests?: number | null
          property_id: string
          raw_event_data?: Json | null
          start_date: string
          summary: string
          updated_at?: string
        }
        Update: {
          airbnb_booking_id?: string
          created_at?: string
          description?: string | null
          end_date?: string
          guest_name?: string | null
          id?: string
          number_of_guests?: number | null
          property_id?: string
          raw_event_data?: Json | null
          start_date?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      airbnb_sync_status: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          property_id: string
          reservations_count: number | null
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          property_id: string
          reservations_count?: number | null
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          property_id?: string
          reservations_count?: number | null
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_reference: string | null
          check_in_date: string
          check_out_date: string
          created_at: string | null
          documents_generated: Json | null
          id: string
          number_of_guests: number
          property_id: string | null
          signed_contract_url: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          submission_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_reference?: string | null
          check_in_date: string
          check_out_date: string
          created_at?: string | null
          documents_generated?: Json | null
          id?: string
          number_of_guests?: number
          property_id?: string | null
          signed_contract_url?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          submission_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_reference?: string | null
          check_in_date?: string
          check_out_date?: string
          created_at?: string | null
          documents_generated?: Json | null
          id?: string
          number_of_guests?: number
          property_id?: string | null
          signed_contract_url?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          submission_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "guest_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "v_guest_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          booking_id: string
          contract_content: string
          created_at: string
          id: string
          signature_data: string
          signed_at: string
          signer_email: string | null
          signer_name: string | null
          signer_phone: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          contract_content: string
          created_at?: string
          id?: string
          signature_data: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          contract_content?: string
          created_at?: string
          id?: string
          signature_data?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guest_submissions: {
        Row: {
          booking_data: Json | null
          booking_id: string | null
          created_at: string
          document_urls: Json | null
          guest_data: Json | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          signature_data: string | null
          status: string
          submitted_at: string | null
          token_id: string
          updated_at: string
        }
        Insert: {
          booking_data?: Json | null
          booking_id?: string | null
          created_at?: string
          document_urls?: Json | null
          guest_data?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_data?: string | null
          status?: string
          submitted_at?: string | null
          token_id: string
          updated_at?: string
        }
        Update: {
          booking_data?: Json | null
          booking_id?: string | null
          created_at?: string
          document_urls?: Json | null
          guest_data?: Json | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_data?: string | null
          status?: string
          submitted_at?: string | null
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_guest_submissions_property_token_id"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "property_verification_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fkey_on_booking_id"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          booking_id: string | null
          created_at: string | null
          date_of_birth: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          email: string | null
          full_name: string | null
          id: string
          nationality: string
          place_of_birth: string | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          email?: string | null
          full_name?: string | null
          id?: string
          nationality: string
          place_of_birth?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          email?: string | null
          full_name?: string | null
          id?: string
          nationality?: string
          place_of_birth?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_verification_summary"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      host_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          airbnb_ics_url: string | null
          contact_info: Json | null
          contract_template: Json | null
          created_at: string | null
          description: string | null
          house_rules: Json | null
          id: string
          max_occupancy: number | null
          name: string
          photo_url: string | null
          property_type: string | null
          remaining_actions_hidden: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          airbnb_ics_url?: string | null
          contact_info?: Json | null
          contract_template?: Json | null
          created_at?: string | null
          description?: string | null
          house_rules?: Json | null
          id?: string
          max_occupancy?: number | null
          name: string
          photo_url?: string | null
          property_type?: string | null
          remaining_actions_hidden?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          airbnb_ics_url?: string | null
          contact_info?: Json | null
          contract_template?: Json | null
          created_at?: string | null
          description?: string | null
          house_rules?: Json | null
          id?: string
          max_occupancy?: number | null
          name?: string
          photo_url?: string | null
          property_type?: string | null
          remaining_actions_hidden?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      property_verification_tokens: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          is_active: boolean
          property_id: string
          token: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          property_id: string
          token: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          property_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_property_verification_tokens_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          booking_id: string | null
          contract_url: string | null
          created_at: string | null
          document_type: string | null
          document_url: string | null
          extracted_data: Json | null
          file_name: string
          file_path: string | null
          guest_id: string | null
          id: string
          police_form_url: string | null
          processing_status: string | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          contract_url?: string | null
          created_at?: string | null
          document_type?: string | null
          document_url?: string | null
          extracted_data?: Json | null
          file_name: string
          file_path?: string | null
          guest_id?: string | null
          id?: string
          police_form_url?: string | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          contract_url?: string | null
          created_at?: string | null
          document_type?: string | null
          document_url?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_path?: string | null
          guest_id?: string | null
          id?: string
          police_form_url?: string | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_verification_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "uploaded_documents_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_booking_verification_summary: {
        Row: {
          booking_id: string | null
          guest_submissions_count: number | null
          has_signature: boolean | null
          property_id: string | null
          uploaded_documents_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      v_guest_submissions: {
        Row: {
          booking_data: Json | null
          booking_id: string | null
          created_at: string | null
          document_urls: Json | null
          guest_data: Json | null
          id: string | null
          property_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_data: string | null
          status: string | null
          submitted_at: string | null
          token_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_guest_submissions_property_token_id"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "property_verification_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_property_verification_tokens_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_property_with_reservations: {
        Args: { p_property_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      booking_status: "pending" | "completed" | "archived"
      document_type: "passport" | "national_id"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: ["pending", "completed", "archived"],
      document_type: ["passport", "national_id"],
    },
  },
} as const
