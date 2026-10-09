<script setup lang="ts">
// Badge « Identité vérifiée » (RG55 : seul élément public du dossier). Affiché par CarteProfilPublic quand K est actif.
// Tant que le KYC est désactivé (RG59), il n'affiche rien : « vérifié » n'aurait alors aucun sens.
import { onMounted, ref, watch } from 'vue'
import { BadgeCheck } from 'lucide-vue-next'
import { parametres } from '@/core/parametres'
import { lireIdentiteVerifiee } from '../services/identiteService'

const props = defineProps<{ userId: string }>()
const verifiee = ref(false)

async function charger() {
  verifiee.value = parametres.value.kyc_actif ? await lireIdentiteVerifiee(props.userId) : false
}

onMounted(charger)
watch(() => [props.userId, parametres.value.kyc_actif], charger)
</script>

<template>
  <span v-if="verifiee" class="badge">
    <BadgeCheck :size="16" :stroke-width="2" aria-hidden="true" />
    Identité vérifiée
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  gap: var(--e1);
  align-items: center;
  padding: 2px var(--e2);
  border-radius: var(--rayon-rond);
  border: 1px solid var(--bordure);
  background: var(--surface);
  color: var(--vert);
  font-size: var(--texte-s);
  font-weight: 700;
}
</style>
