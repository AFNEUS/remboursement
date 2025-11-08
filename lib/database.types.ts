// Types pour la base de données Supabase
// Aligné avec FINAL_PERFECT_SETUP.sql
// ⚠️ NE PAS modifier manuellement - regénérer après changements SQL

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
          first_name: string
          last_name: string
          role: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          status: 'ADMIN' | 'BN' | 'TREASURER' | 'VALIDATOR' | 'MEMBER'
          pole: string | null
          association_id: string | null
          iban: string | null
          bic: string | null
          iban_verified: boolean
          phone: string | null
          address: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
          last_login_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          first_name: string
          last_name: string
          role?: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          status?: 'ADMIN' | 'BN' | 'TREASURER' | 'VALIDATOR' | 'MEMBER'
          pole?: string | null
          association_id?: string | null
          iban?: string | null
          bic?: string | null
          iban_verified?: boolean
          phone?: string | null
          address?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          first_name?: string
          last_name?: string
          role?: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          status?: 'ADMIN' | 'BN' | 'TREASURER' | 'VALIDATOR' | 'MEMBER'
          pole?: string | null
          association_id?: string | null
          iban?: string | null
          bic?: string | null
          iban_verified?: boolean
          phone?: string | null
          address?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
        }
      }
      authorized_users: {
        Row: {
          email: string
          first_name: string
          last_name: string
          role: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          notes: string | null
          created_at: string
        }
        Insert: {
          email: string
          first_name: string
          last_name: string
          role?: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          notes?: string | null
          created_at?: string
        }
        Update: {
          email?: string
          first_name?: string
          last_name?: string
          role?: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
          notes?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          description: string | null
          event_type: 'CONGRES_ANNUEL' | 'WEEKEND_PASSATION' | 'FORMATION' | 'REUNION_BN' | 'REUNION_REGION' | 'EVENEMENT_EXTERNE' | 'AUTRE'
          start_date: string
          end_date: string
          location: string
          departure_city: string | null
          custom_km_cap: number
          carpooling_bonus_cap_percent: number
          allow_carpooling_bonus: boolean
          max_train_amount: number | null
          max_hotel_per_night: number | null
          max_meal_amount: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          event_type: 'CONGRES_ANNUEL' | 'WEEKEND_PASSATION' | 'FORMATION' | 'REUNION_BN' | 'REUNION_REGION' | 'EVENEMENT_EXTERNE' | 'AUTRE'
          start_date: string
          end_date: string
          location: string
          departure_city?: string | null
          custom_km_cap?: number
          carpooling_bonus_cap_percent?: number
          allow_carpooling_bonus?: boolean
          max_train_amount?: number | null
          max_hotel_per_night?: number | null
          max_meal_amount?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          event_type?: 'CONGRES_ANNUEL' | 'WEEKEND_PASSATION' | 'FORMATION' | 'REUNION_BN' | 'REUNION_REGION' | 'EVENEMENT_EXTERNE' | 'AUTRE'
          start_date?: string
          end_date?: string
          location?: string
          departure_city?: string | null
          custom_km_cap?: number
          carpooling_bonus_cap_percent?: number
          allow_carpooling_bonus?: boolean
          max_train_amount?: number | null
          max_hotel_per_night?: number | null
          max_meal_amount?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_baremes: {
        Row: {
          id: string
          event_id: string
          expense_type: 'train' | 'avion' | 'covoiturage' | 'hebergement'
          bn_rate: number
          admin_rate: number
          other_rate: number
          max_amount: number | null
          notes: string | null
          auto_calculated: boolean
          sncf_price_young: number | null
          sncf_price_standard: number | null
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          expense_type: 'train' | 'avion' | 'covoiturage' | 'hebergement'
          bn_rate?: number
          admin_rate?: number
          other_rate?: number
          max_amount?: number | null
          notes?: string | null
          auto_calculated?: boolean
          sncf_price_young?: number | null
          sncf_price_standard?: number | null
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          expense_type?: 'train' | 'avion' | 'covoiturage' | 'hebergement'
          bn_rate?: number
          admin_rate?: number
          other_rate?: number
          max_amount?: number | null
          notes?: string | null
          auto_calculated?: boolean
          sncf_price_young?: number | null
          sncf_price_standard?: number | null
          last_updated?: string
          created_at?: string
        }
      }
      expense_claims: {
        Row: {
          id: string
          user_id: string
          event_id: string | null
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date: string
          motive: string | null
          description: string | null
          merchant_name: string | null
          amount_ttc: number
          currency: string
          calculated_amount: number | null
          validated_amount: number | null
          reimbursable_amount: number | null
          taux_applied: number | null
          total_amount: number | null
          departure_location: string | null
          arrival_location: string | null
          distance_km: number | null
          cv_fiscaux: number | null
          status: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at: string | null
          validated_at: string | null
          validated_by: string | null
          validator_id: string | null
          validation_comment: string | null
          refusal_reason: string | null
          requires_second_validation: boolean
          second_validator_id: string | null
          paid_at: string | null
          payment_batch_id: string | null
          payment_reference: string | null
          has_justificatifs: boolean
          is_duplicate_suspect: boolean
          reminder_sent_count: number
          last_reminder_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id?: string | null
          expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date: string
          motive?: string | null
          description?: string | null
          merchant_name?: string | null
          amount_ttc: number
          currency?: string
          calculated_amount?: number | null
          validated_amount?: number | null
          reimbursable_amount?: number | null
          taux_applied?: number | null
          total_amount?: number | null
          departure_location?: string | null
          arrival_location?: string | null
          distance_km?: number | null
          cv_fiscaux?: number | null
          status?: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validator_id?: string | null
          validation_comment?: string | null
          refusal_reason?: string | null
          requires_second_validation?: boolean
          second_validator_id?: string | null
          paid_at?: string | null
          payment_batch_id?: string | null
          payment_reference?: string | null
          has_justificatifs?: boolean
          is_duplicate_suspect?: boolean
          reminder_sent_count?: number
          last_reminder_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_id?: string | null
          expense_type?: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
          expense_date?: string
          motive?: string | null
          description?: string | null
          merchant_name?: string | null
          amount_ttc?: number
          currency?: string
          calculated_amount?: number | null
          validated_amount?: number | null
          reimbursable_amount?: number | null
          taux_applied?: number | null
          total_amount?: number | null
          departure_location?: string | null
          arrival_location?: string | null
          distance_km?: number | null
          cv_fiscaux?: number | null
          status?: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
          submitted_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validator_id?: string | null
          validation_comment?: string | null
          refusal_reason?: string | null
          requires_second_validation?: boolean
          second_validator_id?: string | null
          paid_at?: string | null
          payment_batch_id?: string | null
          payment_reference?: string | null
          has_justificatifs?: boolean
          is_duplicate_suspect?: boolean
          reminder_sent_count?: number
          last_reminder_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      get_current_user_safe: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          full_name: string
          first_name: string
          last_name: string
          role: string
          status: string
          phone: string | null
          iban: string | null
          iban_verified: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }[]
      }
      sync_current_user: {
        Args: Record<string, never>
        Returns: void
      }
      update_user_profile: {
        Args: {
          p_first_name?: string
          p_last_name?: string
          p_iban?: string
        }
        Returns: void
      }
    }
    Enums: {
      user_role: 'admin_asso' | 'treasurer' | 'validator' | 'bn_member' | 'user'
      user_status: 'ADMIN' | 'BN' | 'TREASURER' | 'VALIDATOR' | 'MEMBER'
      expense_type: 'transport' | 'train' | 'car' | 'hotel' | 'meal' | 'registration' | 'other'
      claim_status: 'draft' | 'submitted' | 'incomplete' | 'to_validate' | 'validated' | 'refused' | 'exported_for_payment' | 'paid' | 'closed' | 'disputed'
      batch_status: 'draft' | 'exported' | 'sent_to_bank' | 'processed' | 'closed'
      event_type: 'CONGRES_ANNUEL' | 'WEEKEND_PASSATION' | 'FORMATION' | 'REUNION_BN' | 'REUNION_REGION' | 'EVENEMENT_EXTERNE' | 'AUTRE'
    }
  }
}
