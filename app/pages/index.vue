<script setup>
const items = [
  "https://camserver.physics.ucsb.edu/api/images/QHY5III678C-57bbd14782e9f938e_2026-03-01T01:28:37.869.jpg",
  "https://camserver.physics.ucsb.edu/api/images/QHY5III678C-57bbd14782e9f938e_2026-03-01T04:18:56.485.jpg",
  "https://camserver.physics.ucsb.edu/api/images/QHY5III678C-57bbd14782e9f938e_2026-03-01T04:59:20.787.jpg",
  "https://camserver.physics.ucsb.edu/api/images/QHY5III678C-57bbd14782e9f938e_2026-03-01T05:15:46.445.jpg"
]

</script>

<template>
  <div>
    <UPageHero
      title="All Sky Camera"
      description="Live access to All-Sky imagery, seeing conditions, and star-tracker updates."
    />
    <UContainer class="pb-16"> 
      <h2 class="text-2xl font-semibold pb-5">Featured</h2>
      <UCarousel
        loop
        arrows
        dots
        v-slot="{ item }"
        auto-scroll
        :items="items"
        :ui=" {item: 'basis-1/3' } "
      >
        <img :src="item" class="rounded-lg object-cover"/>
      </UCarousel>
      <div class="flex text-right">
         <UButton trailing-icon="i-lucide-arrow-right" size="lg" color="primary" class="mt-7 ml-auto" to="/gallery">Visit Gallery</UButton>
      </div>
     
    </UContainer>
  </div>
</template>