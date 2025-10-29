// Types pour la base de données Supabase
// Généré avec: supabase gen types typescript --project-id "$PROJECT_REF" --schema public

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
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'treasurer' | 'validator' | 'user' | 'viewer' | 'admin_asso' | 'bn_member'
          pole: string | null
          association_id: string | null
          iban: string | null
          bic: string | null
          iban_verified: boolean
          phone: string | null
          address: string | null
          created_at: string
          updated_at: string
          is_active: boolean
          metadata: Json
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'treasurer' | 'validator' | 'user' | 'viewer' | 'admin_asso' | 'bn_member'
          pole?: string | null
          association_id?: string | null
          iban?: string | null
          bic?: string | null
          iban_verified?: boolean
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          is_active?: boolean
          metadata?: Json
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'treasurer' | 'validator' | 'user' | 'viewer' | 'admin_asso' | 'bn_member'
          pole?: string | null
          association_id?: string | null
          iban?: string | null
          bic?: string | null
          iban_verified?: boolean
          phone?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          is_active?: boolean
          metadata?: Json
        }
      }
      associations: {
        Row: {
          id: string
          name: string
          code: string
          budget_annual: number | null
          contact_email: string | null
          contact_phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          name: string
          code: string
          budget_annual?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          name?: string
          code?: string
          budget_annual?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          metadata?: Json
        }
      }
      expense_claims: {
        Row: {
          id: string
          user_id: string
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date: string
          amount_ttc: number
          currency: string
          departure_location: string | null
          arrival_location: string | null
          distance_km: number | null
          cv_fiscaux: number | null
          calculated_amount: number | null
          reimbursable_amount: number | null
          taux_applied: number | null
          description: string | null
          merchant_name: string | null
          status: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at: string | null
          validated_at: string | null
          validated_by: string | null
          paid_at: string | null
          validation_comment: string | null
          refusal_reason: string | null
          requires_second_validation: boolean
          second_validator_id: string | null
          payment_batch_id: string | null
          payment_reference: string | null
          created_at: string
          updated_at: string
          metadata: Json
          has_justificatifs: boolean
          is_duplicate_suspect: boolean
          reminder_sent_count: number
          last_reminder_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date: string
          amount_ttc: number
          currency?: string
          departure_location?: string | null
          arrival_location?: string | null
          distance_km?: number | null
          cv_fiscaux?: number | null
          calculated_amount?: number | null
          reimbursable_amount?: number | null
          taux_applied?: number | null
          description?: string | null
          merchant_name?: string | null
          status?: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          paid_at?: string | null
          validation_comment?: string | null
          refusal_reason?: string | null
          requires_second_validation?: boolean
          second_validator_id?: string | null
          payment_batch_id?: string | null
          payment_reference?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
          has_justificatifs?: boolean
          is_duplicate_suspect?: boolean
          reminder_sent_count?: number
          last_reminder_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          expense_type?: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date?: string
          amount_ttc?: number
          currency?: string
          departure_location?: string | null
          arrival_location?: string | null
          distance_km?: number | null
          cv_fiscaux?: number | null
          calculated_amount?: number | null
          reimbursable_amount?: number | null
          taux_applied?: number | null
          description?: string | null
          merchant_name?: string | null
          status?: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          paid_at?: string | null
          validation_comment?: string | null
          refusal_reason?: string | null
          requires_second_validation?: boolean
          second_validator_id?: string | null
          payment_batch_id?: string | null
          payment_reference?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json
          has_justificatifs?: boolean
          is_duplicate_suspect?: boolean
          reminder_sent_count?: number
          last_reminder_at?: string | null
        }
      }
      justificatifs: {
        Row: {
          id: string
          expense_claim_id: string
          file_name: string
          file_path: string
          file_type: string
          file_size: number
          ocr_extracted_data: Json | null
          ocr_processed: boolean
          ocr_confidence: number | null
          drive_file_id: string | null
          uploaded_at: string
          uploaded_by: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          expense_claim_id: string
          file_name: string
          file_path: string
          file_type: string
          file_size: number
          ocr_extracted_data?: Json | null
          ocr_processed?: boolean
          ocr_confidence?: number | null
          drive_file_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          expense_claim_id?: string
          file_name?: string
          file_path?: string
          file_type?: string
          file_size?: number
          ocr_extracted_data?: Json | null
          ocr_processed?: boolean
          ocr_confidence?: number | null
          drive_file_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          metadata?: Json
        }
      }
      payment_batches: {
        Row: {
          id: string
          batch_name: string
          batch_date: string
          total_amount: number
          total_claims: number
          sepa_xml_path: string | null
          csv_export_path: string | null
          status: 'draft' | 'exported' | 'sent_to_bank' | 'processed' | 'closed'
          exported_at: string | null
          exported_by: string | null
          created_at: string
          created_by: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          batch_name: string
          batch_date: string
          total_amount: number
          total_claims: number
          sepa_xml_path?: string | null
          csv_export_path?: string | null
          status?: 'draft' | 'exported' | 'sent_to_bank' | 'processed' | 'closed'
          exported_at?: string | null
          exported_by?: string | null
          created_at?: string
          created_by?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          batch_name?: string
          batch_date?: string
          total_amount?: number
          total_claims?: number
          sepa_xml_path?: string | null
          csv_export_path?: string | null
          status?: 'draft' | 'exported' | 'sent_to_bank' | 'processed' | 'closed'
          exported_at?: string | null
          exported_by?: string | null
          created_at?: string
          created_by?: string | null
          metadata?: Json
        }
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_email: string | null
          actor_role: string | null
          action: string
          entity_type: string
          entity_id: string
          before_data: Json | null
          after_data: Json | null
          diff: Json | null
          ip_address: string | null
          user_agent: string | null
          timestamp: string
          metadata: Json
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_email?: string | null
          actor_role?: string | null
          action: string
          entity_type: string
          entity_id: string
          before_data?: Json | null
          after_data?: Json | null
          diff?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          timestamp?: string
          metadata?: Json
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_email?: string | null
          actor_role?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          before_data?: Json | null
          after_data?: Json | null
          diff?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          timestamp?: string
          metadata?: Json
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          related_entity_type: string | null
          related_entity_id: string | null
          is_read: boolean
          read_at: string | null
          email_sent: boolean
          email_sent_at: string | null
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          related_entity_type?: string | null
          related_entity_id?: string | null
          is_read?: boolean
          read_at?: string | null
          email_sent?: boolean
          email_sent_at?: string | null
          created_at?: string
          metadata?: Json
        }
      }
      baremes: {
        Row: {
          id: string
          cv_fiscaux: number
          rate_per_km: number
          valid_from: string
          valid_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cv_fiscaux: number
          rate_per_km: number
          valid_from: string
          valid_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cv_fiscaux?: number
          rate_per_km?: number
          valid_from?: string
          valid_to?: string | null
          created_at?: string
        }
      }
      taux_remboursement: {
        Row: {
          id: string
          role: 'bn_member' | 'admin_asso' | 'user'
          taux: number
          valid_from: string
          valid_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          role: 'bn_member' | 'admin_asso' | 'user'
          taux: number
          valid_from: string
          valid_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'bn_member' | 'admin_asso' | 'user'
          taux?: number
          valid_from?: string
          valid_to?: string | null
          created_at?: string
        }
      }
      plafonds: {
        Row: {
          id: string
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          plafond_unitaire: number | null
          plafond_journalier: number | null
          plafond_mensuel: number | null
          requires_validation: boolean
          valid_from: string
          valid_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          plafond_unitaire?: number | null
          plafond_journalier?: number | null
          plafond_mensuel?: number | null
          requires_validation?: boolean
          valid_from: string
          valid_to?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          expense_type?: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          plafond_unitaire?: number | null
          plafond_journalier?: number | null
          plafond_mensuel?: number | null
          requires_validation?: boolean
          valid_from?: string
          valid_to?: string | null
          created_at?: string
        }
      }
      config: {
        Row: {
          key: string
          value: Json
          description: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: Json
          description?: string | null
          updated_at?: string
          updated_by?: string | null
        }
      }
    }
    Views: {
      claims_enriched: {
        Row: {
          id: string
          user_id: string
          expense_type: string
          expense_date: string
          amount_ttc: number
          status: string
          full_name: string
          email: string
          role: string
          validator_name: string | null
          payment_batch_name: string | null
          justificatifs_count: number
          // ... autres champs
        }
      }
      user_stats: {
        Row: {
          user_id: string
          total_claims: number
          validated_claims: number
          paid_claims: number
          total_reimbursed: number
          avg_validation_days: number
        }
      }
      treasurer_dashboard: {
        Row: {
          pending_validation: number
          incomplete_claims: number
          total_to_pay: number
          claims_to_pay: number
          avg_validation_days_30d: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'treasurer' | 'validator' | 'user' | 'viewer' | 'admin_asso' | 'bn_member'
      expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
      claim_status: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
      batch_status: 'draft' | 'exported' | 'sent_to_bank' | 'processed' | 'closed'
    }
  }
}
