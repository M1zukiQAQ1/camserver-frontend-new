<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

const underConstruction = useRuntimeConfig().public.underConstruction

useHead({
  titleTemplate: title => title ? `${title} | UCSB All Sky` : 'UCSB All Sky Camera',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    {
      name: 'description',
      content: 'All-sky camera imagery, seeing conditions, and plate-solve tools from the UCSB Deep Space Observatory.'
    }
  ],
  htmlAttrs: {
    lang: 'en',
    // Nuxt UI's dark variants key on this class; color mode switching is disabled in nuxt.config.
    class: 'dark'
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

const mobileMenuItems = computed<DropdownMenuItem[]>(() => menuItems.value.map(item => ({
  label: item.label,
  icon: item.icon,
  to: item.to
})))

const currentYear = new Date().getFullYear()
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
          class="flex min-w-0 items-center text-current no-underline"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-extrabold tracking-wide text-white sm:text-base">All Sky Cameras</span>
            <span class="hidden text-xs text-slate-400 sm:block">Deep Space Observatory</span>
          </span>
        </NuxtLink>
      </template>

      <template #right>
        <UNavigationMenu
          v-if="!underConstruction"
          :items="menuItems"
          class="hidden md:flex"
        />
        <UDropdownMenu
          v-if="!underConstruction"
          :items="mobileMenuItems"
          :content="{ align: 'end' }"
          class="md:hidden"
        >
          <UButton
            icon="i-lucide-menu"
            variant="subtle"
            color="neutral"
            aria-label="Open navigation menu"
          />
        </UDropdownMenu>
      </template>
    </UHeader>

    <UMain class="min-h-[calc(100vh-4rem)]">
      <div
        v-if="underConstruction"
        class="relative isolate overflow-hidden"
      >
        <div class="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/40 via-slate-950/82 to-slate-950" />
        <UContainer class="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 py-16 text-center">
          <span class="astro-eyebrow flex items-center gap-3">
            <span class="h-px w-8 bg-amber-200/80" />
            Deep Space Observatory
            <span class="h-px w-8 bg-amber-200/80" />
          </span>
          <h1 class="text-5xl font-black tracking-normal text-white md:text-7xl">
            Under Construction
          </h1>
          <p class="max-w-xl text-lg leading-8 text-slate-300">
            The UCSB All Sky Camera website is moving to a new server.
            We'll be back online soon.
          </p>
          <UIcon
            name="i-lucide-construction"
            class="size-10 text-amber-300/80"
          />
        </UContainer>
      </div>
      <NuxtPage v-else />
    </UMain>

    <footer
      v-if="!underConstruction"
      class="border-t border-white/10 bg-slate-950/40"
    >
      <UContainer class="flex flex-col gap-6 py-8 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="font-bold text-slate-200">
            UCSB Deep Space Observatory
          </p>
          <p class="text-xs">
            All Sky Camera archive · Broida Hall, University of California, Santa Barbara
          </p>
        </div>
        <nav
          class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-wider"
          aria-label="Footer"
        >
          <NuxtLink
            v-for="item in menuItems"
            :key="item.label"
            :to="item.to"
            class="text-slate-400 no-underline transition hover:text-sky-200"
          >
            {{ item.label }}
          </NuxtLink>
          <span class="text-slate-600">© {{ currentYear }}</span>
        </nav>
      </UContainer>
    </footer>
  </UApp>
</template>
