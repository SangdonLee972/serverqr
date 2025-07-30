// src/app.js
const express       = require('express');
const http          = require('http');
const path          = require('path');
const fs            = require('fs');
const yaml          = require('js-yaml');
const { Server }    = require('socket.io');
const { logger, PORT } = require('./config');
const matchRoutes   = require('./routes/match');
const resultRoutes  = require('./routes/result');
const auth          = require('./middlewares/auth');
const errorHandler  = require('./middlewares/errorHandler');
const initSockets   = require('./sockets');
const swaggerUi     = require('swagger-ui-express');

function start() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Swagger-UI 설정 ────────────────────────────
  const specPath = path.join(__dirname, '../openapi.yaml');
  let swaggerDocument;
  try {
    swaggerDocument = yaml.load(fs.readFileSync(specPath, 'utf8'));
  } catch (e) {
    logger.error('Swagger 스펙 읽기 실패:', e);
    process.exit(1);
  }

  // /api-docs 경로로 Swagger UI 제공
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      explorer: true,
      swaggerOptions: { docExpansion: 'none' },
    })
  );
  // ─────────────────────────────────────────────────

  // HTTP 라우터
  app.use('/match', matchRoutes);
  app.use('/match', auth, resultRoutes);
  app.get('/health', (req, res) => res.send('OK'));

  // 전역 에러 핸들러
  app.use(errorHandler);

  // HTTP + Socket.io 서버
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  initSockets(io);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Worker ${process.pid} listening on port ${PORT}`);
    logger.info(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = { start };
