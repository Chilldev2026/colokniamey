<script setup lang="ts">
// Mode maintenance (RGA15, RGA16). Le super-admin l'active ou le désactive ; l'admin en voit l'état en lecture seule.
// Les utilisateurs connectés basculent en temps réel (canal « plateforme ») sans recharger.
import { computed, onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { roleCourant } from '@/core/acces'
import { chargerParametres, parametres } from '@/core/parametres'
import { definirMaintenance } from '../services/plateformeService'

const { afficher } = useToasts()
const estSuper = computed(() => roleCourant.value === 'super_admin')

const message = ref('')
const fin = ref('') // valeur d'un champ datetime-local
const chargement = ref(true)
const erreur = ref('')
const envoi = ref(false)
const apercu = ref(false)
const confirmation = ref(false)

onMounted(async () => {
  await chargerParametres()
  message.value = parametres.value.maintenance_message
  fin.value = parametres.value.maintenance_fin ? versChampLocal(parametres.value.maintenance_fin) : ''
  chargement.value = false
})

function versChampLocal(iso: string): string {
  const d = new Date(iso)
  const decalage = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - decalage).toISOString().slice(0, 16)
}

function dateLisible(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' }) : ''
}

const finIso = computed(() => (fin.value ? new Date(fin.value).toISOString() : null))

function demanderActivation() {
  erreur.value = ''
  if (message.value.trim().length > 300) {
    erreur.value = 'Le message est limité à 300 caractères.'
    return
  }
  if (finIso.value && new Date(finIso.value) <= new Date()) {
    erreur.value = 'L\'heure de fin prévue doit être dans le futur.'
    return
  }
  confirmation.value = true
}

async function appliquer(active: boolean) {
  envoi.value = true
  erreur.value = ''
  try {
    await definirMaintenance(active, message.value.trim(), active ? finIso.value : null)
    confirmation.value = false
    await chargerParametres()
    afficher(active ? 'Maintenance activée : seuls les admins ont accès.' : 'Maintenance désactivée.', 'succes')
  } catch (e) {
    confirmation.value = false
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <section class="maintenance">
    <ChargementUi v-if="chargement" />
    <template v-else>
      <div class="etat">
        <h2>État actuel</h2>
        <PuceUi :variante="parametres.maintenance_active ? 'neutre' : 'validee'">
          {{ parametres.maintenance_active ? 'Maintenance active' : 'Plateforme ouverte' }}
        </PuceUi>
      </div>
      <p v-if="parametres.maintenance_active && parametres.maintenance_fin" class="secondaire">
        Fin prévue : {{ dateLisible(parametres.maintenance_fin) }}
      </p>

      <AlerteUi v-if="!estSuper" type="info">
        Seul le super-admin peut activer ou désactiver la maintenance. Tu vois ici son état, en lecture seule.
      </AlerteUi>

      <template v-if="estSuper">
        <p>
          En maintenance, seuls les admins accèdent à l'application et la base refuse toute écriture des autres
          utilisateurs. Les personnes connectées sont redirigées tout de suite vers la page de maintenance.
        </p>
        <form class="formulaire" novalidate @submit.prevent="demanderActivation">
          <div class="champ">
            <label for="message-maintenance">Message affiché aux utilisateurs</label>
            <textarea id="message-maintenance" v-model="message" rows="3" maxlength="300" placeholder="ColokNiamey revient très bientôt." />
          </div>
          <div class="champ">
            <label for="fin-maintenance">Fin prévue (facultatif)</label>
            <input id="fin-maintenance" v-model="fin" type="datetime-local" />
          </div>
          <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
          <div class="boutons">
            <BoutonUi variante="secondaire" @click="apercu = true">Aperçu de la page</BoutonUi>
            <BoutonUi v-if="!parametres.maintenance_active" type="submit" variante="danger">Activer la maintenance</BoutonUi>
            <BoutonUi v-else type="submit" variante="principal">Mettre à jour le message</BoutonUi>
            <BoutonUi v-if="parametres.maintenance_active" variante="action" :chargement="envoi" @click="appliquer(false)">
              Désactiver la maintenance
            </BoutonUi>
          </div>
        </form>
      </template>
    </template>

    <ModaleUi v-model="apercu" titre="Page vue par les utilisateurs">
      <h3>Maintenance en cours</h3>
      <EtatVide :message="message.trim() || 'ColokNiamey revient très bientôt.'">
        <p v-if="fin">Fin prévue : {{ dateLisible(finIso) }}</p>
      </EtatVide>
      <template #actions><BoutonUi variante="secondaire" @click="apercu = false">Fermer</BoutonUi></template>
    </ModaleUi>

    <ModaleUi v-model="confirmation" :titre="parametres.maintenance_active ? 'Mettre à jour la maintenance ?' : 'Activer la maintenance ?'">
      <p>
        Tous les utilisateurs seront déconnectés de leurs actions et verront la page de maintenance. Tu pourras la désactiver à tout moment.
      </p>
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <template #actions>
        <BoutonUi variante="secondaire" @click="confirmation = false">Annuler</BoutonUi>
        <BoutonUi variante="danger" :chargement="envoi" @click="appliquer(true)">Confirmer</BoutonUi>
      </template>
    </ModaleUi>
  </section>
</template>

<style scoped>
.maintenance {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
}
.etat {
  display: flex;
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
  font-size: var(--texte-l);
}
.secondaire {
  color: var(--texte-secondaire);
}
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.champ {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.champ label {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
textarea,
input[type='datetime-local'] {
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.boutons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
</style>
