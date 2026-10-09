<script setup lang="ts">
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import BoutonInstaller from '../pwa/BoutonInstaller.vue'
import { useInstallation } from '../pwa/useInstallation'

const { dejaInstallee } = useInstallation()
const qr = ref('')

onMounted(async () => {
  // Le QR code pointe vers l'adresse du site ; l'image est une adresse data: générée localement
  qr.value = await QRCode.toDataURL(window.location.origin, { margin: 1, width: 240 })
})
</script>

<template>
  <section class="installer">
    <h1>Installer l'application</h1>
    <p v-if="dejaInstallee">L'application est déjà installée sur cet appareil.</p>
    <BoutonInstaller />

    <h2>Sur Android</h2>
    <p>Ouvre le site dans Chrome, touche « Télécharger l'application » ou le menu ⋮ puis « Installer l'application ».</p>

    <h2>Sur iPhone</h2>
    <ol>
      <li>Ouvre le site dans Safari.</li>
      <li>Touche le bouton Partager.</li>
      <li>Choisis « Sur l'écran d'accueil ».</li>
    </ol>

    <h2>Sur ordinateur</h2>
    <p>Dans Chrome ou Edge, clique sur l'icône d'installation à droite de la barre d'adresse.</p>

    <h2>Scanner avec ton téléphone</h2>
    <img v-if="qr" :src="qr" width="240" height="240" alt="QR code vers le site ColokNiamey" />
  </section>
</template>
