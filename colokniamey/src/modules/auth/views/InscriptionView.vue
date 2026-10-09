<script setup lang="ts">
import { reactive, ref, useTemplateRef } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import CaseACocher from '@/core/ui/CaseACocher.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import RadioCarte from '@/core/ui/RadioCarte.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import TurnstileWidget from '@/core/ui/TurnstileWidget.vue'
import { SelecteurUniversite } from '@/modules/referentiel'
import FormulaireAuth from '../components/FormulaireAuth.vue'
import { useAuthStore } from '../stores/authStore'
import { validerInscription, type DonneesInscription, type ErreursChamps } from '../validation'

const auth = useAuthStore()
const widget = useTemplateRef<InstanceType<typeof TurnstileWidget>>('widget')

const donnees = reactive<DonneesInscription>({
  role: 'etudiant',
  email: '',
  motDePasse: '',
  nom: '',
  prenom: '',
  telephone: '',
  universiteId: '',
  typeProprietaire: 'particulier',
  conditionsAcceptees: false,
})
const erreurs = ref<ErreursChamps>({})
const erreur = ref('')
const jeton = ref('')
const envoi = ref(false)
const termine = ref(false)
const captchaActif = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

// Les composants de choix manipulent du texte ; la valeur reste limitée aux rôles autorisés (RG03)
function choisirRole(valeur: string) {
  donnees.role = valeur === 'proprietaire' ? 'proprietaire' : 'etudiant'
}
function choisirType(valeur: string) {
  donnees.typeProprietaire = valeur === 'agence' ? 'agence' : 'particulier'
}

async function envoyer() {
  erreur.value = ''
  erreurs.value = validerInscription(donnees)
  if (Object.keys(erreurs.value).length > 0) return
  // RGP19 : pas d'envoi sans la vérification anti-robots (Supabase la contrôle aussi)
  if (captchaActif && !jeton.value) {
    erreur.value = 'Termine la vérification anti-robots.'
    return
  }
  envoi.value = true
  try {
    await auth.inscrire(donnees, jeton.value)
    termine.value = true
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Inscription impossible.'
    widget.value?.reinitialiser()
  } finally {
    envoi.value = false
  }
}
</script>

<template>
  <FormulaireAuth v-if="termine" titre="Vérifie tes e-mails">
    <AlerteUi type="succes">
      Nous t'avons envoyé un lien de confirmation. Clique dessus pour activer ton compte, puis connecte-toi.
    </AlerteUi>
    <template #liens><RouterLink to="/connexion">Aller à la connexion</RouterLink></template>
  </FormulaireAuth>

  <FormulaireAuth v-else titre="Inscription" intro="Crée ton compte en moins d'une minute.">
    <form class="formulaire" novalidate @submit.prevent="envoyer">
      <fieldset class="roles">
        <legend>Tu es</legend>
        <RadioCarte
          :model-value="donnees.role"
          nom="role"
          valeur="etudiant"
          libelle="Étudiant"
          description="Je cherche une colocation."
          @update:model-value="choisirRole"
        />
        <RadioCarte
          :model-value="donnees.role"
          nom="role"
          valeur="proprietaire"
          libelle="Propriétaire"
          description="Je propose un logement."
          @update:model-value="choisirRole"
        />
      </fieldset>

      <ChampUi v-model="donnees.prenom" libelle="Prénom" autocomplete="given-name" :erreur="erreurs.prenom" requis />
      <ChampUi v-model="donnees.nom" libelle="Nom" autocomplete="family-name" :erreur="erreurs.nom" requis />
      <ChampUi v-model="donnees.email" libelle="Adresse e-mail" type="email" autocomplete="email" :erreur="erreurs.email" requis />
      <ChampUi
        v-model="donnees.telephone"
        libelle="Téléphone"
        type="tel"
        autocomplete="tel"
        aide="Il ne sera jamais affiché publiquement."
        :erreur="erreurs.telephone"
        requis
      />
      <ChampUi
        v-model="donnees.motDePasse"
        libelle="Mot de passe"
        type="password"
        autocomplete="new-password"
        aide="8 caractères au moins."
        :erreur="erreurs.motDePasse"
        requis
      />

      <SelecteurUniversite v-if="donnees.role === 'etudiant'" v-model="donnees.universiteId" :erreur="erreurs.universiteId" />
      <SelecteurUi
        v-else
        :model-value="donnees.typeProprietaire"
        libelle="Type de propriétaire"
        :options="[
          { valeur: 'particulier', libelle: 'Particulier' },
          { valeur: 'agence', libelle: 'Agence' },
        ]"
        @update:model-value="choisirType"
      />

      <CaseACocher v-model="donnees.conditionsAcceptees" :erreur="erreurs.conditionsAcceptees">
        J'ai lu et j'accepte les
        <a href="/cgu" target="_blank" rel="noopener">conditions d'utilisation</a> et la
        <a href="/confidentialite" target="_blank" rel="noopener">politique de confidentialité</a>.
      </CaseACocher>

      <TurnstileWidget ref="widget" @jeton="jeton = $event" />
      <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>
      <BoutonUi type="submit" variante="principal" :chargement="envoi" pleine-largeur>Créer mon compte</BoutonUi>
    </form>

    <template #liens><RouterLink to="/connexion">Tu as déjà un compte ? Connecte-toi</RouterLink></template>
  </FormulaireAuth>
</template>

<style scoped>
.formulaire {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
}
.roles {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: var(--e2);
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
  font-weight: 700;
}
</style>
