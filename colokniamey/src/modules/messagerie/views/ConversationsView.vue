<script setup lang="ts">
// Liste de mes conversations, avec les messages non lus. Seuls le prénom et l'initiale de l'autre personne sont montrés.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import { listerConversations, type ConversationResume } from '../services/messagerieService'

const conversations = ref<ConversationResume[]>([])
const chargement = ref(true)
const erreur = ref('')

onMounted(async () => {
  try {
    conversations.value = await listerConversations()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger tes messages.'
  } finally {
    chargement.value = false
  }
})

function date(valeur: string): string {
  const d = new Date(valeur)
  const aujourdhui = new Date()
  return d.toDateString() === aujourdhui.toDateString()
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <section class="conversations">
    <h1>Messages</h1>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
    <ChargementUi v-if="chargement" :lignes="3" />
    <EtatVide v-else-if="conversations.length === 0 && !erreur" message="Tu n'as pas encore de conversation.">
      <p class="aide">Ouvre une annonce et touche « Envoyer un message » pour contacter son auteur.</p>
      <RouterLink to="/recherche">Chercher un logement</RouterLink>
    </EtatVide>
    <ul v-else class="liste">
      <li v-for="c in conversations" :key="c.id">
        <RouterLink class="ligne" :to="`/messages/${c.id}`">
          <span class="haut">
            <strong>{{ c.autrePrenom }} {{ c.autreInitiale }}<template v-if="c.autreInitiale">.</template></strong>
            <span class="date">{{ date(c.dernierMessageLe) }}</span>
          </span>
          <span class="annonce">{{ c.annonceTitre ?? 'Annonce retirée' }}</span>
          <span v-if="c.nonLus > 0" class="non-lus" :aria-label="`${c.nonLus} message(s) non lu(s)`">{{ c.nonLus }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.conversations {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--e4);
}
h1,
p {
  margin: 0;
}
.aide,
.date,
.annonce {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ligne {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--e1);
  min-height: var(--cible-min);
  padding: var(--e3) var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
  color: var(--encre);
  text-decoration: none;
}
.haut {
  display: flex;
  gap: var(--e3);
  justify-content: space-between;
}
.non-lus {
  position: absolute;
  right: var(--e4);
  bottom: var(--e3);
  min-width: 24px;
  padding: 0 var(--e2);
  border-radius: var(--rayon-rond);
  background: var(--orange);
  color: #ffffff;
  font-size: var(--texte-s);
  font-weight: 700;
  text-align: center;
}
</style>
