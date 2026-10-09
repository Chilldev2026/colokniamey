<script setup lang="ts">
// RGP11 : ce que ColokNiamey connaît de toi, et le téléchargement de tes données en JSON.
import { ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { exporterMesDonnees } from '../services/profilsService'

const { afficher } = useToasts()
const chargement = ref(false)
const erreur = ref('')

async function telecharger() {
  erreur.value = ''
  chargement.value = true
  try {
    const json = await exporterMesDonnees()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `mes-donnees-colokniamey-${new Date().toISOString().slice(0, 10)}.json`
    lien.click()
    URL.revokeObjectURL(url)
    afficher('Tes données sont téléchargées.', 'succes')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Téléchargement impossible. Réessaie.'
  } finally {
    chargement.value = false
  }
}
</script>

<template>
  <section class="donnees">
    <h1>Mes données</h1>
    <p>Voici ce que ColokNiamey enregistre sur toi. Nous ne collectons rien d'autre.</p>

    <ul class="liste">
      <li><strong>Ton compte :</strong> adresse e-mail et mot de passe (conservé sous forme chiffrée, nous ne pouvons pas le lire).</li>
      <li><strong>Ton profil :</strong> prénom, nom, téléphone, rôle, université (étudiants) ou type de propriétaire, profession et centres d'intérêt si tu les renseignes.</li>
      <li><strong>Tes photos :</strong> les photos de profil et d'annonces que tu envoies, avec leur état de validation.</li>
      <li><strong>Tes acceptations :</strong> la version des conditions que tu as acceptée et la date.</li>
      <li><strong>La sécurité du contenu :</strong> les textes bloqués ou mis en revue (date et catégorie seulement, pas le texte).</li>
      <li><strong>Tes notifications</strong> et le <strong>journal</strong> de certaines actions sur ton compte.</li>
    </ul>
    <p>
      Les statistiques de visite sont anonymes : elles ne contiennent ni ton adresse IP ni d'identifiant qui permette de te reconnaître.
      Pour en savoir plus, lis la <RouterLink to="/confidentialite">politique de confidentialité</RouterLink>.
    </p>

    <div class="actions">
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi variante="principal" :chargement="chargement" pleine-largeur @click="telecharger">
        Télécharger mes données (JSON)
      </BoutonUi>
      <RouterLink to="/profil">Corriger mes informations</RouterLink>
      <RouterLink to="/profil/securite">Désactiver mon compte</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.donnees {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 32rem;
  margin: 0 auto;
}
h1 {
  margin: 0;
  font-family: var(--police-titre);
}
p {
  margin: 0;
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding-left: var(--e5);
}
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
}
.actions a {
  display: inline-flex;
  align-items: center;
  min-height: var(--cible-min);
}
</style>
