<script setup lang="ts">
type SelectItem = {
  label: string
  value: string
}

defineOptions({
  name: 'GalleryFilter'
})

defineProps<{
  periodItems: SelectItem[]
  cameraItems: SelectItem[]
}>()

const search = defineModel<string>('search', { required: true })
const period = defineModel<SelectItem>('period', { required: true })
const camera = defineModel<SelectItem>('camera', { required: true })
const startDate = defineModel<string>('startDate', { required: true })
const endDate = defineModel<string>('endDate', { required: true })

const emit = defineEmits<{
  reset: []
}>()

const hasActiveFilters = computed(() =>
  Boolean(search.value.trim())
  || Boolean(startDate.value)
  || Boolean(endDate.value)
  || period.value.value !== 'all'
  || camera.value.value !== 'all'
)

const labelClass = 'text-xs font-bold uppercase tracking-wider text-slate-400'
</script>

<template>
  <UCard
    class="astro-panel lg:sticky lg:top-24"
    :ui="{ body: 'p-4 sm:p-4' }"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <p class="astro-eyebrow">
          Query
        </p>
        <h2 class="mt-1 text-lg font-black text-white">
          Filters
        </h2>
      </div>
      <UIcon
        name="i-lucide-sliders-horizontal"
        class="size-5 text-sky-200"
      />
    </div>

    <div class="grid gap-4">
      <UFormField
        label="Search"
        name="search"
        :ui="{ label: labelClass }"
      >
        <UInput
          v-model="search"
          placeholder="Camera, site, time zone"
          icon="i-lucide-search"
          color="neutral"
          class="w-full"
          :ui="{ trailing: 'pe-1' }"
        >
          <template
            v-if="search"
            #trailing
          >
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              icon="i-lucide-circle-x"
              aria-label="Clear search"
              @click="search = ''"
            />
          </template>
        </UInput>
      </UFormField>

      <UFormField
        label="Period"
        name="period"
        :ui="{ label: labelClass }"
      >
        <USelectMenu
          v-model="period"
          icon="i-lucide-moon-star"
          class="w-full"
          :items="periodItems"
        />
      </UFormField>

      <UFormField
        label="Camera"
        name="camera"
        :ui="{ label: labelClass }"
      >
        <USelectMenu
          v-model="camera"
          icon="i-lucide-camera"
          class="w-full"
          :items="cameraItems"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField
          label="From"
          name="startDate"
          :ui="{ label: labelClass }"
        >
          <UInput
            v-model="startDate"
            type="date"
            color="neutral"
            class="w-full"
            :max="endDate || undefined"
          />
        </UFormField>
        <UFormField
          label="To"
          name="endDate"
          :ui="{ label: labelClass }"
        >
          <UInput
            v-model="endDate"
            type="date"
            color="neutral"
            class="w-full"
            :min="startDate || undefined"
          />
        </UFormField>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <span class="text-xs text-slate-500">
          {{ hasActiveFilters ? 'Filters active' : 'Showing everything' }}
        </span>
        <UButton
          type="button"
          color="neutral"
          variant="subtle"
          icon="i-lucide-rotate-ccw"
          :disabled="!hasActiveFilters"
          @click="emit('reset')"
        >
          Reset
        </UButton>
      </div>
    </div>
  </UCard>
</template>
