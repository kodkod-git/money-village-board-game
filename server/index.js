import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import qrcode from 'qrcode'
import { createRoom, getRoom, addPlayer, removePlayer, updatePlayerState, updateRoomPrices } from './rooms.js'
import { saveGameResult, getGameResult } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
const PORT = process.env.PORT || 3001

app.use(express.json())

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

// Health check — must be before /:code route
app.get('/api/rooms/health', (_req, res) => res.json({ ok: true }))

app.post('/api/rooms', (_req, res) => {
  const room = createRoom()
  res.json({ code: room.code })
})

app.get('/api/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({ code: room.code, playerCount: room.players.length, players: room.players, prices: room.prices })
})

app.get('/api/rooms/:code/qr', async (req, res) => {
  const code = req.params.code.toUpperCase()
  const url = `${req.protocol}://${req.get('host')}/join?code=${code}`
  const png = await qrcode.toBuffer(url)
  res.set('Content-Type', 'image/png').send(png)
})

app.post('/api/rooms/:code/submit', async (req, res) => {
  const room = getRoom(req.params.code.toUpperCase())
  if (!room) return res.status(404).json({ error: 'Room not found' })

  if (!room.players.every(p => p.gameState?.isCompleted)) {
    return res.status(400).json({ error: 'Not all players have completed' })
  }

  try {
    const sessionId = await saveGameResult(room)
    io.to(req.params.code.toUpperCase()).emit('game-submitted', { sessionId })
    res.json({ sessionId })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Results already submitted for this room' })
    }
    console.error('submit error:', err)
    res.status(500).json({ error: 'Failed to save results' })
  }
})

app.get('/api/results/:sessionId', async (req, res) => {
  try {
    const { session, results } = await getGameResult(req.params.sessionId)
    res.json({
      teamCode: session.team_code,
      createdAt: session.created_at,
      stockPrices: session.stock_prices,
      realEstatePrices: session.real_estate_prices,
      players: results.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        character: r.character,
        job: r.job,
        cash: r.cash,
        stockHoldings: r.stock_holdings,
        realEstateHoldings: r.real_estate_holdings,
        badges: r.badges,
        totalAssets: Number(r.total_assets),
      })),
    })
  } catch (err) {
    console.error('results error:', err)
    res.status(404).json({ error: 'Result not found' })
  }
})

if (process.env.NODE_ENV === 'production') {
  app.use((_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ code, name, character, isHost, playerUuid }, callback) => {
    try {
      const room = addPlayer(code.toUpperCase(), {
        socketId: socket.id, name, character, isHost: !!isHost, playerUuid,
      })
      socket.join(code.toUpperCase())
      io.to(code.toUpperCase()).emit('room-updated', { players: room.players })
      callback?.({ ok: true })
    } catch (err) {
      callback?.({ ok: false, error: err.message })
    }
  })

  socket.on('character-preview', ({ code, character }) => {
    socket.to(code.toUpperCase()).emit('character-locked', { character, socketId: socket.id })
  })

  socket.on('update-player-state', ({ code, gameState }) => {
    const room = updatePlayerState(socket.id, gameState)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })

  socket.on('update-room-prices', ({ code, prices }) => {
    const room = updateRoomPrices(socket.id, prices)
    if (room) io.to(room.code).emit('room-prices-updated', { prices: room.prices })
  })

  socket.on('leave-room', () => {
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })

  socket.on('disconnect', () => {
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })
})

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
