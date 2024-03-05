<template>
  <div
    class="card"
    :class="{
      'last-played': card.locationType === 'last-card-played',
      'player-card': card.locationType === 'player-hand',
      'not-legal': !isLegal
    }"
    @click="$emit('play-card', card.id)"
  >
    <div class="card-content">
      <span class="card-rank">{{ card.rank }}</span>
      <span class="card-suit">{{ card.suit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue'
import { Card, areCompatible, getLastPlayedCard } from '../../../server/model'

const props = defineProps<{
  card: Card
  lastPlayedCard: Card | null
}>()

const emit = defineEmits<{
  (event: 'play-card', cardId: string): void
}>()

const isLegal = computed(() => {
  if (props.card.locationType === 'unused') {
    return false
  }
  if (props.lastPlayedCard === null) {
    return true
  }
  return areCompatible(props.card, props.lastPlayedCard)
})
</script>

<style scoped>
.card {
  background-color: white;
  border: 1px solid black;
  border-radius: 5px;
  padding: 10px;
  margin: 5px;
  cursor: pointer;
}

.last-played {
  background-color: lightblue;
}

.player-card {
  background-color: lightgreen;
}

.not-legal {
  opacity: 0.25;
  cursor: not-allowed;
}

.card-content {
  display: flex;
  justify-content: space-between;
}
</style>