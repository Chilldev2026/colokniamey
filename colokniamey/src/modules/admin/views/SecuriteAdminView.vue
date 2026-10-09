<script setup lang="ts">
// Sécurité du compte admin : appareils d'authentification (RGA37) et, pour le super-admin,
// préférences d'e-mail (RGA35). Les relances manuelles s'affichent toujours dans l'application.
import { onMounted, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { roleCourant } from '@/core/acces'
import FormulaireTotp from '../components/FormulaireTotp.vue'
import { definirPreferences, lirePreferences, supprimerFacteur } from '../services/adminService'
import { useAdminStore } from '../stores/adminStore'

const admin = useAdminStore()
const { afficher } = useToasts()

const ajout = ref(false)
const erreur = ref('')
const recap = ref(true)
const alertes = ref(true)
const prefsChargees = ref(false)
const enregistrement = ref(false)

onMounted(async () => {
  await admin.chargerFacteurs().catch(() => undefined)
  if (roleCourant.value === 'super_admin') {
    try {
      const p = await lirePreferences()
      recap.value = p.recap
      alertes.value = p.alertes
      prefsChargees.value = true
    } catch (e) {
      erreur.value = e instanceof Error ? e.message : 'Impossible de charger les préférences.'
    }
  }
})

async function appareilAjoute() {
  ajout.value = false
  await admin.chargerFacteurs()
  afficher('Appareil ajouté.', 'succes')
}

async function retirer(id: string) {
  erreur.value = ''
  try {
    await supprimerFacteur(id)
    await admin.chargerFacteurs()
    afficher('Appareil retiré.', 'succes')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  }
}

async function enregistrerPreferences() {
  erreur.value = ''
  enregistrement.value = true
  try {
    await definirPreferences(recap.value, alertes.value)
    afficher('Préférences enregistrées.', 'succes')
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    enregistrement.value = false
  }
}
</script>

<template>
  <section class="securite">
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <div class="bloc">
      <h2>Appareils d'authentification</h2>
      <p>
        Chaque appareil enregistré génère les codes demandés à la connexion. Garde-en deux : si tu perds ton téléphone, l'autre
        te laisse entrer.
      </p>
      <ul class="appareils">
        <li v-for="f in admin.facteursVerifies" :key="f.id">
          <span>{{ f.nom }} <PuceUi variante="validee">Actif</PuceUi></span>
          <BoutonUi v-if="admin.facteursVerifies.length > 1" variante="secondaire" @click="retirer(f.id)">Retirer</BoutonUi>
        </li>
      </ul>
      <AlerteUi v-if="admin.facteursVerifies.length < 2" type="info">
        Un seul appareil est enregistré. Ajoute-en un deuxième pour sécuriser ton accès.
      </AlerteUi>
      <BoutonUi v-if="!ajout" variante="principal" @click="ajout = true">Ajouter un appareil</BoutonUi>
      <FormulaireTotp v-else libelle-bouton="Enregistrer cet appareil" @verifie="appareilAjoute" />
    </div>

    <div v-if="roleCourant === 'super_admin' && prefsChargees" class="bloc">
      <h2>E-mails du super-admin</h2>
      <p>
        Les e-mails ne concernent que toi. Ils ne contiennent ni nom, ni téléphone, ni image : seulement les files, les
        nombres et l'ancienneté. Les relances manuelles s'affichent toujours dans l'application.
      </p>
      <label class="option"><input v-model="recap" type="checkbox" /> Récapitulatif quotidien (chaque matin)</label>
      <label class="option"><input v-model="alertes" type="checkbox" /> Alertes urgentes (élément en attente depuis plus de 24 h)</label>
      <BoutonUi variante="principal" :chargement="enregistrement" @click="enregistrerPreferences">Enregistrer</BoutonUi>
    </div>
  </section>
</template>

<style scoped>
.securite {
  display: flex;
  flex-direction: column;
  gap: var(--e5);
  max-width: 36rem;
}
.bloc {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  align-items: flex-start;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.bloc > * {
  max-width: 100%;
}
h2,
p {
  margin: 0;
}
h2 {
  font-family: var(--police-titre);
  font-size: var(--texte-l);
}
.appareils {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}
.appareils li {
  display: flex;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
}
.option {
  display: flex;
  gap: var(--e3);
  align-items: center;
  min-height: var(--cible-min);
}
.option input {
  width: 22px;
  height: 22px;
  accent-color: var(--indigo);
}
</style>
