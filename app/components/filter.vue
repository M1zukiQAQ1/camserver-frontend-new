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

const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <UCard
    class="astro-panel sticky top-24"
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
    <UForm class="grid gap-4">
      <UInput
        v-model="search"
        placeholder="cameras, locations, time"
        icon="i-lucide-search"
        color="neutral"
        class="w-full"
      />
      <div class="grid gap-2">
        <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Period
        </label>
        <USelectMenu
          v-model="period"
          icon="i-lucide-moon-star"
          class="w-full"
          :items="periodItems"
        />
      </div>
      <div class="grid gap-2">
        <label class="text-xs font-bold uppercase tracking-wider text-slate-400">
          Camera
        </label>
        <USelectMenu
          v-model="camera"
          icon="i-lucide-camera"
          class="w-full"
          :items="cameraItems"
        />
      </div>
      <div class="flex items-center border-t border-white/10 pt-4">
        <UButton
          type="button"
          class="ml-auto"
          color="neutral"
          variant="subtle"
          icon="i-lucide-rotate-ccw"
          @click="emit('reset')"
        >
          Reset
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
