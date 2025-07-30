const { redis, logger } = require('../config');
const fs = require('fs');
const lua = fs.readFileSync(__dirname + '/../scripts/match.lua', 'utf8');
redis.defineCommand('matchUser', { numberOfKeys: 1, lua });

exports.join = async (userId, bet) => {
  const queueKey = `pending:${bet}`;
  logger.info('매칭 시도', { userId, bet });
  const opponent = await redis.matchUser(queueKey, userId);
  if (!opponent) {
    return { matched: false };
  }
  const signalRoomId = require('uuid').v4();
  // 방 정보 Redis에 저장
  await redis.hset(`room:${signalRoomId}`, 'player1', userId, 'player2', opponent, 'bet', bet);
  return { matched: true, opponent, signalRoomId };
};

exports.cancel = async (userId, bet) => {
  const removed = await redis.lrem(`pending:${bet}`, 0, userId);
  logger.info('매칭 취소', { userId, bet, removed });
  return removed;
};