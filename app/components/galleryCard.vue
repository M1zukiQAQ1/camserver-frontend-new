<script setup lang="ts">
// const props = defineProps({
//     resUrl: String
// })
// const data = await useLazyFetch('/api/hello')

import type { CameraImage } from '~/type/cameraImage';

const props = defineProps<{
    image: CameraImage
    site: string
}>()

const filePath = `http://localhost:443/api/images/${props.image.imgPath.split('/').pop()}.jpg`
const dateString = props.image.timestamp.toLocaleString()

</script>

<template>
    <div class="flex-col w-full overflow-hidden rounded-lg border border-black/20">
        <img :src="filePath" class="object-cover h-auto w-full"/>
        <div class="p-3">
            <h6 class="text-xs text-gray-700">{{ site }}</h6>
            <h6 class="text-base">Night Time</h6>
            <h6 class="text-xs">{{ dateString }}</h6>
        </div>
    </div>

</template>