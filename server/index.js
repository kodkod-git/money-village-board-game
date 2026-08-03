import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import path from 'path'
import qrcode from 'qrcode'
import { createRoom, getRoom, addPlayer, removePlayer, markDisconnected, updatePlayerState, updateRoomPrices, kickPlayer, listAllRooms, updatePlayerStateByUuid, computeLiveRoomStatus, deleteRoomByCode, deleteRoomsByClassId, sortRoomsByRecency } from './rooms.js'
import { saveGameResult, getGameResult, getAllRankings, getBoothRankings, getAllCompletedTeams, updateGameResult, deleteCompletedTeam, deleteCompletedTeamsByClassId } from './db.js'
import { createAdmin, verifyAdminPassword, seedMasterAdmin } from './admins.js'
import { signAdminToken, requireAdmin } from './adminAuth.js'
import { createClass, listClassesForAdmin, hasClassAccess, updateClassName, deleteClass } from './classes.js'

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

app.post('/api/rooms', (req, res) => {
  const room = createRoom({ classId: req.body?.classId ?? null })
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
    deleteRoomByCode(req.params.code.toUpperCase())
    io.to(req.params.code.toUpperCase()).emit('game-submitted', { sessionId })
    res.json({ sessionId })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Results already submitted for this room' })
    }
    console.error('submit error:', err)
    res.status(500).json({ error: 'Failed to save results', detail: err?.message, code: err?.code })
  }
})

app.get('/api/rankings', async (req, res) => {
  try {
    const { affiliation, category } = req.query
    const rankings = category
      ? await getBoothRankings(category)
      : await getAllRankings(affiliation ?? null)
    res.json(rankings)
  } catch (err) {
    console.error('rankings error:', err)
    res.status(500).json({ error: 'Failed to fetch rankings' })
  }
})

app.post('/api/admin/signup', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' })
  }
  try {
    const admin = await createAdmin(username.trim(), password)
    const token = signAdminToken(admin)
    res.json({ token, username: admin.username, isSuper: admin.isSuper })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 존재하는 아이디입니다' })
    console.error('admin signup error:', err)
    res.status(500).json({ error: 'Failed to create admin' })
  }
})

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'username과 password가 필요합니다' })
  }
  const admin = await verifyAdminPassword(username.trim(), password)
  if (!admin) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' })
  const token = signAdminToken(admin)
  res.json({ token, username: admin.username, isSuper: admin.isSuper })
})

app.get('/api/admin/classes', requireAdmin, async (req, res) => {
  try {
    const classes = await listClassesForAdmin(req.admin)
    res.json(classes)
  } catch (err) {
    console.error('list classes error:', err)
    res.status(500).json({ error: 'Failed to list classes' })
  }
})

app.post('/api/admin/classes', requireAdmin, async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name이 필요합니다' })
  try {
    const cls = await createClass(name, req.admin.adminId)
    res.json(cls)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 존재하는 수업입니다' })
    console.error('create class error:', err)
    res.status(500).json({ error: 'Failed to create class' })
  }
})

app.patch('/api/admin/classes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name이 필요합니다' })
  try {
    const allowed = await hasClassAccess(req.admin, id)
    if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
    const cls = await updateClassName(id, name)
    res.json(cls)
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 존재하는 수업입니다' })
    console.error('update class error:', err)
    res.status(500).json({ error: 'Failed to update class' })
  }
})

app.delete('/api/admin/classes/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  if (id === 'unassigned') return res.status(400).json({ error: '미배정 수업은 삭제할 수 없습니다' })
  try {
    const allowed = await hasClassAccess(req.admin, id)
    if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })

    deleteRoomsByClassId(id)
    await deleteCompletedTeamsByClassId(id)
    await deleteClass(id)

    res.json({ ok: true })
  } catch (err) {
    console.error('delete class error:', err)
    res.status(500).json({ error: 'Failed to delete class' })
  }
})

async function findRoomClassId(code) {
  const liveRoom = getRoom(code)
  if (liveRoom) return liveRoom.classId
  const completed = await getAllCompletedTeams()
  const match = completed.find(r => r.code === code)
  return match ? match.classId : undefined
}

app.get('/api/admin/rooms', requireAdmin, async (req, res) => {
  const { classId } = req.query
  if (!classId) return res.status(400).json({ error: 'classId 쿼리 파라미터가 필요합니다' })

  try {
    const allowed = await hasClassAccess(req.admin, classId)
    if (!allowed) return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })

    const now = new Date()
    const liveRooms = listAllRooms().map(room => ({
      code: room.code,
      status: computeLiveRoomStatus(room, now),
      registered: false,
      updatedAt: room.updatedAt,
      classId: room.classId,
      prices: room.prices,
      players: room.players.map(p => ({
        playerUuid: p.playerUuid,
        name: p.name,
        character: p.character,
        affiliation: p.affiliation,
        gameState: p.gameState,
        connected: p.connected,
      })),
    }))
    const completedRooms = await getAllCompletedTeams()
    const allRooms = [...liveRooms, ...completedRooms]

    const matchesClass = room => (classId === 'unassigned' ? !room.classId : room.classId === classId)

    res.json(sortRoomsByRecency(allRooms.filter(matchesClass)))
  } catch (err) {
    console.error('admin rooms error:', err)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

app.delete('/api/admin/rooms/:code', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const classId = await findRoomClassId(code)
  if (classId === undefined) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasClassAccess(req.admin, classId || 'unassigned'))) {
    return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
  }

  if (deleteRoomByCode(code)) return res.json({ ok: true })

  try {
    await deleteCompletedTeam(code)
    res.json({ ok: true })
  } catch (err) {
    console.error('admin delete error:', err)
    res.status(404).json({ error: 'Room not found' })
  }
})

app.patch('/api/admin/rooms/:code/players/:playerUuid', requireAdmin, async (req, res) => {
  const code = req.params.code.toUpperCase()
  const { playerUuid } = req.params
  const partialGameState = req.body

  const classId = await findRoomClassId(code)
  if (classId === undefined) return res.status(404).json({ error: 'Room not found' })
  if (!(await hasClassAccess(req.admin, classId || 'unassigned'))) {
    return res.status(403).json({ error: '해당 수업에 접근 권한이 없습니다' })
  }

  const room = updatePlayerStateByUuid(code, playerUuid, partialGameState)
  if (room) {
    io.to(code).emit('room-updated', { players: room.players })
    const player = room.players.find(p => p.playerUuid === playerUuid)
    return res.json({
      playerUuid: player.playerUuid,
      name: player.name,
      character: player.character,
      affiliation: player.affiliation,
      gameState: player.gameState,
      connected: player.connected,
    })
  }

  try {
    const updatedPlayer = await updateGameResult(code, playerUuid, partialGameState)
    res.json(updatedPlayer)
  } catch (err) {
    console.error('admin patch error:', err)
    res.status(404).json({ error: 'Player not found' })
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
        affiliation: r.affiliation,
        character: r.character,
        job: r.job,
        cash: r.cash,
        stockHoldings: r.stock_holdings,
        realEstateHoldings: r.real_estate_holdings,
        badges: r.badges,
        totalAssets: Number(r.total_assets),
        playerUuid: r.player_uuid,
        teamCode: session.team_code,
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
  socket.on('join-room', ({ code, name, character, isHost, playerUuid, affiliation }, callback) => {
    try {
      const room = addPlayer(code.toUpperCase(), {
        socketId: socket.id, name, character, isHost: !!isHost, playerUuid, affiliation,
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

  socket.on('kick-player', ({ targetSocketId: tid }) => {
    const result = kickPlayer(socket.id, tid)
    if (!result) return
    const { room, targetSocketId } = result
    io.to(targetSocketId).emit('you-were-kicked')
    io.to(room.code).emit('room-updated', { players: room.players })
  })

  socket.on('leave-room', () => {
    const room = removePlayer(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })

  socket.on('disconnect', () => {
    const room = markDisconnected(socket.id)
    if (room) io.to(room.code).emit('room-updated', { players: room.players })
  })
})

seedMasterAdmin()
  .catch(err => console.error('Failed to seed master admin:', err))
  .finally(() => {
    httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  })
