<script setup lang="ts">
// Paramètres de la plateforme (RGA17) : édition typée et validée pour le super-admin, lecture seule pour l'admin.
// Chaque paramètre s'enregistre seul, par la fonction modifier_parametre() de la base, qui le journalise.
import { computed, onMounted, reactive, ref } from 'vue'
import AlerteUi from '@/core/ui/AlerteUi.vue'
import BoutonUi from '@/core/ui/BoutonUi.vue'
import ChargementUi from '@/core/ui/ChargementUi.vue'
import { useToasts } from '@/core/ui/useToasts'
import { roleCourant } from '@/core/acces'
import { chargerParametres } from '@/core/parametres'
import { afficherValeur, GROUPES_PARAMETRES, lireValeur, type DefinitionParametre } from '../parametres'
import { listerParametres, modifierParametre } from '../services/plateformeService'

const { afficher } = useToasts()
const estSuper = computed(() => roleCourant.value === 'super_admin')

const valeurs = ref<Record<string, unknown>>({})
const saisies = reactive<Record<string, string | boolean>>({})
const erreurs = reactive<Record<string, string>>({})
const enCours = ref<string | null>(null)
const chargement = ref(true)
const erreurGenerale = ref('')

async function charger() {
  try {
    const lus = await listerParametres()
    valeurs.value = Object.fromEntries(Object.entries(lus).map(([cle, p]) => [cle, p.valeur]))
    for (const groupe of GROUPES_PARAMETRES) {
      for (const d of groupe.parametres) {
        const v = valeurs.value[d.cle]
        saisies[d.cle] = d.type === 'booleen' ? v === true : String(v ?? '')
      }
    }
  } catch (e) {
    erreurGenerale.value = e instanceof Error ? e.message : 'Impossible de charger les paramètres.'
  } finally {
    chargement.value = false
  }
}
onMounted(charger)

function modifie(d: DefinitionParametre): boolean {
  const v = valeurs.value[d.cle]
  return d.type === 'booleen' ? saisies[d.cle] !== (v === true) : String(saisies[d.cle]) !== String(v ?? '')
}

async function enregistrer(d: DefinitionParametre) {
  erreurs[d.cle] = ''
  const lu = lireValeur(d, saisies[d.cle] ?? '')
  if ('erreur' in lu) {
    erreurs[d.cle] = lu.erreur
    return
  }
  enCours.value = d.cle
  try {
    await modifierParametre(d.cle, lu.valeur)
    valeurs.value[d.cle] = lu.valeur
    // les paramètres publics sont relus : l'application du super-admin reflète tout de suite le changement
    await chargerParametres()
    afficher(`« ${d.libelle} » enregistré.`, 'succes')
  } catch (e) {
    erreurs[d.cle] = e instanceof Error ? e.message : 'Une erreur est survenue.'
  } finally {
    enCours.value = null
  }
}
</script>

<template>
  <section class="parametres">
    <AlerteUi v-if="erreurGenerale" type="erreur">{{ erreurGenerale }}</AlerteUi>
    <ChargementUi v-else-if="chargement" :lignes="6" />
    <template v-else>
      <AlerteUi v-if="!estSuper" type="info">
        Les paramètres ne sont modifiables que par le super-admin. Tu les vois ici en lecture seule.
      </AlerteUi>
      <p class="maintenance-lien">
        La maintenance a son propre écran : <RouterLink to="/admin/maintenance">Maintenance</RouterLink>.
      </p>

      <fieldset v-for="g in GROUPES_PARAMETRES" :key="g.titre" class="groupe">
        <legend>{{ g.titre }}</legend>
        <p v-if="g.description" class="aide">{{ g.description }}</p>
        <div v-for="d in g.parametres" :key="d.cle" class="ligne">
          <div class="texte">
            <label :for="`p-${d.cle}`">{{ d.libelle }}</label>
            <span class="aide">{{ d.aide }}</span>
            <span v-if="erreurs[d.cle]" class="erreur" role="alert">{{ erreurs[d.cle] }}</span>
          </div>

          <template v-if="estSuper">
            <div class="saisie">
              <input v-if="d.type === 'booleen'" :id="`p-${d.cle}`" v-model="saisies[d.cle]" type="checkbox" class="case" />
              <input v-else :id="`p-${d.cle}`" v-model="saisies[d.cle]" type="text" :inputmode="d.type === 'texte' ? 'text' : 'decimal'" />
              <span v-if="d.unite" class="unite">{{ d.unite }}</span>
              <BoutonUi variante="secondaire" :desactive="!modifie(d)" :chargement="enCours === d.cle" @click="enregistrer(d)">Enregistrer</BoutonUi>
            </div>
          </template>
          <strong v-else class="valeur">{{ afficherValeur(d, valeurs[d.cle]) }}</strong>
        </div>
      </fieldset>
    </template>
  </section>
</template>

<style scoped>
.parametres {
  display: flex;
  flex-direction: column;
  gap: var(--e4);
  max-width: 48rem;
}
.groupe {
  display: flex;
  flex-direction: column;
  gap: var(--e3);
  margin: 0;
  padding: var(--e4);
  border: 1px solid var(--bordure);
  border-radius: var(--rayon);
  background: var(--surface);
}
legend {
  padding: 0 var(--e2);
  font-family: var(--police-titre);
  font-weight: 800;
}
.ligne {
  display: flex;
  flex-wrap: wrap;
  gap: var(--e3);
  align-items: center;
  justify-content: space-between;
  padding-top: var(--e3);
  border-top: 1px solid var(--bordure);
}
.ligne:first-of-type {
  padding-top: 0;
  border-top: 0;
}
.texte {
  display: flex;
  flex: 1 1 14rem;
  flex-direction: column;
  gap: 2px;
}
.texte label {
  font-weight: 700;
}
.aide,
.maintenance-lien {
  margin: 0;
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.erreur {
  color: var(--erreur);
  font-size: var(--texte-s);
}
.saisie {
  display: flex;
  gap: var(--e2);
  align-items: center;
}
.saisie input[type='text'] {
  width: 8rem;
  min-height: var(--cible-min);
  padding: 0 var(--e3);
  border: 1.5px solid var(--bordure-champ);
  border-radius: var(--rayon-s);
  background: var(--surface);
  color: var(--encre);
  font: inherit;
}
.case {
  width: 24px;
  height: 24px;
  accent-color: var(--indigo);
}
.unite {
  color: var(--texte-secondaire);
  font-size: var(--texte-s);
}
.valeur {
  min-width: 6rem;
  text-align: right;
}
</style>
