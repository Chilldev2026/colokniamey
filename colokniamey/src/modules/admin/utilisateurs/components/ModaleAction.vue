<script setup lang="ts">
// Fenêtre de confirmation d'une action sur un compte : motif (obligatoire ou non), durée facultative,
// mot à recopier pour les actions irréversibles. Rien n'est envoyé tant que la personne n'a pas confirmé.
import { computed, ref, watch } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'

const ouverte = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    titre: string
    description?: string
    libelleConfirmer: string
    danger?: boolean
    avecMotif?: boolean
    avecDuree?: boolean
    /** Mot à recopier pour confirmer (suppression définitive). */
    motCle?: string
    chargement?: boolean
    erreur?: string
  }>(),
  { description: '', danger: false, avecMotif: false, avecDuree: false, motCle: '', chargement: false, erreur: '' },
)

const emit = defineEmits<{ confirmer: [donnees: { motif: string; jusqua: string }] }>()

const motif = ref('')
const jusqua = ref('')
const confirmation = ref('')
const erreurLocale = ref('')

// Chaque ouverture repart d'un formulaire vide
watch(ouverte, (valeur) => {
  if (valeur) {
    motif.value = ''
    jusqua.value = ''
    confirmation.value = ''
    erreurLocale.value = ''
  }
})

const peutConfirmer = computed(() => props.motCle === '' || confirmation.value.trim() === props.motCle)

function confirmer() {
  erreurLocale.value = ''
  if (props.avecMotif && motif.value.trim().length < 3) {
    erreurLocale.value = 'Un motif est obligatoire (3 caractères au moins).'
    return
  }
  if (props.avecMotif && motif.value.trim().length > 300) {
    erreurLocale.value = 'Le motif est limité à 300 caractères.'
    return
  }
  if (props.avecDuree && jusqua.value !== '' && new Date(jusqua.value) <= new Date()) {
    erreurLocale.value = 'La date de fin doit être dans le futur.'
    return
  }
  emit('confirmer', {
    motif: motif.value.trim(),
    // fin de journée locale : la suspension court jusqu'au soir de la date choisie
    jusqua: jusqua.value ? new Date(`${jusqua.value}T23:59:59`).toISOString() : '',
  })
}
</script>

<template>
  <ModaleUi v-model="ouverte" :titre="titre">
    <p v-if="description" class="description">{{ description }}</p>
    <div class="champs">
      <div v-if="avecMotif" class="motif">
        <label for="motif-action">Motif (obligatoire)</label>
        <textarea id="motif-action" v-model="motif" rows="3" maxlength="300" />
      </div>
      <ChampUi v-if="avecDuree" v-model="jusqua" libelle="Jusqu'au (facultatif)" type="date" aide="Sans date, la suspension dure jusqu'à une réactivation." />
      <ChampUi v-if="motCle" v-model="confirmation" :libelle="`Recopie « ${motCle} » pour confirmer`" />
    </div>
    <AlerteUi v-if="erreurLocale || erreur" type="erreur">{{ erreurLocale || erreur }}</AlerteUi>
    <template #actions>
      <BoutonUi variante="secondaire" @click="ouverte = false">Annuler</BoutonUi>
      <BoutonUi :variante="danger ? 'danger' : 'principal'" :chargement="chargement" :desactive="!peutConfirmer" @click="confirmer">
        {{ libelleConfirmer }}
      </BoutonUi>
    </template>
  </ModaleUi>
</template>

<style scoped>
.description {
  margin: 0 0 var(--e3);
}
.champs {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin-bottom: var(--e3);
}
.motif {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.motif label {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
textarea {
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  resize: vertical;
}
</style>
