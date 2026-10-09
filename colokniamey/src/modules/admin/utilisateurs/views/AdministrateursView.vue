<script setup lang="ts">
// Page Administrateurs (super-admin seulement) : liste des admins, nomination, relances (RGA31, RGA32).
// Les droits sont vérifiés par la base et l'Edge Function ; cette page ne fait que les présenter.
import { computed, onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import ModaleAction from '../components/ModaleAction.vue'
import { lienMailto, lienWhatsApp, messageRelance, SUJET_RELANCE } from '../liens'
import {
  emailDirectActif, envoyerEmailDirect, executerAction, listerAdministrateurs, listerRelances, listerUtilisateurs, relancer,
} from '../services/utilisateursService'
import {
  LIBELLES_STATUT_COMPTE, type ActionCompte, type AdminRelance, type Administrateur, type SuiviRelance, type UtilisateurListe,
} from '../types'

const { afficher } = useToasts()

const admins = ref<Administrateur[]>([])
const suivi = ref<SuiviRelance[]>([])
const chargement = ref(true)
const erreur = ref('')

async function charger() {
  chargement.value = true
  erreur.value = ''
  try {
    ;[admins.value, suivi.value] = await Promise.all([listerAdministrateurs(), listerRelances()])
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la page.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

const relancables = computed(() => admins.value.filter((a) => a.role === 'admin' && a.statut === 'actif'))

// --- Actions sur un admin (rétrograder, suspendre, réactiver) ---
const actionCible = ref<{ action: ActionCompte; admin: Administrateur } | null>(null)
const modaleAction = ref(false)
const envoiAction = ref(false)
const erreurAction = ref('')

function ouvrirAction(action: ActionCompte, admin: Administrateur) {
  actionCible.value = { action, admin }
  erreurAction.value = ''
  modaleAction.value = true
}

async function confirmerAction(donnees: { motif: string; jusqua: string }) {
  if (!actionCible.value) return
  const { action, admin } = actionCible.value
  envoiAction.value = true
  erreurAction.value = ''
  try {
    await executerAction(action, admin.id, {
      motif: donnees.motif || undefined,
      jusqua: donnees.jusqua || undefined,
      role: action === 'changer_role' ? 'etudiant' : undefined,
    })
    modaleAction.value = false
    afficher('Action effectuée et inscrite au journal.', 'succes')
    await charger()
  } catch (e) {
    erreurAction.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoiAction.value = false
  }
}

// --- Nommer un administrateur ---
const recherche = ref('')
const candidats = ref<UtilisateurListe[]>([])
const rechercheFaite = ref(false)
const erreurRecherche = ref('')
const aNommer = ref<UtilisateurListe | null>(null)
const modaleNomination = ref(false)
const envoiNomination = ref(false)
const erreurNomination = ref('')

async function chercherCandidats() {
  erreurRecherche.value = ''
  if (recherche.value.trim().length < 3) {
    erreurRecherche.value = 'Entre au moins 3 caractères.'
    return
  }
  try {
    const { lignes } = await listerUtilisateurs({ recherche: recherche.value, role: '', statut: 'actif', depuis: '', jusqua: '' }, 1)
    candidats.value = lignes.filter((u) => u.role === 'etudiant' || u.role === 'proprietaire')
    rechercheFaite.value = true
  } catch (e) {
    erreurRecherche.value = e instanceof Error ? e.message : 'Recherche impossible.'
  }
}

function ouvrirNomination(u: UtilisateurListe) {
  aNommer.value = u
  erreurNomination.value = ''
  modaleNomination.value = true
}

async function confirmerNomination() {
  if (!aNommer.value) return
  envoiNomination.value = true
  erreurNomination.value = ''
  try {
    await executerAction('changer_role', aNommer.value.id, { role: 'admin' })
    modaleNomination.value = false
    candidats.value = []
    rechercheFaite.value = false
    recherche.value = ''
    afficher('Administrateur nommé. Il devra configurer la double authentification.', 'succes')
    await charger()
  } catch (e) {
    erreurNomination.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoiNomination.value = false
  }
}

// --- Relances ---
const modaleRelance = ref(false)
const cibleRelance = ref<Administrateur | null>(null) // null = tous
const canal = ref<'notification' | 'email' | 'whatsapp'>('notification')
const motifRelance = ref('')
const envoiRelance = ref(false)
const erreurRelance = ref('')
const resultat = ref<AdminRelance[] | null>(null)

function ouvrirRelance(cible: Administrateur | null) {
  cibleRelance.value = cible
  canal.value = 'notification'
  motifRelance.value = ''
  erreurRelance.value = ''
  resultat.value = null
  modaleRelance.value = true
}

async function confirmerRelance() {
  envoiRelance.value = true
  erreurRelance.value = ''
  try {
    const relances = await relancer(cibleRelance.value?.id ?? null, canal.value, motifRelance.value)
    if (canal.value === 'email' && (await emailDirectActif().catch(() => false))) {
      // Le domaine d'envoi est vérifié : l'e-mail part directement de l'application
      await Promise.all(relances.map((r) => envoyerEmailDirect(r.cibleId, SUJET_RELANCE, messageRelance(r.resume, window.location.origin))))
      modaleRelance.value = false
      afficher(`${relances.length} e-mail${relances.length > 1 ? 's' : ''} envoyé${relances.length > 1 ? 's' : ''}.`, 'succes')
    } else if (canal.value === 'notification') {
      modaleRelance.value = false
      afficher(`${relances.length} administrateur${relances.length > 1 ? 's' : ''} relancé${relances.length > 1 ? 's' : ''}.`, 'succes')
    } else {
      // E-mail ou WhatsApp depuis la messagerie du super-admin : on affiche les liens préremplis
      resultat.value = relances
    }
    await charger()
  } catch (e) {
    erreurRelance.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoiRelance.value = false
  }
}

function admin(id: string): Administrateur | undefined {
  return admins.value.find((a) => a.id === id)
}

const liensEmail = computed(() => {
  if (!resultat.value || canal.value !== 'email') return null
  const adresses = resultat.value.map((r) => admin(r.cibleId)?.email).filter((e): e is string => Boolean(e))
  return adresses.length > 0 ? lienMailto(adresses, SUJET_RELANCE, messageRelance(resultat.value[0]!.resume, window.location.origin)) : null
})

function lienWhatsAppPour(r: AdminRelance): string | null {
  const a = admin(r.cibleId)
  return a ? lienWhatsApp(a.telephone, messageRelance(r.resume, window.location.origin)) : null
}

function dateHeure(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''
}
const LIBELLES_CANAL = { notification: 'Application', email: 'E-mail', whatsapp: 'WhatsApp' } as const
</script>

<template>
  <section class="administrateurs">
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-else-if="chargement" :lignes="5" />

    <template v-else>
      <div class="bloc">
        <div class="titre-bloc">
          <h2>Administrateurs</h2>
          <BoutonUi variante="action" :desactive="relancables.length === 0" @click="ouvrirRelance(null)">Relancer tous les admins</BoutonUi>
        </div>
        <div class="defilement">
          <table>
            <thead>
              <tr><th scope="col">Nom</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">Dernière connexion</th><th scope="col">Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in admins" :key="a.id">
                <td><RouterLink :to="`/admin/utilisateurs/${a.id}`">{{ a.prenom }} {{ a.nom }}</RouterLink><br /><span class="secondaire">{{ a.email }}</span></td>
                <td><PuceUi variante="info">{{ a.role === 'super_admin' ? 'Super-admin' : 'Admin' }}</PuceUi></td>
                <td><PuceUi :variante="a.statut === 'actif' ? 'validee' : 'neutre'">{{ LIBELLES_STATUT_COMPTE[a.statut] }}</PuceUi></td>
                <td>{{ dateHeure(a.derniereConnexion) || '-' }}</td>
                <td>
                  <div v-if="a.role === 'admin'" class="actions-ligne">
                    <BoutonUi v-if="a.statut === 'actif'" variante="secondaire" @click="ouvrirRelance(a)">Relancer</BoutonUi>
                    <BoutonUi v-if="a.statut === 'actif'" variante="secondaire" @click="ouvrirAction('changer_role', a)">Rétrograder</BoutonUi>
                    <BoutonUi v-if="a.statut === 'actif'" variante="danger" @click="ouvrirAction('suspendre', a)">Suspendre</BoutonUi>
                    <BoutonUi v-else-if="a.statut === 'suspendu'" variante="secondaire" @click="ouvrirAction('reactiver', a)">Réactiver</BoutonUi>
                  </div>
                  <span v-else class="secondaire">Géré par script SQL</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bloc">
        <h2>Nommer un administrateur</h2>
        <form class="recherche" @submit.prevent="chercherCandidats">
          <ChampUi v-model="recherche" libelle="Nom, e-mail ou téléphone de l'utilisateur" :erreur="erreurRecherche" />
          <BoutonUi type="submit" variante="secondaire">Chercher</BoutonUi>
        </form>
        <p v-if="rechercheFaite && candidats.length === 0" class="secondaire">Aucun étudiant ou propriétaire actif ne correspond.</p>
        <ul v-if="candidats.length > 0" class="candidats">
          <li v-for="u in candidats" :key="u.id">
            <span>{{ u.prenom }} {{ u.nom }} <span class="secondaire">({{ u.email }})</span></span>
            <BoutonUi variante="principal" @click="ouvrirNomination(u)">Nommer admin</BoutonUi>
          </li>
        </ul>
      </div>

      <div class="bloc">
        <h2>Suivi des relances</h2>
        <p v-if="suivi.length === 0" class="secondaire">Aucune relance pour le moment.</p>
        <div v-else class="defilement">
          <table>
            <thead><tr><th scope="col">Admin</th><th scope="col">Canal</th><th scope="col">Envoyée le</th><th scope="col">Vu le</th></tr></thead>
            <tbody>
              <tr v-for="r in suivi" :key="r.id">
                <td>{{ r.aPrenom }}</td>
                <td>{{ LIBELLES_CANAL[r.canal] }}</td>
                <td>{{ dateHeure(r.creeLe) }}</td>
                <td>{{ r.vuLe ? dateHeure(r.vuLe) : 'Pas encore vu' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <ModaleAction
      v-if="actionCible"
      v-model="modaleAction"
      :titre="actionCible.action === 'changer_role' ? 'Rétrograder cet administrateur ?' : actionCible.action === 'suspendre' ? 'Suspendre cet administrateur ?' : 'Réactiver cet administrateur ?'"
      :description="actionCible.action === 'changer_role' ? 'Il retrouvera son rôle d\'origine et perdra l\'accès à l\'espace admin.' : ''"
      :libelle-confirmer="actionCible.action === 'changer_role' ? 'Rétrograder' : actionCible.action === 'suspendre' ? 'Suspendre' : 'Réactiver'"
      :danger="actionCible.action === 'suspendre'"
      :avec-motif="actionCible.action === 'suspendre'"
      :avec-duree="actionCible.action === 'suspendre'"
      :chargement="envoiAction"
      :erreur="erreurAction"
      @confirmer="confirmerAction"
    />

    <ModaleUi v-model="modaleNomination" titre="Nommer un administrateur ?">
      <p v-if="aNommer">{{ aNommer.prenom }} {{ aNommer.nom }} deviendra administrateur et devra configurer la double authentification à sa prochaine connexion.</p>
      <AlerteUi v-if="erreurNomination" type="erreur">{{ erreurNomination }}</AlerteUi>
      <template #actions>
        <BoutonUi variante="secondaire" @click="modaleNomination = false">Annuler</BoutonUi>
        <BoutonUi variante="principal" :chargement="envoiNomination" @click="confirmerNomination">Nommer</BoutonUi>
      </template>
    </ModaleUi>

    <ModaleUi v-model="modaleRelance" :titre="cibleRelance ? `Relancer ${cibleRelance.prenom}` : 'Relancer tous les admins'">
      <template v-if="!resultat">
        <p>Une relance est toujours visible dans l'application (notification et bandeau). Tu peux en plus écrire à la personne depuis ta messagerie.</p>
        <fieldset class="canaux">
          <legend>Comment la prévenir ?</legend>
          <label><input v-model="canal" type="radio" value="notification" /> Dans l'application seulement</label>
          <label><input v-model="canal" type="radio" value="email" /> Par e-mail</label>
          <label><input v-model="canal" type="radio" value="whatsapp" /> Par WhatsApp</label>
        </fieldset>
        <ChampUi v-model="motifRelance" libelle="Mot pour l'application (facultatif, sans donnée personnelle)" />
        <p class="secondaire">Une relance par administrateur et par heure au plus.</p>
        <AlerteUi v-if="erreurRelance" type="erreur">{{ erreurRelance }}</AlerteUi>
      </template>
      <template v-else>
        <AlerteUi type="succes">{{ resultat.length }} administrateur{{ resultat.length > 1 ? 's' : '' }} relancé{{ resultat.length > 1 ? 's' : '' }} dans l'application.</AlerteUi>
        <p v-if="canal === 'email'">
          <a v-if="liensEmail" :href="liensEmail">Ouvrir ma messagerie avec le message prérempli</a>
          <span v-else>Aucune adresse disponible.</span>
        </p>
        <ul v-if="canal === 'whatsapp'" class="liens-whatsapp">
          <li v-for="r in resultat" :key="r.cibleId">
            <a v-if="lienWhatsAppPour(r)" :href="lienWhatsAppPour(r)!" target="_blank" rel="noopener">Ouvrir WhatsApp pour {{ r.prenom }}</a>
            <span v-else>{{ r.prenom }} : numéro WhatsApp inutilisable.</span>
          </li>
        </ul>
        <p class="secondaire">Le message ne contient que le nombre d'éléments en attente, leur ancienneté et un lien.</p>
      </template>
      <template #actions>
        <BoutonUi variante="secondaire" @click="modaleRelance = false">{{ resultat ? 'Fermer' : 'Annuler' }}</BoutonUi>
        <BoutonUi v-if="!resultat" variante="action" :chargement="envoiRelance" @click="confirmerRelance">Relancer</BoutonUi>
      </template>
    </ModaleUi>
  </section>
</template>

<style scoped>
.administrateurs {
  display: flex;
  flex-direction: column;
  gap: var(--e5);
}
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.titre-bloc {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
h2,
p {
  margin: 0;
}
h2 {
  font-family: var(--police-titre);
  font-size: var(--texte-l);
}
.defilement {
  overflow-x: auto;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: var(--e3);
  border-bottom: 1px solid var(--bordure);
  text-align: left;
  vertical-align: top;
}
th {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
tr:last-child td {
  border-bottom: 0;
}
.secondaire {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.actions-ligne {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
.recherche {
  display: flex;
  gap: var(--e3);
  align-items: flex-end;
}
.recherche > :first-child {
  flex: 1;
}
.candidats,
.liens-whatsapp {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.candidats li {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.canaux {
  display: flex;
  flex-direction: column;
  margin: var(--e3) 0;
  padding: 0;
  border: 0;
}
.canaux label {
  display: flex;
  gap: var(--e3);
  align-items: center;
  min-height: var(--cible-min);
}
.canaux input {
  width: 20px;
  height: 20px;
  accent-color: var(--indigo);
}
</style>
