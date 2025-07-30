
// src/app.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { logger, PORT } = require('./config');
const matchRoutes = require('./routes/match');
const resultRoutes = require('./routes/result');
const auth = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');
const initSockets = require('./sockets');

function start() {
  const app = express();
  app.use(express.json());

  // HTTP 라우터
  app.use('/match', matchRoutes);
  app.use('/match', auth, resultRoutes);
  app.get('/health', (req, res) => res.send('OK'));
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  initSockets(io);

  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`Worker ${process.pid} listening on port ${PORT}`);
  });
}

module.exports = { start };
