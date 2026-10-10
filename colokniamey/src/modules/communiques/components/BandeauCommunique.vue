<script setup lang="ts">
// Bandeau des communiqués (A4, RGA13, RGA14), placé dans la zone de communiqué du layout par le point d'extension
// « zone-communique ». Les communiqués viennent de la base, adaptés au rôle ; un communiqué critique n'a pas de bouton
// « Masquer ». Un visiteur qui masque un communiqué le fait pour lui seul, dans son navigateur (confort, jamais obligatoire).
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { roleCourant } from '@/core/acces'
import { icones } from '@/core/design/icones'
import { lireCommuniquesActifs, masquerCommunique, type Communique } from '../services/communiquesService'

const CLE = 'colokniamey-communiques-masques'
const communiques = ref<Communique[]>([])
let minuteur: ReturnType<typeof setInterval> | null = null

function masquesLocaux(): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLE) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

async function charger() {
  const locaux = roleCourant.value === null ? masquesLocaux() : []
  communiques.value = (await lireCommuniquesActifs()).filter((c) => !locaux.includes(c.id) || !c.masquable)
}

async function masquer(c: Communique) {
  communiques.value = communiques.value.filter((x) => x.id !== c.id)
  if (roleCourant.value === null) {
    try {
      localStorage.setItem(CLE, JSON.stringify([...masquesLocaux(), c.id].slice(-50)))
    } catch {
      // stockage indisponible : le communiqué reviendra au prochain chargement
    }
    return
  }
  try {
    await masquerCommunique(c.id)
  } catch {
    // la base refusera de toute façon un communiqué critique ; on ne montre pas d'erreur pour un simple bandeau
  }
}

// Le rôle change à la connexion ou à la déconnexion : la cible change avec lui
watch(roleCourant, () => void charger())
onMounted(() => {
  void charger()
  minuteur = setInterval(() => void charger(), 5 * 60 * 1000)
})
onBeforeUnmount(() => {
  if (minuteur) clearInterval(minuteur)
})
</script>

<template>
  <div v-if="communiques.length > 0" class="communiques">
    <article v-for="c in communiques" :key="c.id" class="communique" :class="c.niveau" :role="c.niveau === 'information' ? 'status' : 'alert'">
      <component :is="c.niveau === 'information' ? icones.info : icones.attention" class="icone" :size="20" :stroke-width="2" aria-hidden="true" />
      <div class="texte">
        <strong>{{ c.titre }}</strong>
        <span>{{ c.message }}</span>
      </div>
      <button v-if="c.masquable" type="button" class="masquer" aria-label="Masquer ce communiqué" @click="masquer(c)">
        <component :is="icones.fermer" :size="18" :stroke-width="2" aria-hidden="true" />
      </button>
    </article>
  </div>
</template>

<style scoped>
.communiques {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  padding: var(--e2) var(--e4);
}
.communique {
  display: flex;
  gap: var(--e3);
  align-items: flex-start;
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.texte {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.information .icone {
  color: var(--indigo);
}
.avertissement {
  border-color: var(--orange);
}
.avertissement .icone {
  color: var(--orange);
}
.critique {
  border-color: var(--erreur);
}
.critique .icone,
.critique strong {
  color: var(--erreur);
}
.masquer {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--cible-min);
  height: var(--cible-min);
  margin: calc(-1 * var(--e2)) calc(-1 * var(--e2)) 0 0;
  border: 0;
  background: none;
  color: var(--texte-secondaire);
  cursor: pointer;
}
</style>
