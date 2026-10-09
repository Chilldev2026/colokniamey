<script setup lang="ts">
// Fiche d'un utilisateur : identité, rôle, statut, compteurs des autres modules, historique d'audit,
// et actions selon le niveau de l'admin connecté. Les actions affichées ne sont qu'un confort (RGA27) :
// l'Edge Function admin-utilisateurs et la base refusent de toute façon ce qui n'est pas permis.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { useAuthStore } from '@/modules/auth'
import ModaleAction from '../components/ModaleAction.vue'
import { executerAction, lireFiche, type ParametresAction } from '../services/utilisateursService'
import {
  actionsPossibles, LIBELLES_ACTION_AUDIT, LIBELLES_ROLE_COMPTE, LIBELLES_STATUT_COMPTE,
  type ActionCompte, type FicheUtilisateur, type RoleCompte,
} from '../types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { afficher } = useToasts()

const fiche = ref<FicheUtilisateur | null>(null)
const chargement = ref(true)
const erreur = ref('')

const actionEnCours = ref<ActionCompte | null>(null)
const modaleOuverte = ref(false)
const envoi = ref(false)
const erreurAction = ref('')

const moi = computed(() => ({ id: auth.session?.user.id ?? '', role: (auth.role ?? 'etudiant') as RoleCompte }))
const actions = computed(() => (fiche.value ? actionsPossibles(moi.value, fiche.value) : []))

/** Description des fenêtres de confirmation : une par action. */
const CONFIGURATION: Record<ActionCompte, { libelle: string; titre: string; description: string; danger: boolean; motif: boolean; duree?: boolean; motCle?: string }> = {
  suspendre: { libelle: 'Suspendre', titre: 'Suspendre ce compte ?', description: 'La personne sera déconnectée de tous ses appareils et ne pourra plus se connecter. Elle est informée du motif.', danger: true, motif: true, duree: true },
  reactiver: { libelle: 'Réactiver', titre: 'Réactiver ce compte ?', description: 'La personne pourra de nouveau se connecter.', danger: false, motif: false },
  changer_role: { libelle: 'Changer le rôle', titre: 'Changer le rôle ?', description: '', danger: false, motif: false },
  desactiver_et_anonymiser: { libelle: 'Désactiver et anonymiser', titre: 'Désactiver et anonymiser ce compte ?', description: 'Les informations personnelles sont effacées ou anonymisées et la personne ne peut plus se connecter. Action définitive.', danger: true, motif: true },
  supprimer_definitivement: { libelle: 'Supprimer définitivement', titre: 'Supprimer définitivement ce compte ?', description: 'Le compte et toutes ses données sont supprimés, photos comprises. Action irréversible, réservée au super-admin.', danger: true, motif: true, motCle: 'SUPPRIMER' },
  reinitialiser_mfa: { libelle: 'Réinitialiser la double authentification', titre: 'Réinitialiser la double authentification ?', description: 'Tous les appareils d\'authentification de cette personne sont retirés et ses sessions fermées. Elle devra en enregistrer un nouveau. Tous les super-admins sont prévenus.', danger: true, motif: true },
}

const config = computed(() => (actionEnCours.value ? CONFIGURATION[actionEnCours.value] : null))
const descriptionModale = computed(() => {
  if (actionEnCours.value !== 'changer_role' || !fiche.value) return config.value?.description ?? ''
  return fiche.value.role === 'admin'
    ? 'Cette personne ne sera plus administratrice et retrouvera son rôle d\'origine.'
    : 'Cette personne deviendra administratrice. Elle devra configurer la double authentification à sa prochaine connexion.'
})
const libelleBouton = computed(() => {
  if (actionEnCours.value === 'changer_role' && fiche.value) return fiche.value.role === 'admin' ? 'Retirer le rôle admin' : 'Nommer administrateur'
  return config.value?.libelle ?? ''
})

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    fiche.value = await lireFiche(String(route.params.id))
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la fiche.'
  } finally {
    chargement.value = false
  }
}

function ouvrir(action: ActionCompte) {
  actionEnCours.value = action
  erreurAction.value = ''
  modaleOuverte.value = true
}

async function confirmer(donnees: { motif: string; jusqua: string }) {
  if (!fiche.value || !actionEnCours.value) return
  const action = actionEnCours.value
  const params: ParametresAction = {}
  if (donnees.motif) params.motif = donnees.motif
  if (donnees.jusqua) params.jusqua = donnees.jusqua
  if (action === 'changer_role') params.role = fiche.value.role === 'admin' ? undefined : 'admin'
  // Le retour d'un admin à son rôle d'origine est choisi par la base ; on envoie un rôle d'origine neutre
  if (action === 'changer_role' && fiche.value.role === 'admin') params.role = fiche.value.universite ? 'etudiant' : 'proprietaire'

  envoi.value = true
  erreurAction.value = ''
  try {
    await executerAction(action, fiche.value.id, params)
    modaleOuverte.value = false
    afficher('Action effectuée et inscrite au journal.', 'succes')
    if (action === 'supprimer_definitivement') {
      await router.replace('/admin/utilisateurs')
    } else {
      await charger()
    }
  } catch (e) {
    erreurAction.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoi.value = false
  }
}

function dateHeure(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
}

const LIBELLES_COMPTEURS: Record<string, string> = { annonces: 'Annonces', signalements_recus: 'Signalements reçus', groupes: 'Groupes' }

onMounted(charger)
</script>

<template>
  <section class="fiche">
    <RouterLink to="/admin/utilisateurs" class="retour">Retour à la liste</RouterLink>
    <ChargementUi v-if="chargement" :lignes="5" />
    <AlerteUi v-else-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <template v-else-if="fiche">
      <div class="entete">
        <h2>{{ fiche.prenom }} {{ fiche.nom }}</h2>
        <PuceUi variante="info">{{ LIBELLES_ROLE_COMPTE[fiche.role] }}</PuceUi>
        <PuceUi :variante="fiche.statut === 'actif' ? 'validee' : 'neutre'">{{ LIBELLES_STATUT_COMPTE[fiche.statut] }}</PuceUi>
      </div>

      <AlerteUi v-if="fiche.statut === 'suspendu'" type="info">
        Suspendu<template v-if="fiche.suspenduJusqua"> jusqu'au {{ dateHeure(fiche.suspenduJusqua) }}</template>.
        Motif : {{ fiche.motifSuspension }}
      </AlerteUi>

      <dl class="identite">
        <div><dt>E-mail</dt><dd>{{ fiche.email }}</dd></div>
        <div><dt>Téléphone</dt><dd>{{ fiche.telephone }}</dd></div>
        <div v-if="fiche.universite"><dt>Université</dt><dd>{{ fiche.universite }}</dd></div>
        <div v-if="fiche.typeProprietaire"><dt>Type</dt><dd>{{ fiche.typeProprietaire === 'agence' ? 'Agence' : 'Particulier' }}</dd></div>
        <div><dt>Inscrit le</dt><dd>{{ dateHeure(fiche.inscritLe) }}</dd></div>
        <div><dt>Dernière connexion</dt><dd>{{ dateHeure(fiche.derniereConnexion) }}</dd></div>
        <div v-for="(valeur, cle) in fiche.compteurs" :key="cle"><dt>{{ LIBELLES_COMPTEURS[cle] ?? cle }}</dt><dd>{{ valeur }}</dd></div>
      </dl>

      <div v-if="actions.length > 0" class="actions">
        <BoutonUi
          v-for="a in actions"
          :key="a"
          :variante="CONFIGURATION[a].danger ? 'danger' : 'secondaire'"
          @click="ouvrir(a)"
        >
          {{ a === 'changer_role' ? (fiche.role === 'admin' ? 'Retirer le rôle admin' : 'Nommer administrateur') : CONFIGURATION[a].libelle }}
        </BoutonUi>
      </div>
      <p v-else class="aucune">Tu ne peux pas agir sur ce compte (c'est le tien, ou son niveau est égal ou supérieur au tien).</p>

      <div class="historique">
        <h3>Historique d'audit</h3>
        <p v-if="fiche.historique.length === 0" class="aucune">Aucune action enregistrée sur ce compte.</p>
        <ul v-else>
          <li v-for="(h, i) in fiche.historique" :key="i">
            <strong>{{ LIBELLES_ACTION_AUDIT[h.action] ?? h.action }}</strong>
            <span class="secondaire">{{ dateHeure(h.date) }}<template v-if="h.acteur"> · par {{ h.acteur }}</template></span>
          </li>
        </ul>
      </div>
    </template>

    <ModaleAction
      v-if="config"
      v-model="modaleOuverte"
      :titre="config.titre"
      :description="descriptionModale"
      :libelle-confirmer="libelleBouton"
      :danger="config.danger"
      :avec-motif="config.motif"
      :avec-duree="config.duree"
      :mot-cle="config.motCle"
      :chargement="envoi"
      :erreur="erreurAction"
      @confirmer="confirmer"
    />
  </section>
</template>

<style scoped>
.fiche {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.retour {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
.entete {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-family: var(--police-titre);
}
.identite {
  display: grid;
  gap: var(--e3);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  margin: 0;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.identite dt,
.secondaire,
.aucune {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.identite dd {
  margin: 0;
  font-weight: 700;
  word-break: break-word;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
.historique {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.historique ul {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.historique li {
  display: flex;
  flex-direction: column;
  padding: var(--e2) var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon-s);
  background: var(--surface);
}
</style>
