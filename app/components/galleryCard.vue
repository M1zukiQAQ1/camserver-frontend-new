<script setup lang="ts">
// const props = defineProps({
//     resUrl: String
// })
// const data = await useLazyFetch('/api/hello')

const props = defineProps({
    imgUrl: String,
    camera: String,
    takenTime: String,
    takenDate: String,
})

</script>

<template>
    <div class="flex-col w-full overflow-hidden rounded-lg border border-black/20">
        <img :src="imgUrl" class="object-cover h-auto w-full"/>
        <div class="p-3">
            <h6 class="text-xs text-gray-700">{{ camera }}</h6>
            <h6 class="text-base">Night Time</h6>
            <h6 class="text-xs">{{ takenTime }}</h6>
        </div>
    </div>

</template>