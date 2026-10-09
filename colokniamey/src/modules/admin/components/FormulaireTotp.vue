<script setup lang="ts">
// Saisie du code à 6 chiffres de l'application d'authentification (TOTP).
//  - sans `facteurId` : inscription d'un nouvel appareil (QR code à scanner, puis code de confirmation) ;
//  - avec `facteurId` : défi à la connexion (RGA04), le code est redemandé à chaque nouvelle connexion.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import { demarrerInscriptionTotp, verifierCode } from '../services/adminService'
import type { InscriptionTotp } from '../types'

const props = defineProps<{ facteurId?: string; libelleBouton?: string }>()
const emit = defineEmits<{ verifie: [] }>()

const inscription = ref<InscriptionTotp | null>(null)
const code = ref('')
const erreur = ref('')
const chargement = ref(false)
const preparation = ref(!props.facteurId)

onMounted(async () => {
  if (props.facteurId) return
  try {
    inscription.value = await demarrerInscriptionTotp()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    preparation.value = false
  }
})

async function envoyer() {
  erreur.value = ''
  const facteur = props.facteurId ?? inscription.value?.facteurId
  if (!facteur) return
  if (!/^\d{6}$/.test(code.value.replace(/\s/g, ''))) {
    erreur.value = 'Entre le code à 6 chiffres affiché par ton application.'
    return
  }
  chargement.value = true
  try {
    await verifierCode(facteur, code.value)
    emit('verifie')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
    code.value = ''
  } finally {
    chargement.value = false
  }
}
</script>

<template>
  <form class="totp" novalidate @submit.prevent="envoyer">
    <ChargementUi v-if="preparation" :lignes="3" />
    <template v-else>
      <div v-if="inscription" class="qr">
        <ol>
          <li>Ouvre une application d'authentification (Google Authenticator, Aegis, Microsoft Authenticator…).</li>
          <li>Scanne ce QR code.</li>
          <li>Entre le code à 6 chiffres qu'elle affiche.</li>
        </ol>
        <img :src="inscription.qr" alt="QR code à scanner avec l'application d'authentification" width="192" height="192" />
        <details>
          <summary>Je ne peux pas scanner</summary>
          <p>Saisis cette clé dans l'application : <code>{{ inscription.secret }}</code></p>
        </details>
      </div>
      <ChampUi v-if="inscription || facteurId" v-model="code" libelle="Code à 6 chiffres" autocomplete="one-time-code" requis />
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi v-if="inscription || facteurId" type="submit" variante="principal" :chargement="chargement" pleine-largeur>
        {{ libelleBouton ?? 'Vérifier' }}
      </BoutonUi>
    </template>
  </form>
</template>

<style scoped>
.totp,
.qr {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.qr img {
  align-self: center;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: #ffffff;
}
ol {
  margin: 0;
  padding-left: var(--e5);
}
code {
  word-break: break-all;
}
</style>
