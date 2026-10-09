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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      compteurs_quota: {
        Row: {
          action: string
          cle: string
          compte: number
          fenetre_debut: string
          fenetre_secondes: number
        }
        Insert: {
          action: string
          cle: string
          compte?: number
          fenetre_debut: string
          fenetre_secondes: number
        }
        Update: {
          action?: string
          cle?: string
          compte?: number
          fenetre_debut?: string
          fenetre_secondes?: number
        }
        Relationships: []
      }
      erreurs: {
        Row: {
          derniere_vue: string
          empreinte: string
          id: number
          message: string
          module: string | null
          occurrences: number
          page: string | null
          premiere_vue: string
          statut: string
        }
        Insert: {
          derniere_vue?: string
          empreinte: string
          id?: never
          message: string
          module?: string | null
          occurrences?: number
          page?: string | null
          premiere_vue?: string
          statut?: string
        }
        Update: {
          derniere_vue?: string
          empreinte?: string
          id?: never
          message?: string
          module?: string | null
          occurrences?: number
          page?: string | null
          premiere_vue?: string
          statut?: string
        }
        Relationships: []
      }
      journal_audit: {
        Row: {
          acteur_id: string | null
          action: string
          cible_id: string | null
          cible_type: string | null
          created_at: string
          details: Json
          id: number
        }
        Insert: {
          acteur_id?: string | null
          action: string
          cible_id?: string | null
          cible_type?: string | null
          created_at?: string
          details?: Json
          id?: never
        }
        Update: {
          acteur_id?: string | null
          action?: string
          cible_id?: string | null
          cible_type?: string | null
          created_at?: string
          details?: Json
          id?: never
        }
        Relationships: []
      }
      limites: {
        Row: {
          action: string
          fenetre_secondes: number
          maximum: number
          portee: string
        }
        Insert: {
          action: string
          fenetre_secondes: number
          maximum: number
          portee?: string
        }
        Update: {
          action?: string
          fenetre_secondes?: number
          maximum?: number
          portee?: string
        }
        Relationships: []
      }
      mesures: {
        Row: {
          created_at: string
          duree_ms: number
          id: number
          module: string
          operation: string
          session_id: string
          succes: boolean
        }
        Insert: {
          created_at?: string
          duree_ms: number
          id?: never
          module: string
          operation: string
          session_id: string
          succes: boolean
        }
        Update: {
          created_at?: string
          duree_ms?: number
          id?: never
          module?: string
          operation?: string
          session_id?: string
          succes?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          destinataire_id: string
          id: number
          lien: string | null
          lu: boolean
          titre: string
          type: string
        }
        Insert: {
          created_at?: string
          destinataire_id: string
          id?: never
          lien?: string | null
          lu?: boolean
          titre: string
          type: string
        }
        Update: {
          created_at?: string
          destinataire_id?: string
          id?: never
          lien?: string | null
          lu?: boolean
          titre?: string
          type?: string
        }
        Relationships: []
      }
      parametres: {
        Row: {
          cle: string
          publique: boolean
          updated_at: string
          valeur: Json
        }
        Insert: {
          cle: string
          publique?: boolean
          updated_at?: string
          valeur: Json
        }
        Update: {
          cle?: string
          publique?: boolean
          updated_at?: string
          valeur?: Json
        }
        Relationships: []
      }
      quartiers: {
        Row: {
          centre: unknown
          commune: string | null
          id: number
          nom: string
          ville_id: number
        }
        Insert: {
          centre?: unknown
          commune?: string | null
          id?: never
          nom: string
          ville_id: number
        }
        Update: {
          centre?: unknown
          commune?: string | null
          id?: never
          nom?: string
          ville_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "quartiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quartiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      universites: {
        Row: {
          adresse: string | null
          id: number
          nom: string
          position: unknown
          quartier_id: number | null
          sigle: string | null
          ville_id: number
        }
        Insert: {
          adresse?: string | null
          id?: never
          nom: string
          position?: unknown
          quartier_id?: number | null
          sigle?: string | null
          ville_id: number
        }
        Update: {
          adresse?: string | null
          id?: never
          nom?: string
          position?: unknown
          quartier_id?: number | null
          sigle?: string | null
          ville_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "universites_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      villes: {
        Row: {
          centre: unknown
          id: number
          nom: string
          rayon_km: number
        }
        Insert: {
          centre: unknown
          id?: never
          nom: string
          rayon_km: number
        }
        Update: {
          centre?: unknown
          id?: never
          nom?: string
          rayon_km?: number
        }
        Relationships: []
      }
      visites: {
        Row: {
          appareil: string
          chemin: string
          created_at: string
          id: number
          session_id: string
        }
        Insert: {
          appareil: string
          chemin: string
          created_at?: string
          id?: never
          session_id: string
        }
        Update: {
          appareil?: string
          chemin?: string
          created_at?: string
          id?: never
          session_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      quartiers_geo: {
        Row: {
          commune: string | null
          id: number | null
          latitude: number | null
          longitude: number | null
          nom: string | null
          ville_id: number | null
        }
        Insert: {
          commune?: string | null
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          ville_id?: number | null
        }
        Update: {
          commune?: string | null
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          ville_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quartiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quartiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      universites_geo: {
        Row: {
          adresse: string | null
          id: number | null
          latitude: number | null
          longitude: number | null
          nom: string | null
          quartier_id: number | null
          sigle: string | null
          ville_id: number | null
        }
        Insert: {
          adresse?: string | null
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          quartier_id?: number | null
          sigle?: string | null
          ville_id?: number | null
        }
        Update: {
          adresse?: string | null
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          quartier_id?: number | null
          sigle?: string | null
          ville_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "universites_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universites_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      villes_geo: {
        Row: {
          id: number | null
          latitude: number | null
          longitude: number | null
          nom: string | null
          rayon_km: number | null
        }
        Insert: {
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          rayon_km?: number | null
        }
        Update: {
          id?: number | null
          latitude?: never
          longitude?: never
          nom?: string | null
          rayon_km?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      consommer_quota: {
        Args: {
          p_action: string
          p_cle: string
          p_fenetre: number
          p_maximum: number
        }
        Returns: boolean
      }
      en_maintenance: { Args: never; Returns: boolean }
      enregistrer_erreur: {
        Args: {
          p_message: string
          p_module: string
          p_page: string
          p_session: string
        }
        Returns: undefined
      }
      enregistrer_mesures: {
        Args: { p_lot: Json; p_session: string }
        Returns: undefined
      }
      enregistrer_visite: {
        Args: { p_appareil: string; p_chemin: string; p_session: string }
        Returns: undefined
      }
      journaliser: {
        Args: {
          p_action: string
          p_cible_id: string
          p_cible_type: string
          p_details?: Json
        }
        Returns: undefined
      }
      notifier: {
        Args: {
          p_destinataire: string
          p_lien?: string
          p_titre: string
          p_type: string
        }
        Returns: undefined
      }
      parametres_publics: { Args: never; Returns: Json }
      quota_anonyme: {
        Args: { p_action: string; p_session: string }
        Returns: boolean
      }
      verifier_quota: { Args: { p_action: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
