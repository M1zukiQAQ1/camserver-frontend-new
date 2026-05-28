<script setup lang="ts">
// const props = defineProps({
//     resUrl: String
// })
// const data = await useLazyFetch('/api/hello')

import type { CameraImage } from '~/type/cameraImage'
import { getImagePeriod } from '~/utils/getImagePeriod'

const props = defineProps<{
  image: CameraImage
  site: string
}>()

const config = useRuntimeConfig()
const apiBase = String(config.public.apiBase || 'http://localhost:443')
const filePath = `${apiBase}/api/images/${props.image.imgPath.split('/').pop()}.jpg`
const dateString = `${new Date(props.image.timestamp).toLocaleDateString()} ${new Date(props.image.timestamp).toLocaleTimeString()}`
const period = getImagePeriod(props.image.timestamp)
</script>

<template>
  <NuxtLink
    :to="`/gallery/${image.imgId}`"
    class="group block w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950/70 text-current no-underline shadow-[0_18px_48px_rgb(0_0_0_/_0.28)] transition duration-200 hover:-translate-y-1 hover:border-sky-300/40 hover:shadow-[0_24px_70px_rgb(0_0_0_/_0.38)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
  >
    <div class="relative overflow-hidden bg-black">
      <img
        :src="filePath"
        :alt="`${site} ${period} all-sky capture`"
        class="aspect-[4/3] w-full object-cover saturate-125 transition duration-300 group-hover:scale-[1.035]"
      >
      <div class="absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-[0.68rem] font-black uppercase tracking-wider text-emerald-200 backdrop-blur">
        {{ period }}
      </div>
    </div>
    <div class="grid gap-3 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-base font-extrabold text-white">
            {{ site }}
          </h3>
          <p class="mt-1 text-xs text-slate-400">
            {{ dateString }}
          </p>
        </div>
        <UIcon
          name="i-lucide-arrow-up-right"
          class="mt-1 size-4 shrink-0 text-sky-200 opacity-70 transition group-hover:opacity-100"
        />
      </div>
      <div class="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
        <span class="font-semibold uppercase tracking-wider text-slate-500">Image ID</span>
        <span class="font-mono text-slate-300">{{ image.imgId }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
