<script setup lang="ts">

import GalleryCard from '~/components/galleryCard.vue';

const periodItems = ref(['Night', 'Day', 'Dawn', 'Dust'])
const cameraItems = ref(['White Mountain OVL'])

</script>

<template>
    <div class="p-16">
        <h1 class="antialiased text-4xl mb-3">All Sky Camera Gallery</h1>
        <h3 class="text-current/75">Brose night-sky captures</h3>
    </div>

    <div class="p-16 flex gap-6">
            <aside class="lg:block w-72 shrink-0">
                <UCard class="sticky top-20">
                    <div class="text-lg items-start font-semibold mb-3">Filters</div>
                    <UForm>
                        <UInput placeholder="cameras, locations, time" color="neutral" class="w-full mb-4" />
                        <div class="flex-col items-center mb-4">
                            <h6 color="secondary" class="text-sm">Period</h6>
                            <USelectMenu class="min-w-36 w-full" :items="periodItems" />
                        </div>
                        <div class="flex-col items-center mb-4">
                            <h6 color="secondary" class="text-sm">Camera</h6>
                            <USelectMenu class="min-w-36 w-full" :items="cameraItems" />
                        </div>
                        <div class="flex items-center ">
                            <UButton class="ml-auto">Reset Filters</UButton>
                        </div>
                    </UForm>
                </UCard>
            </aside>

            <main class="flex-1">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3  gap-4">
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                        <GalleryCard img-url="/img1.jpg" camera="White Mountain OVL"/>
                    </div>
            </main>
    </div>
</template>