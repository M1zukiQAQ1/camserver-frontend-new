<script setup lang="ts">
import FilterPanel from '~/components/filter.vue'
import GalleryCard from '~/components/galleryCard.vue'
import type { Camera } from '~/type/camera'
import type { CameraImage } from '~/type/cameraImage'
import type { ImageQuery } from '~/type/imageQuery'

const apiBase = useApiBase()

type SelectItem = {
  label: string
  value: string
}

const allCameraItem: SelectItem = {
  label: 'All',
  value: 'all'
}

const allPeriodItem: SelectItem = {
  label: 'All',
  value: 'all'
}

const periodItems = ref<SelectItem[]>([
  allPeriodItem,
  { label: 'Night', value: 'Night' },
  { label: 'Day', value: 'Day' },
  { label: 'Dawn', value: 'Dawn' },
  { label: 'Dusk', value: 'Dusk' }
])

const searchTerm = ref('')
const debouncedSearchTerm = ref('')
const cameraItem = ref<SelectItem>(allCameraItem)
const periodItem = ref<SelectItem>(allPeriodItem)
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

watch(searchTerm, (value) => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    debouncedSearchTerm.value = value.trim()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
})

const imageQuery = computed<ImageQuery>(() => {
  const query: ImageQuery = {
    pagesize: 60
  }

  if (cameraItem.value.value !== allCameraItem.value) {
    query.siteName = cameraItem.value.label
  }

  if (debouncedSearchTerm.value) {
    query.search = debouncedSearchTerm.value
  }

  if (periodItem.value.value !== allPeriodItem.value) {
    query.period = periodItem.value.value
  }

  return query
})

const {
  data: cameras,
  pending: camerasPending,
  error: camerasError
} = await useFetch<Camera[]>(`${apiBase}/api/sites`)

const {
  data: images,
  pending: imagesPending,
  error: imagesError
} = await useFetch<CameraImage[]>(`${apiBase}/api/query`, {
  query: imageQuery
})

const cameraItems = computed<SelectItem[]>(() => [
  allCameraItem,
  ...(cameras.value ?? []).map(cam => ({
    label: cam.siteName,
    value: cam.UID
  }))
])

const filteredImages = computed(() => images.value ?? [])

const isInitialPending = computed(() =>
  (camerasPending.value && !cameras.value)
  || (imagesPending.value && !images.value)
)

const hasBlockingError = computed(() =>
  (camerasError.value && !cameras.value)
  || (imagesError.value && !images.value)
)

const onResetFilters = () => {
  searchTerm.value = ''
  debouncedSearchTerm.value = ''
  cameraItem.value = allCameraItem
  periodItem.value = allPeriodItem
}
</script>

<template>
  <div class="pb-16">
    <section class="border-b border-white/10 bg-slate-950/40">
      <UContainer class="py-12 md:py-16">
        <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p class="astro-eyebrow">
              Archive
            </p>
            <h1 class="mt-3 text-5xl font-black leading-none tracking-normal text-white md:text-7xl">
              All Sky Gallery
            </h1>
            <p class="mt-4 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
              Browse all-sky captures by camera, sky period, location, and search terms.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div class="astro-panel-strong p-4 text-center">
              <div class="text-2xl font-black text-sky-200">
                {{ filteredImages.length }}
              </div>
              <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                Results
              </div>
            </div>
            <div class="astro-panel-strong p-4 text-center">
              <div class="text-2xl font-black text-emerald-200">
                {{ cameraItems.length - 1 }}
              </div>
              <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                Sites
              </div>
            </div>
            <div class="astro-panel-strong col-span-2 p-4 text-center sm:col-span-1">
              <div class="text-2xl font-black text-amber-200">
                {{ periodItem.label }}
              </div>
              <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                Period
              </div>
            </div>
          </div>
        </div>
      </UContainer>
    </section>

    <div
      v-if="isInitialPending"
      class="grid min-h-80 place-items-center"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-sky-200"
      />
    </div>

    <div
      v-else-if="hasBlockingError"
      class="mx-auto max-w-3xl px-6 py-12"
    >
      <UAlert
        color="error"
        variant="subtle"
        :title="camerasError?.message || imagesError?.message"
        description="Please try again."
      />
    </div>

    <div
      v-else
      class="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-6 lg:flex-row lg:px-8"
    >
      <aside class="w-full shrink-0 lg:w-72">
        <FilterPanel
          v-model:search="searchTerm"
          v-model:period="periodItem"
          v-model:camera="cameraItem"
          :period-items="periodItems"
          :camera-items="cameraItems"
          @reset="onResetFilters"
        />
      </aside>

      <main class="min-w-0 flex-1">
        <div
          v-if="imagesPending"
          class="astro-panel mb-4 flex items-center gap-2 px-4 py-3 text-sm text-slate-300"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          <span>Updating results</span>
        </div>

        <div
          v-if="filteredImages.length"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <GalleryCard
            v-for="image in filteredImages"
            :key="image.imgId"
            :image="image"
            :site="cameras?.find((cam) => cam.cameraId === image.cameraId)?.siteName ?? 'Error'"
          />
        </div>
        <UAlert
          v-else
          class="astro-panel p-2"
          color="neutral"
          variant="subtle"
          title="No images match the current filters."
          description="Try a different camera, period, or search term."
        />
      </main>
    </div>
  </div>
</template>
