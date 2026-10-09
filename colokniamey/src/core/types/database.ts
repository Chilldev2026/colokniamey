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
      files_admin: {
        Row: {
          dernier_nombre: number
          derniere_alerte_ancien_le: string | null
          derniere_alerte_le: string | null
          libelle: string
          lien: string
          nom: string
          ordre: number
          vue: string
        }
        Insert: {
          dernier_nombre?: number
          derniere_alerte_ancien_le?: string | null
          derniere_alerte_le?: string | null
          libelle: string
          lien: string
          nom: string
          ordre?: number
          vue: string
        }
        Update: {
          dernier_nombre?: number
          derniere_alerte_ancien_le?: string | null
          derniere_alerte_le?: string | null
          libelle?: string
          lien?: string
          nom?: string
          ordre?: number
          vue?: string
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
      preferences_admin: {
        Row: {
          alertes_urgentes: boolean
          recap_quotidien: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alertes_urgentes?: boolean
          recap_quotidien?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alertes_urgentes?: boolean
          recap_quotidien?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_admin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      profils_complements: {
        Row: {
          centres_interet: string[]
          en_revue: boolean
          profession: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          centres_interet?: string[]
          en_revue?: boolean
          profession?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          centres_interet?: string[]
          en_revue?: boolean
          profession?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_complements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
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
      relances: {
        Row: {
          a: string
          canal: string
          cree_le: string
          de: string | null
          id: number
          motif: string | null
          vu_le: string | null
        }
        Insert: {
          a: string
          canal: string
          cree_le?: string
          de?: string | null
          id?: never
          motif?: string | null
          vu_le?: string | null
        }
        Update: {
          a?: string
          canal?: string
          cree_le?: string
          de?: string | null
          id?: never
          motif?: string | null
          vu_le?: string | null
        }
        Relationships: []
      }
      sessions_admin: {
        Row: {
          derniere_activite: string
          session_id: string
          user_id: string
        }
        Insert: {
          derniere_activite?: string
          session_id: string
          user_id: string
        }
        Update: {
          derniere_activite?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
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
      admin_action_changer_role: {
        Args: { p_acteur: string; p_cible: string; p_role: string }
        Returns: undefined
      }
      admin_action_desactiver: {
        Args: { p_acteur: string; p_cible: string; p_motif: string }
        Returns: undefined
      }
      admin_action_preparer_reinit_mfa: {
        Args: { p_acteur: string; p_cible: string; p_motif: string }
        Returns: undefined
      }
      admin_action_preparer_suppression: {
        Args: { p_acteur: string; p_cible: string; p_motif: string }
        Returns: undefined
      }
      admin_action_reactiver: {
        Args: { p_acteur: string; p_cible: string }
        Returns: undefined
      }
      admin_action_suspendre: {
        Args: {
          p_acteur: string
          p_cible: string
          p_jusqua?: string
          p_motif: string
        }
        Returns: undefined
      }
      alertes_files: { Args: never; Returns: number }
      anonymiser_compte: { Args: { p_uid: string }; Returns: undefined }
      avatar_valide: { Args: { p_id: string }; Returns: string }
      compter_file: {
        Args: { p_vue: string }
        Returns: {
          nombre: number
          plus_ancien: string
        }[]
      }
      consommer_quota: {
        Args: {
          p_action: string
          p_cle: string
          p_fenetre: number
          p_maximum: number
        }
        Returns: boolean
      }
      controler_acteur_admin: {
        Args: {
          p_acteur: string
          p_cible: string
          p_egal_ok?: boolean
          p_super_requis: boolean
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "profils"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      controler_texte: {
        Args: { p_contexte?: string; p_texte: string }
        Returns: string
      }
      decider_photo: {
        Args: { p_decision: string; p_motif?: string; p_photo_id: number }
        Returns: string
      }
      declencher_recapitulatif: { Args: never; Returns: undefined }
      definir_preferences_admin: {
        Args: { p_alertes: boolean; p_recap: boolean }
        Returns: undefined
      }
      desactiver_mon_compte: {
        Args: { p_confirmation: string }
        Returns: undefined
      }
      distance_empreintes: {
        Args: { p_a: string; p_b: string }
        Returns: number
      }
      donnees_recapitulatif: { Args: never; Returns: Json }
      email_direct_actif: { Args: never; Returns: boolean }
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
      etat_files_admin: {
        Args: never
        Returns: {
          libelle: string
          lien: string
          nom: string
          nombre: number
          plus_ancien: string
        }[]
      }
      exporter_donnees_profils: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_securite: { Args: { p_uid: string }; Returns: Json }
      exporter_mes_donnees: { Args: never; Returns: Json }
      fiche_utilisateur: { Args: { p_id: string }; Returns: Json }
      journaliser:
        | {
            Args: {
              p_acteur: string
              p_action: string
              p_cible_id: string
              p_cible_type: string
              p_details?: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_action: string
              p_cible_id: string
              p_cible_type: string
              p_details?: Json
            }
            Returns: undefined
          }
      lever_suspensions_expirees: { Args: never; Returns: number }
      liste_administrateurs: {
        Args: never
        Returns: {
          created_at: string
          derniere_connexion: string
          email: string
          id: string
          nom: string
          prenom: string
          role: string
          statut: string
          telephone: string
        }[]
      }
      liste_relances: {
        Args: never
        Returns: {
          a_id: string
          a_prenom: string
          canal: string
          cree_le: string
          id: number
          motif: string
          vu_le: string
        }[]
      }
      liste_utilisateurs: {
        Args: {
          p_decalage?: number
          p_depuis?: string
          p_jusqua?: string
          p_limite?: number
          p_recherche?: string
          p_role?: string
          p_statut?: string
        }
        Returns: {
          created_at: string
          email: string
          id: string
          nom: string
          prenom: string
          role: string
          statut: string
          telephone: string
          total: number
        }[]
      }
      marquer_relance_vue: { Args: { p_id: number }; Returns: undefined }
      mes_preferences_admin: {
        Args: never
        Returns: {
          alertes_urgentes: boolean
          recap_quotidien: boolean
        }[]
      }
      mes_relances_non_vues: {
        Args: never
        Returns: {
          cree_le: string
          id: number
          motif: string
        }[]
      }
      mon_avatar: {
        Args: never
        Returns: {
          chemin_valide: string
          motif: string
          statut: string
        }[]
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
      profil_public: {
        Args: { p_id: string }
        Returns: {
          avatar_chemin: string
          centres_interet: string[]
          id: string
          initiale_nom: string
          membre_depuis: string
          prenom: string
          profession: string
          role: string
          type_proprietaire: string
          universite: string
        }[]
      }
      quota_anonyme: {
        Args: { p_action: string; p_session: string }
        Returns: boolean
      }
      quota_envoi_photo: { Args: never; Returns: boolean }
      rang_role: {
        Args: { p_role: Database["public"]["Enums"]["role_utilisateur"] }
        Returns: number
      }
      relancer_admin: {
        Args: { p_canal: string; p_cible: string; p_motif?: string }
        Returns: {
          cible_id: string
          prenom: string
          relance_id: number
          resume: string
        }[]
      }
      resume_files_admin: { Args: never; Returns: string }
      signaler_activite_admin: { Args: never; Returns: undefined }
      taches_planifiees: { Args: never; Returns: undefined }
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
