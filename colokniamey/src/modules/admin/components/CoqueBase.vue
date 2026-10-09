<script setup lang="ts">
// Structure commune des deux coques de l'espace admin (RGA26) : barre latérale (tiroir sur téléphone),
// barre du haut avec les notifications, bandeaux, contenu. Les couleurs et le badge viennent de la coque.
// Aucune ombre portée, aucun effet au survol qui révèle une action (module D).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { icones } from '@/core/design/icones'
import ConteneurToasts from '@/core/ui/ConteneurToasts.vue'
import { direction } from '@/core/design/direction'
import { parametres } from '@/core/parametres'
import { useAuthStore } from '@/modules/auth'
import { useAdminStore } from '../stores/adminStore'
import { useSessionAdmin } from '../composables/useSessionAdmin'
import type { EntreeMenuCalculee } from '../types'
import AvertissementInactivite from './AvertissementInactivite.vue'
import BandeauMfa from './BandeauMfa.vue'
import BandeauRelance from './BandeauRelance.vue'
import PanneauNotifications from './PanneauNotifications.vue'

const props = defineProps<{
  variante: 'super' | 'admin'
  badge: string
  entrees: EntreeMenuCalculee[]
  /** Texte d'identité sous le nom, par exemple « Super-admin · double authentification active ». */
  statut: string
}>()

const auth = useAuthStore()
const admin = useAdminStore()
const route = useRoute()
const router = useRouter()
const { secondesRestantes, resterConnecte } = useSessionAdmin()

const ouvert = ref(false)
const REGROUPEMENTS = [
  { section: 'pilotage', titre: 'Pilotage' },
  { section: 'operations', titre: 'Opérations' },
] as const

// Le menu super-admin a deux sections ; le menu admin est une liste simple (« Ma file de travail »)
const groupes = computed(() =>
  props.variante === 'super'
    ? REGROUPEMENTS.map((g) => ({ titre: g.titre, entrees: props.entrees.filter((e) => e.section === g.section) })).filter((g) => g.entrees.length > 0)
    : [{ titre: '', entrees: props.entrees }],
)

function compteur(entree: EntreeMenuCalculee): number | null {
  if (!entree.fileAdmin) return null
  return admin.files.find((f) => f.nom === entree.fileAdmin)?.nombre ?? 0
}

let minuteur = 0
onMounted(async () => {
  await admin.rafraichirNiveau()
  void admin.chargerFacteurs().catch(() => undefined)
  void admin.chargerFiles()
  if (auth.role === 'admin') void admin.chargerRelances()
  // Les compteurs et le bandeau de relance se mettent à jour toutes les minutes
  minuteur = window.setInterval(() => {
    void admin.chargerFiles()
    if (auth.role === 'admin') void admin.chargerRelances()
  }, 60_000)
})
onBeforeUnmount(() => window.clearInterval(minuteur))

watch(() => route.path, () => (ouvert.value = false))

async function seDeconnecter() {
  await auth.deconnecter()
  admin.vider()
  await router.replace('/')
}
</script>

<template>
  <div class="coque" :class="variante">
    <div v-if="ouvert" class="voile" @click="ouvert = false" />

    <aside class="lateral" :class="{ ouvert }" aria-label="Menu de l'espace admin">
      <div class="marque">
        <span class="nom"><span class="colok">Colok</span><span class="niamey">Niamey</span></span>
        <span class="badge">{{ badge }}</span>
      </div>

      <nav class="menu">
        <section v-for="g in groupes" :key="g.titre" class="groupe">
          <h2 v-if="g.titre">{{ g.titre }}</h2>
          <RouterLink v-for="e in g.entrees" :key="e.vers" :to="e.vers" class="lien">
            <component :is="icones[e.icone] ?? icones.info" :size="20" :stroke-width="2" aria-hidden="true" />
            <span class="libelle">{{ e.libelle }}</span>
            <span v-if="compteur(e) !== null && compteur(e)! > 0" class="compteur" :aria-label="`${compteur(e)} en attente`">{{ compteur(e) }}</span>
          </RouterLink>
        </section>
      </nav>

      <slot name="pied-menu" />

      <div class="utilisateur">
        <RouterLink to="/admin/securite" class="lien">
          <component :is="icones.securite" :size="20" :stroke-width="2" aria-hidden="true" />
          <span class="libelle">Sécurité du compte</span>
        </RouterLink>
        <p class="identite">
          <strong>{{ auth.profil?.prenom }} {{ auth.profil?.nom.charAt(0) }}.</strong><br />
          <span>{{ statut }}</span>
        </p>
        <RouterLink to="/" class="lien">
          <component :is="icones.accueil" :size="20" :stroke-width="2" aria-hidden="true" />
          <span class="libelle">Quitter l'espace admin</span>
        </RouterLink>
        <button type="button" class="lien bouton" @click="seDeconnecter">
          <component :is="icones.deconnexion" :size="20" :stroke-width="2" aria-hidden="true" />
          <span class="libelle">Me déconnecter</span>
        </button>
      </div>
    </aside>

    <div class="principal">
      <!-- RGA15 : bandeau rouge permanent tant que la maintenance est active -->
      <div v-if="parametres.maintenance_active" class="maintenance" role="alert">
        Maintenance en cours : les utilisateurs ne peuvent plus écrire. Seuls les admins ont accès à l'application.
        <RouterLink v-if="auth.role === 'super_admin'" to="/admin/maintenance">Gérer</RouterLink>
      </div>
      <header class="barre-haute">
        <button type="button" class="burger" aria-label="Ouvrir le menu" :aria-expanded="ouvert" @click="ouvert = !ouvert">
          <component :is="icones.menu" :size="24" :stroke-width="2" aria-hidden="true" />
        </button>
        <h1 class="titre-page">{{ route.meta.titre }}</h1>
        <PanneauNotifications />
      </header>

      <main class="contenu">
        <BandeauRelance />
        <BandeauMfa />
        <RouterView v-slot="{ Component }">
          <Transition :name="`page-${direction}`" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <AvertissementInactivite :secondes="secondesRestantes" @rester="resterConnecte" @quitter="seDeconnecter" />
    <ConteneurToasts />
  </div>
</template>

<style scoped>
.coque {
  --lateral-fond: var(--encre);
  --lateral-texte: #ffffff;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 100dvh;
  background: var(--fond);
}
.coque.admin {
  --lateral-fond: var(--indigo);
}
.lateral {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  width: min(18rem, 85vw);
  padding: var(--e4);
  overflow-y: auto;
  background: var(--lateral-fond);
  color: var(--lateral-texte);
  transform: translateX(-100%);
  transition: transform var(--duree-normale) var(--courbe);
}
.lateral.ouvert {
  transform: translateX(0);
}
.voile {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(20 22 27 / 0.5);
}
.marque {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.nom {
  font-family: var(--police-titre);
  font-size: 1.375rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.colok {
  color: #ffffff;
}
.niamey {
  color: var(--orange-decor);
}
.badge {
  padding: var(--e1) var(--e2);
  border-radius: var(--rayon-s);
  background: var(--orange);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.coque.admin .badge {
  background: rgb(255 255 255 / 0.16);
}
.menu {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--e4);
}
.groupe {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.groupe h2 {
  margin: 0 0 var(--e1);
  color: rgb(255 255 255 / 0.65);
  font-family: var(--police-texte);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lien {
  display: flex;
  gap: var(--e3);
  align-items: center;
  width: 100%;
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 0;
  border-radius: var(--rayon-s);
  background: transparent;
  color: var(--lateral-texte);
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.lien.router-link-active {
  background: rgb(255 255 255 / 0.14);
  font-weight: 700;
}
@media (hover: hover) {
  .lien:hover {
    background: rgb(255 255 255 / 0.08);
  }
}
.libelle {
  flex: 1;
}
.compteur {
  min-width: 24px;
  padding: 2px var(--e2);
  border-radius: var(--rayon-rond);
  background: var(--orange);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
}
.utilisateur {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  padding-top: var(--e3);
  border-top: 1px solid rgb(255 255 255 / 0.18);
}
.identite {
  margin: 0;
  padding: var(--e2) var(--e3);
  font-size: var(--texte-s);
}
.identite span {
  color: rgb(255 255 255 / 0.7);
}
.principal {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.maintenance {
  padding: var(--e2) var(--e4);
  background: var(--erreur);
  color: #ffffff;
  font-weight: 700;
}
.maintenance a {
  color: #ffffff;
}
.barre-haute {
  display: flex;
  gap: var(--e3);
  align-items: center;
  padding: var(--e2) var(--e4);
  border-bottom: 1px solid var(--bordure);
  background: var(--surface);
}
.burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--cible-min);
  height: var(--cible-min);
  border: 0;
  background: transparent;
  color: var(--encre);
  cursor: pointer;
}
.titre-page {
  flex: 1;
  margin: 0;
  font-family: var(--police-titre);
  font-size: 1.125rem;
}
.contenu {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--e4);
  width: 100%;
  max-width: 72rem;
  padding: var(--e5) var(--e4);
  overflow-x: hidden;
}

@media (min-width: 960px) {
  .coque {
    grid-template-columns: 16.5rem minmax(0, 1fr);
  }
  .lateral {
    position: sticky;
    top: 0;
    z-index: auto;
    width: auto;
    height: 100dvh;
    transform: none;
  }
  .burger,
  .voile {
    display: none;
  }
  .contenu {
    padding: var(--e6);
  }
}

/* Transitions de page : seulement opacity et transform, dans le sens de la navigation */
.page-avant-enter-active,
.page-avant-leave-active,
.page-arriere-enter-active,
.page-arriere-leave-active {
  transition:
    opacity var(--duree-normale) var(--courbe),
    transform var(--duree-normale) var(--courbe);
}
.page-avant-enter-from,
.page-arriere-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.page-avant-leave-to,
.page-arriere-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
