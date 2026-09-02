<script setup lang="ts">
import FilterPanel from '~/components/filter.vue'
import GalleryCard from '~/components/galleryCard.vue'
import type { Camera } from '~/type/camera'
import type { CameraImage } from '~/type/cameraImage'
import type { ImageQuery } from '~/type/imageQuery'

useHead({
  title: 'Gallery'
})

const apiBase = useApiBase()
const PAGE_SIZE = 60

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
const startDate = ref('')
const endDate = ref('')
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
    pagesize: PAGE_SIZE
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

  if (startDate.value) {
    query.startDate = `${startDate.value}T00:00:00`
  }

  if (endDate.value) {
    query.endDate = `${endDate.value}T23:59:59`
  }

  return query
})

const {
  data: cameras,
  status: camerasStatus,
  error: camerasError
} = await useFetch<Camera[]>(`${apiBase}/api/sites`)

const {
  data: firstPage,
  status: imagesStatus,
  error: imagesError
} = await useFetch<CameraImage[]>(`${apiBase}/api/query`, {
  query: imageQuery
})

// Pages after the first are appended on demand using the API's imgId cursor (lastUID).
const extraPages = ref<CameraImage[]>([])
const loadingMore = ref(false)
const loadMoreError = ref('')
const reachedEnd = ref(false)

watch(firstPage, (page) => {
  extraPages.value = []
  loadMoreError.value = ''
  reachedEnd.value = (page?.length ?? 0) < PAGE_SIZE
}, { immediate: true })

const images = computed(() => [...(firstPage.value ?? []), ...extraPages.value])
const hasMore = computed(() => images.value.length > 0 && !reachedEnd.value)
const isRefreshing = computed(() => imagesStatus.value === 'pending')

const loadMore = async () => {
  const last = images.value[images.value.length - 1]
  if (!last || loadingMore.value) {
    return
  }

  const queryAtStart = imageQuery.value
  loadingMore.value = true
  loadMoreError.value = ''

  try {
    const page = await $fetch<CameraImage[]>(`${apiBase}/api/query`, {
      query: { ...queryAtStart, lastUID: last.imgId }
    })

    // Filters changed while this page was in flight; the watcher already reset the list.
    if (queryAtStart !== imageQuery.value) {
      return
    }

    extraPages.value = [...extraPages.value, ...page]
    if (page.length < PAGE_SIZE) {
      reachedEnd.value = true
    }
  } catch (error) {
    loadMoreError.value = error instanceof Error ? error.message : 'Unable to load more images.'
  } finally {
    loadingMore.value = false
  }
}

const cameraItems = computed<SelectItem[]>(() => [
  allCameraItem,
  ...(cameras.value ?? []).map(cam => ({
    label: cam.siteName,
    value: String(cam.uid)
  }))
])

const siteNameFor = (image: CameraImage) =>
  image.siteName
  || cameras.value?.find(cam => cam.cameraId === image.cameraId)?.siteName
  || 'Unknown site'

const isInitialPending = computed(() =>
  (camerasStatus.value === 'pending' && !cameras.value)
  || (imagesStatus.value === 'pending' && !firstPage.value)
)

const hasBlockingError = computed(() =>
  (camerasError.value && !cameras.value)
  || (imagesError.value && !firstPage.value)
)

const resultsLabel = computed(() => hasMore.value ? `${images.value.length}+` : String(images.value.length))

const onResetFilters = () => {
  searchTerm.value = ''
  debouncedSearchTerm.value = ''
  cameraItem.value = allCameraItem
  periodItem.value = allPeriodItem
  startDate.value = ''
  endDate.value = ''
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
              Browse all-sky captures by camera, sky period, date, and search terms.
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div class="astro-panel-strong p-4 text-center">
              <div class="text-2xl font-black tabular-nums text-sky-200">
                {{ resultsLabel }}
              </div>
              <div class="mt-1 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                Results
              </div>
            </div>
            <div class="astro-panel-strong p-4 text-center">
              <div class="text-2xl font-black tabular-nums text-emerald-200">
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
        title="The archive could not be loaded."
        :description="camerasError?.message || imagesError?.message || 'Please try again in a moment.'"
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
          v-model:start-date="startDate"
          v-model:end-date="endDate"
          :period-items="periodItems"
          :camera-items="cameraItems"
          @reset="onResetFilters"
        />
      </aside>

      <main class="min-w-0 flex-1">
        <div
          v-if="isRefreshing"
          class="astro-panel mb-4 flex items-center gap-2 px-4 py-3 text-sm text-slate-300"
          role="status"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin"
          />
          <span>Updating results</span>
        </div>

        <template v-if="images.length">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <GalleryCard
              v-for="image in images"
              :key="image.imgId"
              :image="image"
              :site="siteNameFor(image)"
            />
          </div>

          <div class="mt-8 flex flex-col items-center gap-3">
            <UAlert
              v-if="loadMoreError"
              class="w-full max-w-xl"
              color="error"
              variant="subtle"
              title="Could not load more images."
              :description="loadMoreError"
            />
            <UButton
              v-if="hasMore"
              size="lg"
              color="neutral"
              variant="subtle"
              icon="i-lucide-chevrons-down"
              :loading="loadingMore"
              @click="loadMore"
            >
              Load more
            </UButton>
            <p
              v-else
              class="text-xs text-slate-500"
            >
              Showing all {{ images.length }} matching images.
            </p>
          </div>
        </template>

        <UAlert
          v-else
          class="astro-panel p-2"
          color="neutral"
          variant="subtle"
          title="No images match the current filters."
          description="Try a different camera, period, date range, or search term."
        />
      </main>
    </div>
  </div>
</template>
