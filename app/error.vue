<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const isNotFound = computed(() => props.error.statusCode === 404)

const title = computed(() => isNotFound.value ? 'Lost in the dark' : 'Something went wrong')

const description = computed(() => isNotFound.value
  ? 'The page you are looking for is not on our sky map.'
  : props.error.statusMessage || 'An unexpected error occurred while loading this page.'
)

useHead({
  title: isNotFound.value ? 'Page not found' : 'Error'
})

const goHome = () => clearError({ redirect: '/' })
const goGallery = () => clearError({ redirect: '/gallery' })
</script>

<template>
  <UApp>
    <div class="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/40 via-slate-950/82 to-slate-950" />
      <span class="astro-eyebrow flex items-center gap-3">
        <span class="h-px w-8 bg-amber-200/80" />
        Error {{ error.statusCode }}
        <span class="h-px w-8 bg-amber-200/80" />
      </span>
      <h1 class="mt-6 text-5xl font-black tracking-normal text-white md:text-7xl">
        {{ title }}
      </h1>
      <p class="mt-4 max-w-xl text-lg leading-8 text-slate-300">
        {{ description }}
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <UButton
          size="lg"
          icon="i-lucide-house"
          @click="goHome"
        >
          Back to home
        </UButton>
        <UButton
          size="lg"
          color="neutral"
          variant="subtle"
          icon="i-lucide-images"
          @click="goGallery"
        >
          Open gallery
        </UButton>
      </div>
    </div>
  </UApp>
</template>
