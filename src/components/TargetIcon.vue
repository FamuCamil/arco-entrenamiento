<script setup lang="ts">
import type { TargetIcon } from '@/domain/types'

defineProps<{
  icon: TargetIcon
}>()

// Icon colors from the brief's target-icon geometry (not the keypad zone colors).
const WHITE = '#FFFFFF'
const BLACK = '#000000'
const BLUE = '#00B4E4'
const RED = '#F65058'
const YELLOW = '#FFE552'
// Outer outline, visible on both the light and the dark surface.
const OUTLINE = '#6b7280'

// Simplified 3D face: earth/green tones, deliberately outside the WA palette.
const ZONE_5 = '#4d7c0f'
const ZONE_8 = '#a16207'
const ZONE_10 = '#d97706'
const ZONE_11 = '#fef3c7'

/** Centres of the three spots of a triple face, 22 units apart. */
const TRIPLE_OFFSETS = [-22, 0, 22]
</script>

<template>
  <svg
    v-if="icon === 'wa-full'"
    class="target-icon"
    data-icon="wa-full"
    viewBox="-70 -70 140 140"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      data-ring="white"
      r="60.9"
      :fill="WHITE"
      :stroke="OUTLINE"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <circle data-ring="black" r="48.7" :fill="BLACK" />
    <circle data-ring="blue" r="36.5" :fill="BLUE" />
    <circle data-ring="red" r="24.3" :fill="RED" />
    <circle data-ring="yellow" r="12.1" :fill="YELLOW" />
    <g fill="none" stroke-width="0.5">
      <circle data-line r="54.85" :stroke="BLACK" vector-effect="non-scaling-stroke" />
      <circle data-line r="42.65" :stroke="WHITE" vector-effect="non-scaling-stroke" />
      <circle data-line r="30.45" :stroke="BLACK" vector-effect="non-scaling-stroke" />
      <circle data-line r="18.25" :stroke="BLACK" vector-effect="non-scaling-stroke" />
      <circle data-line r="6.05" :stroke="BLACK" vector-effect="non-scaling-stroke" />
      <circle data-line r="3.045" :stroke="BLACK" vector-effect="non-scaling-stroke" />
    </g>
  </svg>

  <svg
    v-else-if="icon === 'wa-reduced'"
    class="target-icon"
    data-icon="wa-reduced"
    viewBox="-40 -40 80 80"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      data-ring="blue"
      r="36.5"
      :fill="BLUE"
      :stroke="OUTLINE"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <circle data-ring="red" r="24.3" :fill="RED" />
    <circle data-ring="yellow" r="12.1" :fill="YELLOW" />
    <g fill="none" :stroke="BLACK" stroke-width="0.5">
      <circle data-line r="30.45" vector-effect="non-scaling-stroke" />
      <circle data-line r="18.25" vector-effect="non-scaling-stroke" />
      <circle data-line r="6.05" vector-effect="non-scaling-stroke" />
      <circle data-line r="3.045" vector-effect="non-scaling-stroke" />
    </g>
  </svg>

  <svg
    v-else-if="icon === 'wa-triple-vertical' || icon === 'wa-triple-horizontal'"
    class="target-icon"
    :data-icon="icon"
    viewBox="-34 -34 68 68"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    <g
      v-for="offset in TRIPLE_OFFSETS"
      :key="offset"
      data-spot
      :transform="
        icon === 'wa-triple-vertical' ? `translate(0 ${offset})` : `translate(${offset} 0)`
      "
    >
      <circle
        data-ring="blue"
        r="9.9"
        :fill="BLUE"
        :stroke="OUTLINE"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
      <circle data-ring="red" r="7.9" :fill="RED" />
      <circle data-ring="yellow" r="3.9" :fill="YELLOW" />
    </g>
  </svg>

  <svg
    v-else-if="icon === 'wa-field'"
    class="target-icon"
    data-icon="wa-field"
    viewBox="-70 -70 140 140"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      data-ring="black"
      r="60"
      :fill="BLACK"
      :stroke="OUTLINE"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <g fill="none" :stroke="WHITE" stroke-width="0.5">
      <circle data-line r="48" vector-effect="non-scaling-stroke" />
      <circle data-line r="36" vector-effect="non-scaling-stroke" />
    </g>
    <circle data-ring="yellow" r="24" :fill="YELLOW" />
    <g fill="none" :stroke="BLACK" stroke-width="0.5">
      <circle data-line r="12" vector-effect="non-scaling-stroke" />
      <circle data-line r="6" vector-effect="non-scaling-stroke" />
    </g>
  </svg>

  <svg
    v-else
    class="target-icon"
    data-icon="3d"
    viewBox="-40 -40 80 80"
    width="100%"
    height="100%"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      data-zone="5"
      r="36"
      :fill="ZONE_5"
      :stroke="OUTLINE"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <circle data-zone="8" r="24" :fill="ZONE_8" />
    <circle data-zone="10" r="12" :fill="ZONE_10" />
    <circle data-zone="11" r="5" :fill="ZONE_11" />
  </svg>
</template>
