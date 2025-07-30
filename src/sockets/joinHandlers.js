// src/sockets/joinHandlers.js
module.exports = (io, socket) => {
    socket.on('joinSocket', () => {
      socket.join(socket.user.id);
      io.to(socket.user.id).emit('joinedSignaling', { userId: socket.user.id });
    });
    socket.on('joinRoom', ({ roomId }) => {
      socket.join(roomId);
      socket.emit('roomJoined', { roomId });
    });
  };
  
