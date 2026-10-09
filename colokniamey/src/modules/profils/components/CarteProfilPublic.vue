<script setup lang="ts">
// Carte du profil public minimal d'un utilisateur (annonceur d'une annonce, correspondant d'une conversation).
// Affiche seulement : prénom, initiale du nom, rôle, université ou type de propriétaire, ancienneté,
// photo validée, profession et centres d'intérêt. Jamais de téléphone ni d'e-mail.
import { onMounted, ref, watch } from 'vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { lireProfilPublic } from '../services/profilsService'
import type { ProfilPublic } from '../types'
import AvatarProfil from './AvatarProfil.vue'

const props = defineProps<{ userId: string }>()

const profil = ref<ProfilPublic | null>(null)
const chargement = ref(true)
const echec = ref(false)

async function charger() {
  chargement.value = true
  echec.value = false
  try {
    profil.value = await lireProfilPublic(props.userId)
  } catch {
    echec.value = true
  } finally {
    chargement.value = false
  }
}

onMounted(charger)
watch(() => props.userId, charger)

function depuis(date: string): string {
  return new Date(date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}
</script>

<template>
  <ChargementUi v-if="chargement" :lignes="2" />
  <p v-else-if="echec" class="vide" role="alert">Ce profil n'a pas pu être chargé.</p>
  <p v-else-if="!profil" class="vide">Ce profil n'est plus disponible.</p>
  <article v-else class="carte">
    <AvatarProfil :prenom="profil.prenom" :chemin="profil.avatarChemin" :taille="56" />
    <div class="infos">
      <h3>{{ profil.prenom }} {{ profil.initialeNom }}.</h3>
      <!-- Emplacement du badge « Identité vérifiée » (module K) : l'appelant y place BadgeIdentite, sans dépendance circulaire -->
      <slot name="badge" :user-id="profil.id" />
      <p class="role">
        <template v-if="profil.role === 'etudiant'">Étudiant<template v-if="profil.universite"> · {{ profil.universite }}</template></template>
        <template v-else>{{ profil.typeProprietaire === 'agence' ? 'Agence' : 'Propriétaire' }}</template>
      </p>
      <p v-if="profil.profession" class="profession">{{ profil.profession }}</p>
      <ul v-if="profil.centresInteret.length > 0" class="centres" aria-label="Centres d'intérêt">
        <li v-for="c in profil.centresInteret" :key="c"><PuceUi>{{ c }}</PuceUi></li>
      </ul>
      <p class="depuis">Membre depuis {{ depuis(profil.membreDepuis) }}</p>
    </div>
  </article>
</template>

<style scoped>
.carte {
  display: flex;
  gap: var(--e4);
  align-items: flex-start;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.infos {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  min-width: 0;
}
h3 {
  margin: 0;
  font-family: var(--police-titre);
}
p {
  margin: 0;
}
.role,
.depuis {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.centres {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e1);
  margin: var(--e1) 0;
  padding: 0;
  list-style: none;
}
.vide {
  color: var(--texte-secondaire);
}
</style>
