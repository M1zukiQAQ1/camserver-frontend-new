<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

useHead({
  titleTemplate: title => title ? `${title} | UCSB All Sky` : 'UCSB All Sky Camera',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const menuItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Gallery',
    icon: 'i-lucide-images',
    to: '/gallery'
  },
  {
    label: 'Seeing Monitor',
    icon: 'i-lucide-radio-tower',
    to: '/seeing-monitor'
  },
  {
    label: 'Star Tracker',
    icon: 'i-lucide-crosshair',
    to: '/'
  }
])
</script>

<template>
  <UApp>
    <UHeader
      class="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl"
      :ui="{ container: 'h-16' }"
    >
      <template #left>
        <NuxtLink
          to="/"
          class="flex min-w-0 items-center gap-3 text-current no-underline"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >
            <span>DS</span>
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-extrabold tracking-wide text-white sm:text-base">All Sky Cameras</span>
            <span class="hidden text-xs text-slate-400 sm:block">Deep Space Observatory</span>
          </span>
        </NuxtLink>
      </template>

      <template #right>
        <UNavigationMenu
          :items="menuItems"
          class="hidden md:flex"
        />
        <UButton
          to="/gallery"
          icon="i-lucide-images"
          variant="subtle"
          color="primary"
          class="md:hidden"
          aria-label="Open gallery"
        />
      </template>
    </UHeader>

    <div class="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
      <UIcon
        name="i-lucide-construction"
        class="mr-1 inline-block align-text-bottom"
      />
      This website is under construction — we are migrating to a new server. Some images and data may be temporarily unavailable.
    </div>

    <UMain class="min-h-[calc(100vh-4rem)]">
      <NuxtPage />
    </UMain>
  </UApp>
</template>

<style scoped>
.brand-mark {
  position: relative;
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgb(125 211 252 / 0.35);
  border-radius: 9999px;
  background:
    radial-gradient(circle at 50% 50%, rgb(248 216 124 / 0.74) 0 0.18rem, transparent 0.22rem),
    conic-gradient(from 26deg, transparent 0 22%, rgb(125 211 252 / 0.72) 23% 25%, transparent 26% 57%, rgb(141 227 200 / 0.6) 58% 60%, transparent 61% 100%),
    rgb(125 211 252 / 0.08);
  box-shadow: 0 0 30px rgb(125 211 252 / 0.18);
}

.brand-mark span {
  color: white;
  font-size: 0.6rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 8px rgb(0 0 0 / 0.65);
}
</style>
