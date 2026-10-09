<script setup lang="ts">
// Sélecteur d'université réutilisable (inscription, recherche, annonces).
// La valeur est l'identifiant de l'université sous forme de texte, vide tant que rien n'est choisi.
import { computed, onMounted, ref, watch } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { listerUniversites } from '../services/referentielService'
import type { Universite } from '../types'

const modele = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{ villeId?: number; libelle?: string; erreur?: string }>(),
  { libelle: 'Université' },
)

const universites = ref<Universite[]>([])
const chargement = ref(true)
const echec = ref('')

const options = computed(() =>
  universites.value.map((u) => ({
    valeur: String(u.id),
    libelle: u.sigle ? `${u.nom} (${u.sigle})` : u.nom,
  })),
)

async function charger() {
  chargement.value = true
  echec.value = ''
  try {
    universites.value = await listerUniversites(props.villeId)
    // Si la ville change, l'ancien choix n'est peut-être plus proposé
    if (modele.value && !options.value.some((o) => o.valeur === modele.value)) modele.value = ''
  } catch (e) {
    echec.value = e instanceof Error ? e.message : 'Impossible de charger les universités.'
  } finally {
    chargement.value = false
  }
}

onMounted(charger)
watch(() => props.villeId, charger)
</script>

<template>
  <ChargementUi v-if="chargement" :lignes="2" />
  <AlerteUi v-else-if="echec" type="erreur">{{ echec }}</AlerteUi>
  <SelecteurUi
    v-else
    v-model="modele"
    :libelle="libelle"
    :options="options"
    :erreur="erreur"
    placeholder="Choisis ton université"
  />
</template>
