<script setup lang="ts">
import type { Camera } from '~/type/camera'
import type { CameraImage } from '~/type/cameraImage'
import type { ImageQuery } from '~/type/imageQuery'
import { formatDate } from '~/utils/formatDateTime'
import { getImageFileName } from '~/utils/getImageFileName'
import { getImagePeriod } from '~/utils/getImagePeriod'

const apiBase = useApiBase()
const FALLBACK_HERO = '/img1.jpg'

const featuredQuery: ImageQuery = {
  featured: true
}

const { data: featData, status, error } = await useFetch<CameraImage[]>(`${apiBase}/api/query`, {
  query: featuredQuery
})

// Secondary data for the hero stat tiles; the page renders fine without it.
const { data: sites } = useLazyFetch<Camera[]>(`${apiBase}/api/sites`)
const { data: latestFrames } = useLazyFetch<CameraImage[]>(`${apiBase}/api/query`, {
  query: { pagesize: 1 }
})

const featuredImages = computed(() => featData.value ?? [])
const isPending = computed(() => status.value === 'pending')

const heroImageFailed = ref(false)

const heroImageUrl = computed(() => {
  const image = featuredImages.value[0]
  return image && !heroImageFailed.value
    ? imageUrlFor(image)
    : FALLBACK_HERO
})

const siteCount = computed(() => sites.value?.length ?? null)
const latestCaptureLabel = computed(() => {
  const latest = latestFrames.value?.[0]
  return latest ? formatDate(latest.timestamp) : null
})

const imageUrlFor = (image: CameraImage) => `${apiBase}/api/images/${getImageFileName(image.imgPath)}.jpg`
</script>

<template>
  <div class="pb-16">
    <section class="relative isolate overflow-hidden">
      <img
        :src="heroImageUrl"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 -z-10 h-full w-full object-cover opacity-45 saturate-125"
        @error="heroImageFailed = true"
      >
      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/40 via-slate-950/82 to-slate-950" />

      <UContainer class="grid min-h-[calc(100vh-4rem)] items-end gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:py-16">
        <div class="max-w-4xl">
          <div class="astro-eyebrow mb-5 flex items-center gap-3">
            <span class="h-px w-8 bg-emerald-200/80" />
            Broida Hall rooftop sky array
          </div>
          <h1 class="max-w-4xl text-6xl font-black leading-[0.9] tracking-normal text-white md:text-8xl">
            All Sky Camera
          </h1>
          <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Live all-sky imagery, observing conditions, and plate-solve tools for inspecting the night above UCSB.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UButton
              to="/gallery"
              size="xl"
              icon="i-lucide-telescope"
            >
              Open Gallery
            </UButton>
            <UButton
              to="/seeing-monitor"
              size="xl"
              color="neutral"
              variant="subtle"
              icon="i-lucide-radio-tower"
            >
              Seeing Monitor
            </UButton>
          </div>
        </div>

        <div class="astro-panel p-4">
          <div class="astro-ring overflow-hidden rounded-lg bg-black">
            <img
              :src="heroImageUrl"
              alt="Latest featured all-sky capture"
              class="aspect-square w-full object-cover saturate-125"
              @error="heroImageFailed = true"
            >
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="text-lg font-black tabular-nums text-sky-200">
                {{ siteCount ?? '--' }}
              </div>
              <div class="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                Sites
              </div>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="text-lg font-black tabular-nums text-amber-200">
                {{ featuredImages.length }}
              </div>
              <div class="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                Featured
              </div>
            </div>
            <div class="rounded-lg border border-white/10 bg-white/[0.04] p-3">
              <div class="text-sm font-black leading-6 text-emerald-200">
                {{ latestCaptureLabel ?? '--' }}
              </div>
              <div class="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                Latest frame
              </div>
            </div>
          </div>
        </div>
      </UContainer>
    </section>

    <UContainer class="py-14">
      <div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p class="astro-eyebrow">
            Featured frames
          </p>
          <h2 class="mt-2 text-3xl font-black tracking-normal text-white">
            Recent sky windows
          </h2>
        </div>
        <UButton
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="subtle"
          to="/gallery"
        >
          Visit Gallery
        </UButton>
      </div>

      <div
        v-if="isPending"
        class="astro-panel grid min-h-56 place-items-center"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 animate-spin text-sky-200"
        />
      </div>

      <div
        v-else-if="error"
        class="astro-panel p-4"
      >
        <UAlert
          color="error"
          variant="subtle"
          title="Featured frames could not be loaded."
          :description="error?.message || 'Please try again in a moment.'"
        />
      </div>

      <div
        v-else-if="featuredImages.length"
        class="astro-panel p-3"
      >
        <UCarousel
          v-slot="{ item }"
          loop
          arrows
          dots
          auto-scroll
          :items="featuredImages"
          :ui="{ item: 'basis-full sm:basis-1/2 lg:basis-1/3 p-2' }"
        >
          <NuxtLink
            :to="`/gallery/${item.imgId}`"
            class="group block overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 text-current no-underline"
          >
            <img
              :src="imageUrlFor(item)"
              :alt="`${item.siteName} ${getImagePeriod(item.timestamp)} capture`"
              loading="lazy"
              decoding="async"
              class="aspect-[4/3] w-full bg-black object-cover transition duration-300 group-hover:scale-[1.03]"
            >
            <div class="flex items-center justify-between gap-3 p-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-white">
                  {{ item.siteName }}
                </p>
                <p class="text-xs text-slate-400">
                  {{ getImagePeriod(item.timestamp) }} · {{ formatDate(item.timestamp) }}
                </p>
              </div>
              <UIcon
                name="i-lucide-arrow-up-right"
                class="size-4 text-sky-200"
              />
            </div>
          </NuxtLink>
        </UCarousel>
      </div>

      <div
        v-else
        class="astro-panel p-4"
      >
        <UAlert
          color="neutral"
          variant="subtle"
          title="No featured images yet."
          description="Open the gallery to browse the full archive."
        />
      </div>
    </UContainer>
  </div>
</template>
