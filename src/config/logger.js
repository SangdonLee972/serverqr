// src/config/logger.js
const { createLogger, format, transports } = require('winston');

module.exports = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [new transports.Console()],
});


// src/config/redis.js
const IORedis = require('ioredis');
const config = require('./index');

const client = new IORedis(config.REDIS_URL);
client.on('error', err => config.logger.error('Redis 오류', { error: err }));

module.exports = client;
