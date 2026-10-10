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
      annonce_equipements: {
        Row: {
          annonce_id: number
          equipement_id: number
        }
        Insert: {
          annonce_id: number
          equipement_id: number
        }
        Update: {
          annonce_id?: number
          equipement_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "annonce_equipements_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonce_equipements_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonce_equipements_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
        ]
      }
      annonces: {
        Row: {
          age_max: number | null
          age_min: number | null
          auteur_id: string
          charges_incluses: boolean
          contact_appel: boolean
          contact_whatsapp: boolean
          created_at: string
          description: string
          disponible_le: string | null
          duree_max_mois: number | null
          duree_min_mois: number | null
          en_revue: boolean
          etudiants_uniquement: boolean
          id: number
          loyer_total_fcfa: number | null
          montant_charges_fcfa: number | null
          motif_refus: string | null
          nb_places: number
          part_mensuelle_fcfa: number
          position: unknown
          position_publique: unknown
          precision_position: string
          preference_genre: string
          publiee_le: string | null
          quartier_id: number
          statut: Database["public"]["Enums"]["statut_annonce"]
          titre: string
          type: Database["public"]["Enums"]["type_annonce"]
          universite_proche_id: number | null
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          auteur_id: string
          charges_incluses?: boolean
          contact_appel?: boolean
          contact_whatsapp?: boolean
          created_at?: string
          description: string
          disponible_le?: string | null
          duree_max_mois?: number | null
          duree_min_mois?: number | null
          en_revue?: boolean
          etudiants_uniquement?: boolean
          id?: never
          loyer_total_fcfa?: number | null
          montant_charges_fcfa?: number | null
          motif_refus?: string | null
          nb_places?: number
          part_mensuelle_fcfa: number
          position?: unknown
          position_publique?: unknown
          precision_position?: string
          preference_genre?: string
          publiee_le?: string | null
          quartier_id: number
          statut?: Database["public"]["Enums"]["statut_annonce"]
          titre: string
          type: Database["public"]["Enums"]["type_annonce"]
          universite_proche_id?: number | null
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          auteur_id?: string
          charges_incluses?: boolean
          contact_appel?: boolean
          contact_whatsapp?: boolean
          created_at?: string
          description?: string
          disponible_le?: string | null
          duree_max_mois?: number | null
          duree_min_mois?: number | null
          en_revue?: boolean
          etudiants_uniquement?: boolean
          id?: never
          loyer_total_fcfa?: number | null
          montant_charges_fcfa?: number | null
          motif_refus?: string | null
          nb_places?: number
          part_mensuelle_fcfa?: number
          position?: unknown
          position_publique?: unknown
          precision_position?: string
          preference_genre?: string
          publiee_le?: string | null
          quartier_id?: number
          statut?: Database["public"]["Enums"]["statut_annonce"]
          titre?: string
          type?: Database["public"]["Enums"]["type_annonce"]
          universite_proche_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annonces_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_universite_proche_id_fkey"
            columns: ["universite_proche_id"]
            isOneToOne: false
            referencedRelation: "universites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_universite_proche_id_fkey"
            columns: ["universite_proche_id"]
            isOneToOne: false
            referencedRelation: "universites_geo"
            referencedColumns: ["id"]
          },
        ]
      }
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
      conversations: {
        Row: {
          annonce_id: number | null
          auteur_id: string
          created_at: string
          demandeur_id: string
          dernier_message_le: string
          id: number
        }
        Insert: {
          annonce_id?: number | null
          auteur_id: string
          created_at?: string
          demandeur_id: string
          dernier_message_le?: string
          id?: never
        }
        Update: {
          annonce_id?: number | null
          auteur_id?: string
          created_at?: string
          demandeur_id?: string
          dernier_message_le?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "conversations_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_demandeur_id_fkey"
            columns: ["demandeur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      equipements: {
        Row: {
          actif: boolean
          id: number
          nom: string
          ordre: number
        }
        Insert: {
          actif?: boolean
          id?: never
          nom: string
          ordre?: number
        }
        Update: {
          actif?: boolean
          id?: never
          nom?: string
          ordre?: number
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
      favoris: {
        Row: {
          annonce_id: number
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          annonce_id: number
          created_at?: string
          id?: never
          user_id?: string
        }
        Update: {
          annonce_id?: number
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favoris_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoris_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      files_admin: {
        Row: {
          alerter: boolean
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
          alerter?: boolean
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
          alerter?: boolean
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
      groupes_colocation: {
        Row: {
          annonce_id: number
          created_at: string
          derniere_activite: string
          en_revue: boolean
          id: number
          initiateur_id: string
          message: string | null
          places_recherchees: number
          preferences: string | null
          statut: Database["public"]["Enums"]["statut_groupe"]
        }
        Insert: {
          annonce_id: number
          created_at?: string
          derniere_activite?: string
          en_revue?: boolean
          id?: never
          initiateur_id: string
          message?: string | null
          places_recherchees: number
          preferences?: string | null
          statut?: Database["public"]["Enums"]["statut_groupe"]
        }
        Update: {
          annonce_id?: number
          created_at?: string
          derniere_activite?: string
          en_revue?: boolean
          id?: never
          initiateur_id?: string
          message?: string | null
          places_recherchees?: number
          preferences?: string | null
          statut?: Database["public"]["Enums"]["statut_groupe"]
        }
        Relationships: [
          {
            foreignKeyName: "groupes_colocation_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupes_colocation_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groupes_colocation_initiateur_id_fkey"
            columns: ["initiateur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
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
      membres_groupe: {
        Row: {
          created_at: string
          groupe_id: number
          id: number
          role: string
          statut: Database["public"]["Enums"]["statut_membre"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          groupe_id: number
          id?: never
          role?: string
          statut?: Database["public"]["Enums"]["statut_membre"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          groupe_id?: number
          id?: never
          role?: string
          statut?: Database["public"]["Enums"]["statut_membre"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membres_groupe_groupe_id_fkey"
            columns: ["groupe_id"]
            isOneToOne: false
            referencedRelation: "groupes_colocation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membres_groupe_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          contenu: string
          conversation_id: number
          created_at: string
          expediteur_id: string
          id: number
          lu_le: string | null
        }
        Insert: {
          contenu: string
          conversation_id: number
          created_at?: string
          expediteur_id?: string
          id?: never
          lu_le?: string | null
        }
        Update: {
          contenu?: string
          conversation_id?: number
          created_at?: string
          expediteur_id?: string
          id?: never
          lu_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_expediteur_id_fkey"
            columns: ["expediteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
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
      photos_annonces: {
        Row: {
          annonce_id: number
          id: number
          ordre: number
          photo_id: number
        }
        Insert: {
          annonce_id: number
          id?: never
          ordre?: number
          photo_id: number
        }
        Update: {
          annonce_id?: number
          id?: never
          ordre?: number
          photo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_annonces_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_annonces_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: true
            referencedRelation: "photos"
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
      regles_annonce: {
        Row: {
          annonce_id: number
          en_revue: boolean
          id: number
          ordre: number
          texte: string
        }
        Insert: {
          annonce_id: number
          en_revue?: boolean
          id?: never
          ordre?: number
          texte: string
        }
        Update: {
          annonce_id?: number
          en_revue?: boolean
          id?: never
          ordre?: number
          texte?: string
        }
        Relationships: [
          {
            foreignKeyName: "regles_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regles_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
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
      signalements: {
        Row: {
          auteur_id: string
          cible_auteur_id: string | null
          cible_id: string
          cible_type: string
          commentaire: string | null
          created_at: string
          decide_le: string | null
          decision: string | null
          decision_commentaire: string | null
          id: number
          message_contenu: string | null
          message_le: string | null
          motif: Database["public"]["Enums"]["motif_signalement"]
          statut: Database["public"]["Enums"]["statut_signalement"]
          traite_par: string | null
          updated_at: string
        }
        Insert: {
          auteur_id: string
          cible_auteur_id?: string | null
          cible_id: string
          cible_type: string
          commentaire?: string | null
          created_at?: string
          decide_le?: string | null
          decision?: string | null
          decision_commentaire?: string | null
          id?: never
          message_contenu?: string | null
          message_le?: string | null
          motif: Database["public"]["Enums"]["motif_signalement"]
          statut?: Database["public"]["Enums"]["statut_signalement"]
          traite_par?: string | null
          updated_at?: string
        }
        Update: {
          auteur_id?: string
          cible_auteur_id?: string | null
          cible_id?: string
          cible_type?: string
          commentaire?: string | null
          created_at?: string
          decide_le?: string | null
          decision?: string | null
          decision_commentaire?: string | null
          id?: never
          message_contenu?: string | null
          message_le?: string | null
          motif?: Database["public"]["Enums"]["motif_signalement"]
          statut?: Database["public"]["Enums"]["statut_signalement"]
          traite_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signalements_cible_auteur_id_fkey"
            columns: ["cible_auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      taches_annonce: {
        Row: {
          annonce_id: number
          en_revue: boolean
          frequence: string
          id: number
          libelle: string
          ordre: number
          repartition: string
        }
        Insert: {
          annonce_id: number
          en_revue?: boolean
          frequence: string
          id?: never
          libelle: string
          ordre?: number
          repartition: string
        }
        Update: {
          annonce_id?: number
          en_revue?: boolean
          frequence?: string
          id?: never
          libelle?: string
          ordre?: number
          repartition?: string
        }
        Relationships: [
          {
            foreignKeyName: "taches_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taches_annonce_annonce_id_fkey"
            columns: ["annonce_id"]
            isOneToOne: false
            referencedRelation: "annonces_publiques"
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
      verifications_identite: {
        Row: {
          chemin_recto: string | null
          chemin_selfie: string | null
          chemin_verso: string | null
          code_selfie: string
          consentement_le: string | null
          created_at: string
          decide_le: string | null
          decide_par: string | null
          empreinte_avatar_verifie: string | null
          empreinte_recto: string | null
          empreinte_selfie: string | null
          empreinte_verso: string | null
          id: string
          images_effacees_le: string | null
          motif_refus: string | null
          nom_verifie: string | null
          prenom_verifie: string | null
          soumis_le: string | null
          statut: Database["public"]["Enums"]["statut_kyc"]
          suspect: boolean
          type_piece: Database["public"]["Enums"]["type_piece"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chemin_recto?: string | null
          chemin_selfie?: string | null
          chemin_verso?: string | null
          code_selfie: string
          consentement_le?: string | null
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          empreinte_avatar_verifie?: string | null
          empreinte_recto?: string | null
          empreinte_selfie?: string | null
          empreinte_verso?: string | null
          id?: string
          images_effacees_le?: string | null
          motif_refus?: string | null
          nom_verifie?: string | null
          prenom_verifie?: string | null
          soumis_le?: string | null
          statut?: Database["public"]["Enums"]["statut_kyc"]
          suspect?: boolean
          type_piece?: Database["public"]["Enums"]["type_piece"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chemin_recto?: string | null
          chemin_selfie?: string | null
          chemin_verso?: string | null
          code_selfie?: string
          consentement_le?: string | null
          created_at?: string
          decide_le?: string | null
          decide_par?: string | null
          empreinte_avatar_verifie?: string | null
          empreinte_recto?: string | null
          empreinte_selfie?: string | null
          empreinte_verso?: string | null
          id?: string
          images_effacees_le?: string | null
          motif_refus?: string | null
          nom_verifie?: string | null
          prenom_verifie?: string | null
          soumis_le?: string | null
          statut?: Database["public"]["Enums"]["statut_kyc"]
          suspect?: boolean
          type_piece?: Database["public"]["Enums"]["type_piece"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_identite_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profils"
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
      annonces_publiques: {
        Row: {
          age_max: number | null
          age_min: number | null
          auteur_id: string | null
          charges_incluses: boolean | null
          contact_appel: boolean | null
          contact_whatsapp: boolean | null
          description: string | null
          disponible_le: string | null
          distance_universite_m: number | null
          duree_max_mois: number | null
          duree_min_mois: number | null
          etudiants_uniquement: boolean | null
          id: number | null
          latitude: number | null
          longitude: number | null
          loyer_total_fcfa: number | null
          montant_charges_fcfa: number | null
          nb_places: number | null
          part_mensuelle_fcfa: number | null
          photo_chemin: string | null
          precision_position: string | null
          preference_genre: string | null
          publiee_le: string | null
          quartier_id: number | null
          titre: string | null
          type: Database["public"]["Enums"]["type_annonce"] | null
          universite_proche_id: number | null
          zone_rayon_m: number | null
        }
        Relationships: [
          {
            foreignKeyName: "annonces_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_quartier_id_fkey"
            columns: ["quartier_id"]
            isOneToOne: false
            referencedRelation: "quartiers_geo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_universite_proche_id_fkey"
            columns: ["universite_proche_id"]
            isOneToOne: false
            referencedRelation: "universites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annonces_universite_proche_id_fkey"
            columns: ["universite_proche_id"]
            isOneToOne: false
            referencedRelation: "universites_geo"
            referencedColumns: ["id"]
          },
        ]
      }
      file_annonces: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
      file_contenus: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
      file_identites: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
      file_photos: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
      file_signalements: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
      file_universites_a_placer: {
        Row: {
          nombre: number | null
          plus_ancien: string | null
        }
        Relationships: []
      }
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
      annonce_a_moderer: { Args: { p_id: number }; Returns: Json }
      annonces_carte: {
        Args: { p_emprise: Json; p_filtres?: Json; p_limite?: number }
        Returns: {
          distance_ref_m: number
          groupe_en_formation: boolean
          id: number
          latitude: number
          longitude: number
          part_mensuelle_fcfa: number
          photo_chemin: string
          quartier_id: number
          titre: string
          type: string
          zone_rayon_m: number
        }[]
      }
      annuler_kyc: { Args: never; Returns: undefined }
      anonymiser_compte: { Args: { p_uid: string }; Returns: undefined }
      archiver_annonce: { Args: { p_annonce_id: number }; Returns: undefined }
      auteur_actif: { Args: { p_uid: string }; Returns: boolean }
      autoriser_consultation_kyc: {
        Args: { p_id: string; p_image: string }
        Returns: string
      }
      avatar_valide: { Args: { p_id: string }; Returns: string }
      capacite_groupe: { Args: { p_groupe_id: number }; Returns: number }
      cloturer_groupes_inactifs: { Args: never; Returns: number }
      cloturer_signalement: {
        Args: { p_commentaire?: string; p_decision: string; p_id: number }
        Returns: undefined
      }
      compter_file: {
        Args: { p_vue: string }
        Returns: {
          nombre: number
          plus_ancien: string
        }[]
      }
      compter_groupes_annonces: {
        Args: { p_ids: number[] }
        Returns: {
          annonce_id: number
          nombre: number
        }[]
      }
      compter_groupes_en_formation: {
        Args: { p_annonce_id: number }
        Returns: number
      }
      compteurs_utilisateur_annonces: { Args: { p_uid: string }; Returns: Json }
      compteurs_utilisateur_identite: { Args: { p_uid: string }; Returns: Json }
      compteurs_utilisateur_signalements: {
        Args: { p_uid: string }
        Returns: Json
      }
      consentir_kyc: { Args: never; Returns: undefined }
      consommer_quota: {
        Args: {
          p_action: string
          p_cle: string
          p_fenetre: number
          p_maximum: number
        }
        Returns: boolean
      }
      contact_annonce: {
        Args: { p_annonce_id: number }
        Returns: {
          telephone: string
          whatsapp: string
        }[]
      }
      contenu_a_verifier: { Args: { p_id: number }; Returns: Json }
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
      creer_groupe: {
        Args: {
          p_annonce_id: number
          p_message?: string
          p_places: number
          p_preferences?: string
        }
        Returns: number
      }
      decider_contenu: {
        Args: { p_id: number; p_motif?: string; p_publier: boolean }
        Returns: undefined
      }
      decider_kyc: {
        Args: { p_id: string; p_motif?: string; p_valide: boolean }
        Returns: undefined
      }
      decider_photo: {
        Args: { p_decision: string; p_motif?: string; p_photo_id: number }
        Returns: string
      }
      declencher_purge_kyc: { Args: never; Returns: undefined }
      declencher_recapitulatif: { Args: never; Returns: undefined }
      definir_maintenance: {
        Args: { p_active: boolean; p_fin?: string; p_message?: string }
        Returns: undefined
      }
      definir_preferences_admin: {
        Args: { p_alertes: boolean; p_recap: boolean }
        Returns: undefined
      }
      definir_terme_actif: {
        Args: { p_actif: boolean; p_id: number }
        Returns: undefined
      }
      demander_adhesion: { Args: { p_groupe_id: number }; Returns: undefined }
      demarrer_conversation: {
        Args: { p_annonce_id: number; p_message: string }
        Returns: number
      }
      demarrer_kyc: {
        Args: never
        Returns: {
          code: string
          verification_id: string
        }[]
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
      dossier_kyc_admin: {
        Args: { p_id: string }
        Returns: {
          avatar_chemin: string
          code_selfie: string
          id: string
          images_disponibles: boolean
          motif_refus: string
          nom: string
          prenom: string
          soumis_le: string
          statut: string
          suspect: boolean
          type_piece: string
        }[]
      }
      email_direct_actif: { Args: never; Returns: boolean }
      empreinte_avatar_actuel: { Args: { p_uid: string }; Returns: string }
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
      est_etudiant: { Args: never; Returns: boolean }
      est_initiateur_groupe: { Args: { p_groupe_id: number }; Returns: boolean }
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
      exiger_etudiant_verifie: { Args: never; Returns: undefined }
      exiger_identite_verifiee: { Args: never; Returns: undefined }
      exporter_donnees_annonces: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_groupes: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_identite: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_messagerie: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_profils: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_recherche: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_securite: { Args: { p_uid: string }; Returns: Json }
      exporter_donnees_signalements: { Args: { p_uid: string }; Returns: Json }
      exporter_mes_donnees: { Args: never; Returns: Json }
      fiche_signalement: { Args: { p_id: number }; Returns: Json }
      fiche_utilisateur: { Args: { p_id: string }; Returns: Json }
      filtrer_annonces: {
        Args: { p_filtres: Json }
        Returns: {
          age_max: number | null
          age_min: number | null
          auteur_id: string | null
          charges_incluses: boolean | null
          contact_appel: boolean | null
          contact_whatsapp: boolean | null
          description: string | null
          disponible_le: string | null
          distance_universite_m: number | null
          duree_max_mois: number | null
          duree_min_mois: number | null
          etudiants_uniquement: boolean | null
          id: number | null
          latitude: number | null
          longitude: number | null
          loyer_total_fcfa: number | null
          montant_charges_fcfa: number | null
          nb_places: number | null
          part_mensuelle_fcfa: number | null
          photo_chemin: string | null
          precision_position: string | null
          preference_genre: string | null
          publiee_le: string | null
          quartier_id: number | null
          titre: string | null
          type: Database["public"]["Enums"]["type_annonce"] | null
          universite_proche_id: number | null
          zone_rayon_m: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "annonces_publiques"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      groupes_actifs_de: { Args: { p_uid: string }; Returns: number }
      groupes_du_logement: {
        Args: { p_annonce_id: number }
        Returns: {
          id: number
          initiateur_id: string
          initiateur_initiale: string
          initiateur_prenom: string
          membres: number
          message: string
          mon_statut: string
          part_estimee_fcfa: number
          places_recherchees: number
          places_restantes: number
          preferences: string
          statut: string
        }[]
      }
      identite_conforme: { Args: { p_uid: string }; Returns: boolean }
      identite_verifiee: { Args: { p_uid: string }; Returns: boolean }
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
      kyc_actif: { Args: never; Returns: boolean }
      kyc_enregistrer_image: {
        Args: {
          p_chemin: string
          p_empreinte: string
          p_type: string
          p_uid: string
          p_verification: string
        }
        Returns: undefined
      }
      kyc_images_a_effacer: {
        Args: { p_uid?: string }
        Returns: {
          chemins: string[]
          id: string
        }[]
      }
      kyc_marquer_effacees: { Args: { p_ids: string[] }; Returns: undefined }
      kyc_preparer_depot: {
        Args: { p_uid: string; p_verification: string }
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
      liste_annonces_a_valider: {
        Args: never
        Returns: {
          auteur_id: string
          en_revue: boolean
          id: number
          initiale_nom: string
          partie_le: string
          prenom: string
          titre: string
          type: string
        }[]
      }
      liste_contenus_a_verifier: {
        Args: never
        Returns: {
          auteur_id: string
          categories: string[]
          created_at: string
          id: number
          prenom: string
          type_contenu: string
        }[]
      }
      liste_conversations: {
        Args: never
        Returns: {
          annonce_id: number
          annonce_titre: string
          autre_id: string
          autre_initiale: string
          autre_prenom: string
          dernier_message_le: string
          id: number
          non_lus: number
        }[]
      }
      liste_dossiers_kyc: {
        Args: { p_statut?: string }
        Returns: {
          decide_le: string
          id: string
          nom: string
          prenom: string
          soumis_le: string
          statut: string
          suspect: boolean
          type_piece: string
        }[]
      }
      liste_parametres: {
        Args: never
        Returns: {
          cle: string
          modifie_le: string
          publique: boolean
          valeur: Json
        }[]
      }
      liste_photos_a_valider: {
        Args: never
        Returns: {
          auteur_id: string
          chemin: string
          created_at: string
          id: number
          initiale_nom: string
          prenom: string
          suspecte: boolean
          usage: string
        }[]
      }
      liste_recidives: {
        Args: never
        Returns: {
          dernier: string
          initiale_nom: string
          nombre: number
          prenom: string
          user_id: string
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
      liste_signalements: {
        Args: { p_motif?: string; p_statut?: string }
        Returns: {
          cible_type: string
          created_at: string
          id: number
          motif: string
          nb_sur_la_cible: number
          pris_par_moi: boolean
          pris_par_un_autre: boolean
          statut: string
        }[]
      }
      liste_termes: {
        Args: never
        Returns: {
          actif: boolean
          categorie: string
          created_at: string
          id: number
          langue: string
          niveau: string
          propose_par_moi: boolean
          terme: string
          valide: boolean
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
      ma_conversation_annonce: {
        Args: { p_annonce_id: number }
        Returns: number
      }
      marquer_lu: { Args: { p_conversation_id: number }; Returns: number }
      marquer_relance_vue: { Args: { p_id: number }; Returns: undefined }
      membres_acceptes: { Args: { p_groupe_id: number }; Returns: number }
      membres_du_groupe: {
        Args: { p_groupe_id: number }
        Returns: {
          initiale: string
          membre_id: number
          prenom: string
          role: string
          statut: string
          user_id: string
        }[]
      }
      mes_favoris: {
        Args: never
        Returns: {
          age_max: number | null
          age_min: number | null
          auteur_id: string | null
          charges_incluses: boolean | null
          contact_appel: boolean | null
          contact_whatsapp: boolean | null
          description: string | null
          disponible_le: string | null
          distance_universite_m: number | null
          duree_max_mois: number | null
          duree_min_mois: number | null
          etudiants_uniquement: boolean | null
          id: number | null
          latitude: number | null
          longitude: number | null
          loyer_total_fcfa: number | null
          montant_charges_fcfa: number | null
          nb_places: number | null
          part_mensuelle_fcfa: number | null
          photo_chemin: string | null
          precision_position: string | null
          preference_genre: string | null
          publiee_le: string | null
          quartier_id: number | null
          titre: string | null
          type: Database["public"]["Enums"]["type_annonce"] | null
          universite_proche_id: number | null
          zone_rayon_m: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "annonces_publiques"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mes_groupes: {
        Args: never
        Returns: {
          annonce_id: number
          annonce_titre: string
          demandes_en_attente: number
          derniere_activite: string
          id: number
          membres: number
          mon_role: string
          mon_statut: string
          part_estimee_fcfa: number
          places_recherchees: number
          statut: string
        }[]
      }
      mes_messages_non_lus: { Args: never; Returns: number }
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
      modifier_parametre: {
        Args: { p_cle: string; p_valeur: Json }
        Returns: undefined
      }
      modifier_terme: {
        Args: {
          p_categorie: string
          p_id: number
          p_langue: string
          p_niveau: string
          p_terme: string
        }
        Returns: undefined
      }
      mon_avatar: {
        Args: never
        Returns: {
          chemin_valide: string
          motif: string
          statut: string
        }[]
      }
      mon_kyc: {
        Args: never
        Returns: {
          code_selfie: string
          consentement: boolean
          decide_le: string
          dossiers_restants: number
          motif_refus: string
          recto: boolean
          selfie: boolean
          statut: string
          type_piece: string
          verification_id: string
          verifiee: boolean
          verso: boolean
        }[]
      }
      motif_moderation: { Args: { p_motif: string }; Returns: string }
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
      peut_voir_groupe: { Args: { p_groupe_id: number }; Returns: boolean }
      photo_principale_annonce: {
        Args: { p_annonce_id: number }
        Returns: string
      }
      photos_annonce: {
        Args: { p_annonce_id: number }
        Returns: {
          chemin: string
          ordre: number
        }[]
      }
      position_annonce: {
        Args: { p_annonce_id: number }
        Returns: {
          latitude: number
          longitude: number
          precision_position: string
        }[]
      }
      precontroler_photo: { Args: { p_empreinte: string }; Returns: undefined }
      prendre_en_charge_signalement: {
        Args: { p_id: number }
        Returns: undefined
      }
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
      proposer_terme: {
        Args: {
          p_categorie: string
          p_langue?: string
          p_niveau: string
          p_terme: string
        }
        Returns: number
      }
      quitter_groupe: { Args: { p_groupe_id: number }; Returns: undefined }
      quota_anonyme: {
        Args: { p_action: string; p_session: string }
        Returns: boolean
      }
      quota_envoi_photo: { Args: never; Returns: boolean }
      rang_role: {
        Args: { p_role: Database["public"]["Enums"]["role_utilisateur"] }
        Returns: number
      }
      rechercher_annonces: {
        Args: {
          p_curseur?: Json
          p_filtres?: Json
          p_limite?: number
          p_tri?: string
        }
        Returns: {
          curseur_valeur: string
          disponible_le: string
          distance_ref_m: number
          distance_universite_m: number
          id: number
          latitude: number
          longitude: number
          loyer_total_fcfa: number
          nb_places: number
          part_mensuelle_fcfa: number
          photo_chemin: string
          publiee_le: string
          quartier_id: number
          titre: string
          type: string
          universite_proche_id: number
          zone_rayon_m: number
        }[]
      }
      refuser_annonce: {
        Args: { p_id: number; p_motif: string }
        Returns: undefined
      }
      rejeter_terme: { Args: { p_id: number }; Returns: undefined }
      relacher_signalement: { Args: { p_id: number }; Returns: undefined }
      relancer_admin: {
        Args: { p_canal: string; p_cible: string; p_motif?: string }
        Returns: {
          cible_id: string
          prenom: string
          relance_id: number
          resume: string
        }[]
      }
      repondre_demande: {
        Args: { p_accepter: boolean; p_membre_id: number }
        Returns: undefined
      }
      resume_files_admin: { Args: never; Returns: string }
      retirer_annonce: {
        Args: { p_id: number; p_motif: string }
        Returns: undefined
      }
      rouvrir_annonce: { Args: { p_annonce_id: number }; Returns: undefined }
      signalement_ouvert: {
        Args: { p_cible_id: string; p_cible_type: string }
        Returns: boolean
      }
      signaler: {
        Args: {
          p_cible_id: string
          p_cible_type: string
          p_commentaire?: string
          p_motif: Database["public"]["Enums"]["motif_signalement"]
        }
        Returns: number
      }
      signaler_activite_admin: { Args: never; Returns: undefined }
      soumettre_annonce: { Args: { p_annonce_id: number }; Returns: string }
      soumettre_kyc: { Args: { p_type_piece: string }; Returns: undefined }
      taches_planifiees: { Args: never; Returns: undefined }
      valider_annonce: { Args: { p_id: number }; Returns: undefined }
      valider_terme: { Args: { p_id: number }; Returns: undefined }
      verifier_empreinte: {
        Args: { p_auteur: string; p_empreinte: string }
        Returns: boolean
      }
      verifier_participation: {
        Args: { p_annonce_id: number; p_uid: string }
        Returns: undefined
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
      motif_signalement:
        | "arnaque"
        | "contenu_inapproprie"
        | "fausse_annonce"
        | "harcelement"
        | "autre"
      role_utilisateur: "etudiant" | "proprietaire" | "admin" | "super_admin"
      statut_annonce:
        | "brouillon"
        | "en_attente"
        | "publiee"
        | "refusee"
        | "archivee"
      statut_compte: "actif" | "suspendu" | "desactive"
      statut_groupe: "en_formation" | "complet" | "cloture"
      statut_kyc: "non_soumis" | "en_attente" | "valide" | "refuse"
      statut_membre: "en_attente" | "accepte" | "refuse" | "parti"
      statut_signalement: "nouveau" | "en_cours" | "traite" | "rejete"
      type_annonce: "chambre" | "studio" | "appartement" | "place_colocation"
      type_piece: "cni" | "passeport"
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
      motif_signalement: [
        "arnaque",
        "contenu_inapproprie",
        "fausse_annonce",
        "harcelement",
        "autre",
      ],
      role_utilisateur: ["etudiant", "proprietaire", "admin", "super_admin"],
      statut_annonce: [
        "brouillon",
        "en_attente",
        "publiee",
        "refusee",
        "archivee",
      ],
      statut_compte: ["actif", "suspendu", "desactive"],
      statut_groupe: ["en_formation", "complet", "cloture"],
      statut_kyc: ["non_soumis", "en_attente", "valide", "refuse"],
      statut_membre: ["en_attente", "accepte", "refuse", "parti"],
      statut_signalement: ["nouveau", "en_cours", "traite", "rejete"],
      type_annonce: ["chambre", "studio", "appartement", "place_colocation"],
      type_piece: ["cni", "passeport"],
    },
  },
} as const
