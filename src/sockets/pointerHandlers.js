// src/sockets/pointerHandlers.js
const { redis, logger } = require('../config');
module.exports = (io, socket) => {
  socket.on('pointerMove', ({ roomId, x, y }) => {
    io.to(roomId).emit('pointerMove', { x, y });
  });
  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      setTimeout(async () => {
        const rem = await io.in(roomId).allSockets();
        if (rem.size === 0) {
          await redis.del(`room:${roomId}`);
          logger.info('Cleaned up empty room', { roomId });
        }
      }, 30_000);
    }
  });
};