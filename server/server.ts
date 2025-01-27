import http from "http"
import { Server } from "socket.io"
import { Action, createEmptyGame, doAction, filterCardsForPlayerPerspective, Card, computePlayerCardCounts, Config } from "./model"

const server = http.createServer()
const io = new Server(server)
const port = 8101

let gameConfig: Config = {
  numberOfDecks: 2,
  rankLimit: 2
}

let gameState = createEmptyGame(["player1", "player2"], gameConfig.numberOfDecks, gameConfig.rankLimit)

function emitUpdatedCardsForPlayers(cards: Card[], newGame = false) {
  gameState.playerNames.forEach((_, i) => {
    let updatedCardsFromPlayerPerspective = filterCardsForPlayerPerspective(cards, i)
    if (newGame) {
      updatedCardsFromPlayerPerspective = updatedCardsFromPlayerPerspective.filter(card => card.locationType !== "unused")
    }
    console.log("emitting update for player", i, ":", updatedCardsFromPlayerPerspective)
    io.to(String(i)).emit(
      newGame ? "all-cards" : "updated-cards",
      updatedCardsFromPlayerPerspective,
    )
  })
}

io.on('connection', client => {
  function emitGameState() {
    client.emit(
      "game-state",
      gameState.currentTurnPlayerIndex,
      gameState.phase,
      gameState.playCount,
      gameState.playerNames.map((name, index) => ({
        name,
        isLow: computePlayerCardCounts(gameState)[index] <= 2
      }))
    )
  }

  console.log("New client")
  let playerIndex: number | null | "all" = null
  client.on('player-index', n => {
    playerIndex = n
    console.log("playerIndex set", n)
    client.join(String(n))
    if (typeof playerIndex === "number") {
      client.emit(
        "all-cards",
        filterCardsForPlayerPerspective(Object.values(gameState.cardsById), playerIndex).filter(card => card.locationType !== "unused"),
      )
    } else {
      client.emit(
        "all-cards",
        Object.values(gameState.cardsById),
      )
    }
    emitGameState()
  })

  client.on("action", (action: Action) => {
    if (typeof playerIndex === "number") {
      const updatedCards = doAction(gameState, { ...action, playerIndex })
      emitUpdatedCardsForPlayers(updatedCards)
    } else {
      // no actions allowed from "all"
    }
    io.to("all").emit(
      "updated-cards",
      Object.values(gameState.cardsById),
    )
    io.emit(
      "game-state",
      gameState.currentTurnPlayerIndex,
      gameState.phase,
      gameState.playCount,
      gameState.playerNames.map((name, index) => ({
        name,
        isLow: computePlayerCardCounts(gameState)[index] <= 2
      }))
    )
  })

  client.on("new-game", () => {
    gameState = createEmptyGame(gameState.playerNames, gameConfig.numberOfDecks, gameConfig.rankLimit)
    const updatedCards = Object.values(gameState.cardsById)
    emitUpdatedCardsForPlayers(updatedCards, true)
    io.to("all").emit(
      "all-cards",
      updatedCards,
    )
		io.emit(
      "game-state",
      gameState.currentTurnPlayerIndex,
      gameState.phase,
      gameState.playCount,
		)
  })

  client.on("get-config", () => {
    client.emit("get-config-reply", gameConfig)
  })

  client.on("update-config", (newConfig: Config) => {
		console.log("Received update-config event with newConfig:", newConfig)
		// const numberOfDecks = Number(newConfig.numberOfDecks)
		// const rankLimit = Number(newConfig.rankLimit)
    if (
      // !Number.isNaN(numberOfDecks) &&
      // !Number.isNaN(rankLimit) &&
			typeof newConfig.numberOfDecks === "number" &&
			typeof newConfig.rankLimit === "number" &&
      newConfig.numberOfDecks > 0 &&
      newConfig.rankLimit <= 13 &&
      Object.keys(newConfig).length === 2
    ) {
			console.log("Valid newConfig, updating")
      setTimeout(() => {
        gameConfig = newConfig
        gameState = createEmptyGame(gameState.playerNames, gameConfig.numberOfDecks, gameConfig.rankLimit)
        const updatedCards = Object.values(gameState.cardsById)
        emitUpdatedCardsForPlayers(updatedCards, true)
        io.to("all").emit("all-cards", updatedCards)
        emitGameState()
				console.log("Sending update-config-reply event with success:", true)
        client.emit("update-config-reply", true)
      }, 2000)
    } else {
			console.log("Invalid newConfig, not updating")
      client.emit("update-config-reply", false)
    }
  })
})
server.listen(port)
console.log(`Game server listening on port ${port}`)