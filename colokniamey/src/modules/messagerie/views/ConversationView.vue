<script setup lang="ts">
// Fil d'une conversation en temps réel (RG19, RGP23) : les messages arrivent sans recharger, l'envoi est immédiat,
// les messages reçus sont marqués comme lus. Les messages sont confidentiels : seuls les deux participants les voient.
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import { extensions } from '@/core/extensions'
import { useAuthStore } from '@/modules/auth'
import {
  envoyerMessage,
  LONGUEUR_MAX,
  lireMessages,
  listerConversations,
  marquerLu,
  suivreConversation,
  type ConversationResume,
  type Message,
} from '../services/messagerieService'

const route = useRoute()
const auth = useAuthStore()
const id = Number(route.params.id)

const messages = ref<Message[]>([])
const entete = ref<ConversationResume | null>(null)
const texte = ref('')
const chargement = ref(true)
const envoi = ref(false)
const erreur = ref('')
const fil = useTemplateRef<HTMLElement>('fil')
let arreter: (() => void) | null = null

const moi = () => auth.profil?.id ?? ''

async function defiler() {
  await nextTick()
  if (fil.value) fil.value.scrollTop = fil.value.scrollHeight
}

function ajouter(m: Message) {
  if (messages.value.some((x) => x.id === m.id)) return
  messages.value = [...messages.value, m]
  void defiler()
  // Un message reçu pendant que la conversation est ouverte est lu tout de suite
  if (m.expediteurId !== moi()) void marquerLu(id)
}

onMounted(async () => {
  try {
    const [liste, conversations] = await Promise.all([lireMessages(id), listerConversations()])
    messages.value = liste
    entete.value = conversations.find((c) => c.id === id) ?? null
    if (!entete.value && liste.length === 0) erreur.value = 'Cette conversation est introuvable.'
    arreter = suivreConversation(id, ajouter)
    await marquerLu(id)
    await defiler()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la conversation.'
  } finally {
    chargement.value = false
  }
})
onBeforeUnmount(() => arreter?.())

async function envoyer() {
  const contenu = texte.value
  if (contenu.trim() === '' || envoi.value) return
  erreur.value = ''
  envoi.value = true
  try {
    ajouter(await envoyerMessage(id, contenu))
    texte.value = ''
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Le message n\'a pas pu être envoyé.'
  } finally {
    envoi.value = false
  }
}

function heure(valeur: string): string {
  return new Date(valeur).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <section class="conversation">
    <header>
      <RouterLink to="/messages" class="retour">Messages</RouterLink>
      <h1 v-if="entete">{{ entete.autrePrenom }} {{ entete.autreInitiale }}<template v-if="entete.autreInitiale">.</template></h1>
      <p v-if="entete" class="annonce">
        <RouterLink v-if="entete.annonceId && entete.annonceTitre" :to="`/annonces/${entete.annonceId}`">{{ entete.annonceTitre }}</RouterLink>
        <template v-else>Annonce retirée</template>
      </p>
    </header>

    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="4" />

    <ol v-else ref="fil" class="fil" aria-live="polite" aria-label="Messages">
      <li v-for="m in messages" :key="m.id" class="message" :class="{ moi: m.expediteurId === moi() }">
        <p class="texte">{{ m.contenu }}</p>
        <span class="heure">{{ heure(m.creeLe) }}<template v-if="m.expediteurId === moi() && m.luLe"> · lu</template></span>
        <!-- Point d'extension : un module optionnel (signalements, M7) ajoute ses actions sur les messages reçus -->
        <template v-if="m.expediteurId !== moi()">
          <component :is="ext" v-for="(ext, i) in extensions('message-actions')" :key="i" :message-id="m.id" />
        </template>
      </li>
    </ol>

    <form class="envoi" @submit.prevent="envoyer">
      <label for="message" class="cache">Ton message</label>
      <textarea id="message" v-model="texte" rows="2" :maxlength="LONGUEUR_MAX" placeholder="Écris ton message…" @keydown.enter.exact.prevent="envoyer" />
      <BoutonUi type="submit" variante="principal" :chargement="envoi" :desactive="texte.trim() === ''">Envoyer</BoutonUi>
    </form>
    <p class="aide">Ne donne jamais d'argent avant d'avoir visité le logement.</p>
  </section>
</template>

<style scoped>
.conversation {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
p {
  margin: 0;
}
header {
  display: flex;
  flex-direction: column;
  gap: var(--e1);
}
.retour {
  color: var(--indigo);
  font-weight: 700;
}
.annonce,
.aide,
.heure {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.fil {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  max-height: 55vh;
  min-height: 12rem;
  margin: 0;
  padding: var(--e3);
  overflow-y: auto;
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  list-style: none;
}
.message {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-self: flex-start;
  max-width: 85%;
  padding: var(--e2) var(--e3);
  border-radius: var(--rayon);
  background: var(--fond);
}
.message.moi {
  align-self: flex-end;
  background: var(--indigo-pale);
}
.texte {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.envoi {
  display: flex;
  gap: var(--e2);
  align-items: flex-end;
}
textarea {
  flex: 1;
  min-width: 0;
  padding: var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
  resize: none;
}
.cache {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
