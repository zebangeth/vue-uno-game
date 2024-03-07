<template>
  <div>
    <b-button class="mx-2 my-2" size="sm" @click="socket.emit('new-game')">New Game</b-button>
    <b-badge class="mr-2 mb-2" :variant="myTurn ? 'primary' : 'secondary'">turn: {{ currentTurnPlayerIndex }}</b-badge>
    <b-badge class="mr-2 mb-2">{{ phase }}</b-badge>
    <div v-for="card in cards" :key="card.id">
      <AnimatedCard :card="card" :last-played-card="lastPlayedCard" @play-card="playCard" />
    </div>
    <b-button class="mx-2 my-2" size="sm" @click="drawCard" :disabled="!myTurn">Draw Card</b-button>

    <div>
      <h3>Player Status:</h3>
      <ul>
        <li v-for="(status, index) in playerStatus" :key="index">
          {{ status.name }}: {{ status.isLow ? '2 or fewer cards' : 'more than 2 cards' }}
        </li>
      </ul>
    </div>

    <b-button class="mx-2 my-2" size="sm" @click="showConfigModal = true">Configure</b-button>

    <b-modal :modelValue="showConfigModal" @update:modelValue="showConfigModal = $event" title="Game Configuration" @shown="getConfig">
      <b-overlay :show="configLoading" rounded="sm">
        <b-form @submit.prevent="updateConfig">
          <b-form-group label="Number of Decks:" label-for="decks-input">
            <b-form-input id="decks-input" v-model.number="newConfig.numberOfDecks" type="number" required></b-form-input>
          </b-form-group>
          <b-form-group label="Rank Limit:" label-for="rank-input">
            <b-form-input id="rank-input" v-model.number="newConfig.rankLimit" type="number" required></b-form-input>
          </b-form-group>
          <b-button type="submit" variant="primary">Save</b-button>
        </b-form>
      </b-overlay>
    </b-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, Ref } from 'vue'
import { io } from "socket.io-client"
import { Card, GamePhase, Action, formatCard, CardId, getLastPlayedCard, Config } from "../../../server/model"
import AnimatedCard from '../components/AnimatedCard.vue'

// props
interface Props {
  playerIndex?: string
}

// default values for props
const props = withDefaults(defineProps<Props>(), {
  playerIndex: "all",
})

const socket = io()
console.log("Socket initialized:", socket)
let x = props.playerIndex
let playerIndex: number | "all" = parseInt(x) >= 0 ? parseInt(x) : "all"
console.log("playerIndex", JSON.stringify(playerIndex))
socket.emit("player-index", playerIndex)

const cards: Ref<Card[]> = ref([])
const currentTurnPlayerIndex = ref(-1)
const phase = ref("")
const playCount = ref(-1)
const playerStatus = ref<{ name: string; isLow: boolean }[]>([])

const myTurn = computed(() => currentTurnPlayerIndex.value === playerIndex && phase.value !== "game-over")
const lastPlayedCard = computed(() => getLastPlayedCard(cards.value))

const showConfigModal = ref(false)
const configLoading = ref(false)
const newConfig = ref<Config>({
  numberOfDecks: 2,
  rankLimit: 2
})

socket.on("all-cards", (allCards: Card[]) => {
  console.log("Received all-cards event with allCards:", allCards)
  cards.value = allCards
})

socket.on("updated-cards", (updatedCards: Card[]) => {
  console.log("Received updated-cards event with updatedCards:", updatedCards)
  applyUpdatedCards(updatedCards)
})

socket.on("game-state", (newCurrentTurnPlayerIndex: number, newPhase: GamePhase, newPlayCount: number, newPlayerStatus: { name: string; isLow: boolean }[]) => {
  console.log("Received game-state event with newCurrentTurnPlayerIndex:", newCurrentTurnPlayerIndex)
  console.log("Received game-state event with newPhase:", newPhase)
  console.log("Received game-state event with newPlayCount:", newPlayCount)
  console.log("Received game-state event with newPlayerStatus:", newPlayerStatus)
  currentTurnPlayerIndex.value = newCurrentTurnPlayerIndex
  phase.value = newPhase
  playCount.value = newPlayCount
  playerStatus.value = newPlayerStatus
})

function doAction(action: Action) {
  return new Promise<Card[]>((resolve, reject) => {
    socket.emit("action", action)
    socket.once("updated-cards", (updatedCards: Card[]) => {
      resolve(updatedCards)
    })
  })
}

async function drawCard() {
  if (typeof playerIndex === "number") {
    const updatedCards = await doAction({ action: "draw-card", playerIndex })
    if (updatedCards.length === 0) {
      alert("didn't work")
    }
  }
}

async function playCard(cardId: CardId) {
  if (typeof playerIndex === "number") {
    const updatedCards = await doAction({ action: "play-card", playerIndex, cardId })
    if (updatedCards.length === 0) {
      alert("didn't work")
    }
  }
}

async function applyUpdatedCards(updatedCards: Card[]) {
  for (const x of updatedCards) {
    const existingCard = cards.value.find(y => x.id === y.id)
    if (existingCard) {
      Object.assign(existingCard, x)
    } else {
      cards.value.push(x)
    }
  }
}

function getConfig() {
  configLoading.value = true
  console.log("Emitting get-config event")
  socket.emit("get-config")
  socket.once("get-config-reply", (config: Config) => {
    console.log("Received get-config-reply event with config:", config)
    newConfig.value = config
    configLoading.value = false
  })
}

async function updateConfig() {
  console.log("updateConfig function called")
  configLoading.value = true
  newConfig.value.numberOfDecks = Number(newConfig.value.numberOfDecks)
  newConfig.value.rankLimit = Number(newConfig.value.rankLimit)
  if (Number.isNaN(newConfig.value.numberOfDecks) ||
    Number.isNaN(newConfig.value.numberOfDecks)) {
    console.log("Invalid input, both inputs must be number")
    }
  console.log("Emitting update-config event with newConfig:", newConfig.value)

  socket.emit("update-config", newConfig.value)
  console.log("type of numOfDecks", typeof(newConfig.value.numberOfDecks))
  console.log("type of rankLimit", typeof(newConfig.value.rankLimit))
  const [success] = await Promise.all([
    new Promise<boolean>(resolve => {
      socket.once("update-config-reply", (success: boolean) => {
        console.log("Received update-config-reply event with success:", success)
        resolve(success)
      })
    }),
    new Promise(resolve => setTimeout(resolve, 2000)) // Timeout after 2 seconds
  ])
  if (success) {
    showConfigModal.value = false
  }
  configLoading.value = false
}
</script>