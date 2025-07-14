// index.js
// ─────────────────────────────────────────────────────────────────────────────
// Production‐ready Matchmaker + Signaling Server
// • Clustering via Node.js Cluster API
// • Atomic matching in Redis via Lua script (per‐bet queue)
// • joinSocket, joinRoom, pointerMove, gameResult 이벤트 지원
// • Graceful shutdown (HTTP, WS, Redis)
// • Environment variables via dotenv
// • Structured logging via winston
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const os         = require('os');
const cluster    = require('cluster');
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const IORedis    = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { v4: uuidv4 }    = require('uuid');
const winston    = require('winston');
const jwt        = require('jsonwebtoken');

const isWin   = process.platform === 'win32';
const WORKERS = parseInt(process.env.WORKER_COUNT, 10)
                || (isWin ? 1 : os.cpus().length);

if (cluster.isMaster) {
  console.log(`Master ${process.pid} running, forking ${WORKERS} workers`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  cluster.on('exit', worker => {
    console.warn(`Worker ${worker.process.pid} died — respawning`);
    cluster.fork();
  });
  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker setup
// ─────────────────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [ new winston.transports.Console() ],
});

const app    = express();
app.use(express.json());
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const REDIS_URL        = process.env.REDIS_URL        || 'redis://127.0.0.1:6379';
const QUEUE_KEY_PREFIX = process.env.REDIS_QUEUE_KEY  || 'pending:';
const BET_HASH_PREFIX  = process.env.REDIS_ROOM_PREFIX || 'room:';
const JWT_SECRET       = process.env.JWT_SECRET      || 'replace_with_real_secret';

const pubClient = new IORedis(REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

logger.info('Worker initialized', { pid: process.pid });

// ─────────────────────────────────────────────────────────────────────────────
// Atomic matching Lua script
// ─────────────────────────────────────────────────────────────────────────────

const matchLua = `
  local key = KEYS[1]
  local user = ARGV[1]
  redis.call('RPUSH', key, user)
  local len = tonumber(redis.call('LLEN', key))
  if len < 2 then return nil end
  local a = redis.call('LPOP', key)
  local b = redis.call('LPOP', key)
  if a == user then a, b = b, a end
  return a
`;
pubClient.defineCommand('matchUser', { numberOfKeys: 1, lua: matchLua });

// ─────────────────────────────────────────────────────────────────────────────
// JWT auth middleware for /match/result
// ─────────────────────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO events
// ─────────────────────────────────────────────────────────────────────────────

io.on('connection', socket => {
  logger.info('New socket connection', { socketId: socket.id });

  socket.on('joinSocket', ({ userId }) => {
    socket.join(userId);
    logger.info('Socket joined signaling room', { socketId: socket.id, userId });
  });

  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
    logger.info('Socket joined game room', { socketId: socket.id, roomId });
    socket.emit('roomJoined', { roomId });
  });

  socket.on('pointerMove', ({ roomId, x, y }) => {
    logger.info('▶ [pointerMove] recv', { socketId: socket.id, roomId, x, y });
    socket.to(roomId).emit('pointerMove', { x, y });
    logger.info('▶ [pointerMove] sent', { roomId, x, y });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      const timer = setTimeout(async () => {
        const rem = await io.in(roomId).allSockets();
        if (rem.size === 0) {
          await pubClient.del(`${BET_HASH_PREFIX}${roomId}`);
          logger.info('Cleaned up empty room after timeout', { roomId });
        }
      }, 30_000);
      socket.data = socket.data || {};
      socket.data[`cleanupTimer:${roomId}`] = timer;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7) 매칭 API
// ─────────────────────────────────────────────────────────────────────────────

// (index.js 중 match/join 핸들러 부분만 발췌)

// index.js (매칭 성공 처리 부분)
// index.js — 7) 매칭 API 엔드포인트 내에서
app.post('/match/join', async (req, res) => {
  const { userId, bet } = req.body;
  const queueKey   = `${QUEUE_KEY_PREFIX}${bet}`;
  logger.info('Join request', { userId, bet });

  try {
    const opponent = await pubClient.matchUser(queueKey, userId);
    if (!opponent) {
      logger.info('No match yet, waiting', { userId, bet });
      return res.json({ matched: false });
    }

    // 매칭 성공!
    const signalRoomId = uuidv4();
    const roomKey      = `${BET_HASH_PREFIX}${signalRoomId}`;

    // ── 여기만 hmset 으로 대체 ──────────────────────────────────────
    await pubClient.hmset(
      roomKey,
      'player1', userId,
      'player2', opponent,
      'bet',     bet.toString()
    );
    // ───────────────────────────────────────────────────────────────

    io.to(userId).emit('matched',   { opponent, signalRoomId });
    io.to(opponent).emit('matched', { opponent: userId, signalRoomId });
    return res.json({ matched: true, opponent, signalRoomId });
  } catch (err) {
    logger.error('Match error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 8) 게임 결과 처리 API
// ─────────────────────────────────────────────────────────────────────────────

// index.js (match/result 핸들러 부분)
// index.js — 8) 게임 결과 처리 API (인증 생략된 예제)

app.post('/match/result', async (req, res) => {
  const { roomId, winnerId } = req.body;
  const roomKey = `${BET_HASH_PREFIX}${roomId}`;

  try {
    const data = await pubClient.hgetall(roomKey);
    if (!data.bet) {
      return res.status(400).json({ error: 'Room not found' });
    }

    const bet    = Number(data.bet);
    const p1     = data.player1;
    const p2     = data.player2;
    const loser  = (winnerId === p1 ? p2 : p1);
    const total  = bet * 2;
    const winAmt = Math.floor(total * 0.7);
    const loseAmt = Math.floor(total * 0.2);
    const fee    = total - winAmt - loseAmt;

    // ── 수정된 Lua 스크립트 ─────────────────────────────────────────
    const lua = `
      local wkey = 'user:'..KEYS[1]
      local lkey = 'user:'..KEYS[2]
      -- 'balance' 필드를 지정해야 합니다
      redis.call('HINCRBY', wkey, 'balance', ARGV[1])
      redis.call('HINCRBY', lkey, 'balance', ARGV[2])
      redis.call('INCRBY', 'server:fees', ARGV[3])
      return {ARGV[1], ARGV[2], ARGV[3]}
    `;
    // numKeys=2, KEYS[1]=winnerId, KEYS[2]=loser
    const result = await pubClient.eval(
      lua,
      2,
      winnerId,
      loser,
      winAmt.toString(),
      loseAmt.toString(),
      fee.toString()
    );
    const [w, l, f] = result.map(n => parseInt(n, 10));
    // ────────────────────────────────────────────────────────────────

    // 1) 클라이언트로 게임 결과 이벤트 발송
    io.in(roomId).emit('gameResult', {
      winnerId,
      loserId:    loser,
      winnerGain: w,
      serverFee:  f
    });

    // 2) 룸 강제 탈퇴 및 Redis 데이터 삭제
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      s.leave(roomId);
    }
    await pubClient.del(roomKey);

    // 3) HTTP 응답
    return res.json({
      winnerId,
      loserId:  loser,
      winAmount:  w,
      loseAmount: l,
      fee:        f
    });

  } catch (err) {
    logger.error('Match result error', { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});



// ─────────────────────────────────────────────────────────────────────────────
// 9) 매칭 취소 API
// ─────────────────────────────────────────────────────────────────────────────

app.post('/match/cancel', async (req, res) => {
  const { userId, bet } = req.body;
  try {
    const removed = await pubClient.lrem(`${QUEUE_KEY_PREFIX}${bet}`, 0, userId);
    logger.info('Cancel match', { userId, bet, removedCount: removed });
    return res.json({ cancelled: true });
  } catch (e) {
    logger.error('Cancel error', { error: e.message });
    return res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10) Health check & graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.send('OK'));
const shutdown = () => {
  logger.info('Shutdown initiated', { pid: process.pid });
  server.close(() => { io.close(); pubClient.quit(); process.exit(0); });
  setTimeout(() => process.exit(1), 15_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
 const PORT = parseInt(process.env.PORT, 10) || 3000;
 // 외부 요청을 받기 위해 0.0.0.0에 바인딩
 server.listen(PORT, '0.0.0.0', () => {
   logger.info('Worker listening', { pid: process.pid, port: PORT, host: '0.0.0.0' });
 });