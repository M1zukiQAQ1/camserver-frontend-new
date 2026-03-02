<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';


useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const menuItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Gallery',
    to: '/Gallery'
  },
  {
    label: 'Seeing Monitor'
  },
  {
    label: 'Star Tracker'
  }
])
</script>

<template>
  <UApp>
    <UHeader>
      <template #left> 
        <img class="logo" src="/ucsblogo.png">
        <router-link to="/" class="text-xl font-bold ml-3">
          <h1> All Sky Cameras </h1>
        </router-link>
      </template>


      
      <template #right> 
        <UNavigationMenu :items="menuItems" />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <USeparator icon="i-simple-icons-nuxtdotjs" />

  </UApp>
</template>

<style lang="css" scoped>
.logo {
  height: 15px;
  width: auto;
  object-fit: contain;
  display: block;
}
</style>
