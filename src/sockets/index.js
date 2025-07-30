

// src/sockets/index.js
const { redis, logger } = require('../config');
const { createAdapter } = require('@socket.io/redis-adapter');
const registerJoin = require('./joinHandlers');
const registerPointer = require('./pointerHandlers');

module.exports = io => {
  io.adapter(createAdapter(redis, redis.duplicate()));
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      socket.user = require('jsonwebtoken').verify(token, require('../config').JWT_SECRET);
      next();
    } catch (e) {
      next(new Error('Authentication error'));
    }
  });
  io.on('connection', socket => {
    logger.info('Socket connected', { id: socket.id, user: socket.user.id });
    registerJoin(io, socket);
    registerPointer(io, socket);
  });
};