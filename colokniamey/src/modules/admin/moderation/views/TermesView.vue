<script setup lang="ts">
// Termes sensibles (RG46, RGA28) : tout admin propose un terme, qui reste inactif ; seul le super-admin le valide,
// le modifie, le désactive ou le rejette. Le super-admin voit toute la liste, l'admin seulement ses propositions :
// la liste n'est jamais diffusée à plus de personnes que nécessaire.
// Les termes en langues locales (haoussa, zarma, tamasheq…) sont fournis par l'auteur : aucun n'est inventé ici.
import { computed, onMounted, reactive, ref } from 'vue'
import { roleCourant } from '@/core/acces'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChampUi from '@/core/ui/ChampUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import EtatVide from '@/core/ui/EtatVide.vue'
import ModaleUi from '@/core/ui/ModaleUi.vue'
import PuceUi from '@/core/ui/PuceUi.vue'
import SelecteurUi from '@/core/ui/SelecteurUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import {
  definirTermeActif,
  listerTermes,
  modifierTerme,
  proposerTerme,
  rejeterTerme,
  validerTerme,
  type CategorieTerme,
  type NiveauTerme,
  type TermeSensible,
} from '../services/moderationService'

const CATEGORIES: { valeur: CategorieTerme; libelle: string }[] = [
  { valeur: 'sexuel', libelle: 'Sexuel' },
  { valeur: 'haine', libelle: 'Haine ou racisme' },
  { valeur: 'terrorisme', libelle: 'Terrorisme' },
  { valeur: 'violence', libelle: 'Violence' },
  { valeur: 'menace', libelle: 'Menace' },
]
const NIVEAUX: { valeur: NiveauTerme; libelle: string }[] = [
  { valeur: 'revue', libelle: 'Mise en revue (le contenu est masqué)' },
  { valeur: 'blocage', libelle: 'Blocage (le texte est refusé)' },
]

const { afficher } = useToasts()
const estSuper = computed(() => roleCourant.value === 'super_admin')
const termes = ref<TermeSensible[]>([])
const chargement = ref(true)
const occupe = ref(false)
const erreur = ref('')
const formulaire = reactive({ terme: '', categorie: 'sexuel' as CategorieTerme, niveau: 'revue' as NiveauTerme, langue: 'fr' })
const edition = reactive({ ouverte: false, id: 0, terme: '', categorie: 'sexuel' as CategorieTerme, niveau: 'revue' as NiveauTerme, langue: 'fr' })

async function charger() {
  try {
    termes.value = await listerTermes()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Impossible de charger la liste.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

async function agir(travail: () => Promise<void>, message: string) {
  occupe.value = true
  erreur.value = ''
  try {
    await travail()
    afficher(message, 'succes')
    await charger()
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : 'Action impossible.'
  } finally {
    occupe.value = false
  }
}

async function proposer() {
  if (formulaire.terme.trim().length < 3) {
    erreur.value = 'Le terme doit avoir au moins 3 caractères.'
    return
  }
  await agir(async () => {
    await proposerTerme(formulaire.terme.trim(), formulaire.categorie, formulaire.niveau, formulaire.langue.trim() || 'fr')
    formulaire.terme = ''
  }, estSuper.value ? 'Terme ajouté et actif.' : 'Terme proposé. Il sera actif après validation par le super-admin.')
}

function ouvrirEdition(t: TermeSensible) {
  Object.assign(edition, { ouverte: true, id: t.id, terme: t.terme, categorie: t.categorie, niveau: t.niveau, langue: t.langue })
}
async function enregistrerEdition() {
  await agir(async () => {
    await modifierTerme(edition.id, edition.terme.trim(), edition.categorie, edition.niveau, edition.langue.trim() || 'fr')
    edition.ouverte = false
  }, 'Terme modifié.')
}

const libelleCategorie = (v: string) => CATEGORIES.find((c) => c.valeur === v)?.libelle ?? v
const libelleNiveau = (v: string) => (v === 'blocage' ? 'Blocage' : 'Revue')
const aValider = computed(() => termes.value.filter((t) => !t.valide))
const valides = computed(() => termes.value.filter((t) => t.valide))
</script>

<template>
  <section class="termes">
    <h1>Termes sensibles</h1>
    <AlerteUi type="info">
      {{ estSuper ? 'Tu valides les termes proposés par les admins. Un terme validé et actif est détecté dans tous les textes.' : 'Tu peux proposer un terme. Il reste inactif tant que le super-admin ne l\'a pas validé.' }}
    </AlerteUi>
    <AlerteUi v-if="erreur" type="erreur">{{ erreur }}</AlerteUi>

    <form class="proposer" novalidate @submit.prevent="proposer">
      <h2>{{ estSuper ? 'Ajouter un terme' : 'Proposer un terme' }}</h2>
      <ChampUi v-model="formulaire.terme" libelle="Terme ou expression" aide="Accents, majuscules et chiffres à la place des lettres sont gérés automatiquement." />
      <SelecteurUi v-model="formulaire.categorie" libelle="Catégorie" :options="CATEGORIES.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))" />
      <SelecteurUi v-model="formulaire.niveau" libelle="Niveau" :options="NIVEAUX.map((n) => ({ valeur: n.valeur, libelle: n.libelle }))" />
      <ChampUi v-model="formulaire.langue" libelle="Langue (code court : fr, ha, dje…)" />
      <BoutonUi type="submit" variante="principal" :chargement="occupe">{{ estSuper ? 'Ajouter' : 'Proposer' }}</BoutonUi>
    </form>

    <ChargementUi v-if="chargement" :lignes="3" />
    <template v-else>
      <section v-if="aValider.length > 0" class="groupe">
        <h2>{{ estSuper ? 'À valider' : 'Mes propositions en attente' }}</h2>
        <ul class="liste">
          <li v-for="t in aValider" :key="t.id" class="terme">
            <div>
              <strong>{{ t.terme }}</strong>
              <span class="meta">{{ libelleCategorie(t.categorie) }} · {{ libelleNiveau(t.niveau) }} · {{ t.langue }}</span>
              <PuceUi>Inactif : en attente de validation</PuceUi>
            </div>
            <div v-if="estSuper" class="actions">
              <BoutonUi variante="principal" :desactive="occupe" @click="agir(() => validerTerme(t.id), 'Terme validé.')">Valider</BoutonUi>
              <BoutonUi variante="secondaire" :desactive="occupe" @click="ouvrirEdition(t)">Modifier</BoutonUi>
              <BoutonUi variante="danger" :desactive="occupe" @click="agir(() => rejeterTerme(t.id), 'Proposition rejetée.')">Rejeter</BoutonUi>
            </div>
          </li>
        </ul>
      </section>

      <section class="groupe">
        <h2>{{ estSuper ? 'Termes validés' : 'Mes termes validés' }}</h2>
        <EtatVide v-if="valides.length === 0" message="Aucun terme validé dans cette liste." />
        <ul v-else class="liste">
          <li v-for="t in valides" :key="t.id" class="terme">
            <div>
              <strong>{{ t.terme }}</strong>
              <span class="meta">{{ libelleCategorie(t.categorie) }} · {{ libelleNiveau(t.niveau) }} · {{ t.langue }}</span>
              <PuceUi :variante="t.actif ? 'validee' : 'neutre'">{{ t.actif ? 'Actif' : 'Désactivé' }}</PuceUi>
            </div>
            <div v-if="estSuper" class="actions">
              <BoutonUi variante="secondaire" :desactive="occupe" @click="ouvrirEdition(t)">Modifier</BoutonUi>
              <BoutonUi variante="secondaire" :desactive="occupe" @click="agir(() => definirTermeActif(t.id, !t.actif), t.actif ? 'Terme désactivé.' : 'Terme réactivé.')">
                {{ t.actif ? 'Désactiver' : 'Réactiver' }}
              </BoutonUi>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <ModaleUi v-model="edition.ouverte" titre="Modifier le terme">
      <ChampUi v-model="edition.terme" libelle="Terme ou expression" />
      <SelecteurUi v-model="edition.categorie" libelle="Catégorie" :options="CATEGORIES.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))" />
      <SelecteurUi v-model="edition.niveau" libelle="Niveau" :options="NIVEAUX.map((n) => ({ valeur: n.valeur, libelle: n.libelle }))" />
      <ChampUi v-model="edition.langue" libelle="Langue" />
      <template #actions>
        <BoutonUi variante="secondaire" @click="edition.ouverte = false">Annuler</BoutonUi>
        <BoutonUi variante="principal" :chargement="occupe" @click="enregistrerEdition">Enregistrer</BoutonUi>
      </template>
    </ModaleUi>
  </section>
</template>

<style scoped>
.termes {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 48rem;
}
h1,
h2 {
  margin: 0;
}
.proposer,
.groupe {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
}
.proposer {
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.liste {
  display: flex;
  flex-direction: column;
  gap: var(--e2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.terme {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
  padding: var(--e3);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
.terme > div:first-child {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
  align-items: center;
}
.meta {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e2);
}
</style>
