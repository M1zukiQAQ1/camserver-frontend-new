<script setup lang="ts">
import type { SkyOverlayData, Streak } from '~/type/sky'

// Drawn in the image's own pixel coordinates; the SVG is stretched over the picture.
const props = defineProps<{
  width: number
  height: number
  overlay?: SkyOverlayData | null
  streaks?: Streak[]
}>()

const unit = computed(() => Math.max(props.width, props.height) / 100)
const points = (line: [number, number][]) => line.map(([x, y]) => `${x},${y}`).join(' ')
</script>

<template>
  <svg
    class="sky-overlay pointer-events-none absolute inset-0 h-full w-full"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <template v-if="overlay">
      <g
        v-for="constellation in overlay.constellations"
        :key="constellation.id"
      >
        <polyline
          v-for="(line, index) in constellation.lines"
          :key="index"
          class="sky-line"
          :points="points(line)"
        />
        <text
          v-if="constellation.label"
          class="sky-constellation"
          :x="constellation.label[0]"
          :y="constellation.label[1]"
          :font-size="unit * 1.25"
          text-anchor="middle"
        >{{ constellation.name }}</text>
      </g>

      <text
        v-for="star in overlay.stars"
        :key="star.name"
        class="sky-star"
        :x="star.x + unit * 0.7"
        :y="star.y - unit * 0.5"
        :font-size="unit * 1.05"
      >{{ star.name }}</text>

      <g
        v-for="body in overlay.bodies"
        :key="body.name"
      >
        <circle
          class="sky-body"
          :cx="body.x"
          :cy="body.y"
          :r="unit * 0.9"
        />
        <text
          class="sky-body-label"
          :x="body.x + unit * 1.2"
          :y="body.y + unit * 0.4"
          :font-size="unit * 1.25"
        >{{ body.name }}</text>
      </g>
    </template>

    <g
      v-for="(streak, index) in streaks ?? []"
      :key="`streak-${index}`"
    >
      <line
        class="sky-streak"
        :x1="streak.x1"
        :y1="streak.y1"
        :x2="streak.x2"
        :y2="streak.y2"
        :stroke-width="streak.widthPx + unit * 1.2"
      />
    </g>
  </svg>
</template>

<style scoped>
.sky-line {
  fill: none;
  stroke: rgb(125 211 252 / 0.55);
  stroke-width: 1.2px;
  vector-effect: non-scaling-stroke;
}

.sky-constellation {
  fill: rgb(125 211 252 / 0.7);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sky-star {
  fill: rgb(226 232 240 / 0.85);
}

.sky-body {
  fill: none;
  stroke: rgb(252 211 77);
  stroke-width: 1.5px;
  vector-effect: non-scaling-stroke;
}

.sky-body-label {
  fill: rgb(252 211 77);
  font-weight: 700;
}

/* A wide translucent band around the trail, so the trail itself stays visible. */
.sky-streak {
  stroke: rgb(244 114 182 / 0.35);
  stroke-linecap: round;
}

text {
  paint-order: stroke;
  stroke: rgb(2 6 23 / 0.8);
  stroke-width: 3px;
  vector-effect: non-scaling-stroke;
}
</style>
