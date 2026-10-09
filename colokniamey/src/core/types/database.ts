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
      contenus_en_revue: {
        Row: {
          auteur_id: string | null
          categories: string[]
          contenu_id: string
          created_at: string
          decide_le: string | null
          decide_par: string | null
          id: number
          motif: string | null
          raison: string
          statut: string
          type_contenu: string
        }
        Insert: {
          auteur_id?: string | null
          categories?: string[]
          contenu_id: string
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          id?: never
          motif?: string | null
          raison: string
          statut?: string
          type_contenu: string
        }
        Update: {
          auteur_id?: string | null
          categories?: string[]
          contenu_id?: string
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          id?: never
          motif?: string | null
          raison?: string
          statut?: string
          type_contenu?: string
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
      photos: {
        Row: {
          chemin: string
          created_at: string
          decide_le: string | null
          decide_par: string | null
          empreinte: string
          id: number
          motif: string | null
          proprietaire_id: string
          statut: string
          suspecte: boolean
          usage: string
        }
        Insert: {
          chemin: string
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          empreinte: string
          id?: never
          motif?: string | null
          proprietaire_id: string
          statut?: string
          suspecte?: boolean
          usage: string
        }
        Update: {
          chemin?: string
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          empreinte?: string
          id?: never
          motif?: string | null
          proprietaire_id?: string
          statut?: string
          suspecte?: boolean
          usage?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_proprietaire_id_fkey"
            columns: ["proprietaire_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      profils: {
        Row: {
          cgu_acceptee_le: string
          cgu_version: string
          created_at: string
          id: string
          motif_suspension: string | null
          nom: string
          prenom: string
          role: Database["public"]["Enums"]["role_utilisateur"]
          statut: Database["public"]["Enums"]["statut_compte"]
          suspendu_jusqua: string | null
          telephone: string
          updated_at: string
        }
        Insert: {
          cgu_acceptee_le?: string
          cgu_version: string
          created_at?: string
          id: string
          motif_suspension?: string | null
          nom: string
          prenom: string
          role?: Database["public"]["Enums"]["role_utilisateur"]
          statut?: Database["public"]["Enums"]["statut_compte"]
          suspendu_jusqua?: string | null
          telephone: string
          updated_at?: string
        }
        Update: {
          cgu_acceptee_le?: string
          cgu_version?: string
          created_at?: string
          id?: string
          motif_suspension?: string | null
          nom?: string
          prenom?: string
          role?: Database["public"]["Enums"]["role_utilisateur"]
          statut?: Database["public"]["Enums"]["statut_compte"]
          suspendu_jusqua?: string | null
          telephone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profils_etudiants: {
        Row: {
          bio: string | null
          budget_max: number | null
          filiere: string | null
          niveau_etude: string | null
          universite_id: number
          user_id: string
        }
        Insert: {
          bio?: string | null
          budget_max?: number | null
          filiere?: string | null
          niveau_etude?: string | null
          universite_id: number
          user_id: string
        }
        Update: {
          bio?: string | null
          budget_max?: number | null
          filiere?: string | null
          niveau_etude?: string | null
          universite_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_etudiants_universite_id_fkey"
            columns: ["universite_id"]
            isOneToOne: false
            referencedRelation: "universites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profils_etudiants_universite_id_fkey"
            columns: ["universite_id"]
            isOneToOne: false
            referencedRelation: "universites_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profils_etudiants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      profils_proprietaires: {
        Row: {
          adresse: string | null
          type_proprietaire: string
          user_id: string
        }
        Insert: {
          adresse?: string | null
          type_proprietaire?: string
          user_id: string
        }
        Update: {
          adresse?: string | null
          type_proprietaire?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_proprietaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
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
      termes_sensibles: {
        Row: {
          actif: boolean
          categorie: string
          created_at: string
          id: number
          langue: string
          niveau: string
          propose_par: string | null
          terme: string
          valide: boolean
          valide_par: string | null
        }
        Insert: {
          actif?: boolean
          categorie: string
          created_at?: string
          id?: never
          langue?: string
          niveau: string
          propose_par?: string | null
          terme: string
          valide?: boolean
          valide_par?: string | null
        }
        Update: {
          actif?: boolean
          categorie?: string
          created_at?: string
          id?: never
          langue?: string
          niveau?: string
          propose_par?: string | null
          terme?: string
          valide?: boolean
          valide_par?: string | null
        }
        Relationships: []
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
      violations: {
        Row: {
          auteur_id: string
          categories: string[]
          contexte: string
          created_at: string
          id: number
        }
        Insert: {
          auteur_id: string
          categories?: string[]
          contexte: string
          created_at?: string
          id?: never
        }
        Update: {
          auteur_id?: string
          categories?: string[]
          contexte?: string
          created_at?: string
          id?: never
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
      accepter_cgu: { Args: { p_version: string }; Returns: undefined }
      consommer_quota: {
        Args: {
          p_action: string
          p_cle: string
          p_fenetre: number
          p_maximum: number
        }
        Returns: boolean
      }
      controler_texte: {
        Args: { p_contexte?: string; p_texte: string }
        Returns: string
      }
      decider_photo: {
        Args: { p_decision: string; p_motif?: string; p_photo_id: number }
        Returns: string
      }
      distance_empreintes: {
        Args: { p_a: string; p_b: string }
        Returns: number
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
      enregistrer_photo: {
        Args: { p_chemin: string; p_empreinte: string; p_usage: string }
        Returns: number
      }
      enregistrer_visite: {
        Args: { p_appareil: string; p_chemin: string; p_session: string }
        Returns: undefined
      }
      est_actif: { Args: never; Returns: boolean }
      est_admin: { Args: never; Returns: boolean }
      est_super_admin: { Args: never; Returns: boolean }
      journaliser: {
        Args: {
          p_action: string
          p_cible_id: string
          p_cible_type: string
          p_details?: Json
        }
        Returns: undefined
      }
      normaliser_texte: {
        Args: { p_texte: string; p_variante?: number }
        Returns: string
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
      peut_ecrire: { Args: never; Returns: boolean }
      precontroler_photo: { Args: { p_empreinte: string }; Returns: undefined }
      quota_anonyme: {
        Args: { p_action: string; p_session: string }
        Returns: boolean
      }
      quota_envoi_photo: { Args: never; Returns: boolean }
      verifier_empreinte: {
        Args: { p_auteur: string; p_empreinte: string }
        Returns: boolean
      }
      verifier_quota: { Args: { p_action: string }; Returns: undefined }
      verifier_texte: {
        Args: { p_contexte?: string; p_texte: string }
        Returns: Database["public"]["CompositeTypes"]["resultat_verification"]
        SetofOptions: {
          from: "*"
          to: "resultat_verification"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      role_utilisateur: "etudiant" | "proprietaire" | "admin" | "super_admin"
      statut_compte: "actif" | "suspendu" | "desactive"
    }
    CompositeTypes: {
      resultat_verification: {
        issue: string | null
        categories: string[] | null
      }
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
  public: {
    Enums: {
      role_utilisateur: ["etudiant", "proprietaire", "admin", "super_admin"],
      statut_compte: ["actif", "suspendu", "desactive"],
    },
  },
} as const
