// src/services/gameService.js
const { redis, logger } = require('../config');

exports.process = async (userId, roomId, winnerId) => {
  const roomKey = `room:${roomId}`;
  const data = await redis.hgetall(roomKey);
  if (!data.bet) {
    const err = new Error('Room not found');
    err.status = 400;
    throw err;
  }
  const bet = Number(data.bet);
  const p1 = data.player1;
  const p2 = data.player2;
  const loser = winnerId === p1 ? p2 : p1;

  // 정산
  const total = bet * 2;
  const winAmt = Math.floor(total * 0.7);
  const loseAmt = Math.floor(total * 0.2);
  const fee = total - winAmt - loseAmt;

  const lua = `
    local wkey = 'user:'..KEYS[1]
    local lkey = 'user:'..KEYS[2]
    redis.call('HINCRBY', wkey, 'balance', ARGV[1])
    redis.call('HINCRBY', lkey, 'balance', ARGV[2])
    redis.call('INCRBY', 'server:fees', ARGV[3])
    return {ARGV[1], ARGV[2], ARGV[3]}
  `;
  const result = await redis.eval(lua, 2, winnerId, loser, winAmt, loseAmt, fee);
  const [wGain, lGain, serverFee] = result.map(Number);

  logger.info('게임 결과 처리 완료', { roomId, winnerId, loser, wGain, lGain, serverFee });
  // 방 정리
  await redis.del(roomKey);

  return { winnerId, loserId: loser, winAmount: wGain, loseAmount: lGain, fee: serverFee };
};

