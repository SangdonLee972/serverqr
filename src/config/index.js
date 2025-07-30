// src/config/index.js
require('dotenv').config();
const Joi = require('joi');
const logger = require('./logger');
const redis = require('./redis');

// 환경 변수 검증
const envSchema = Joi.object({
  REDIS_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(10).required(),
  PORT: Joi.number().default(3000),
  WORKER_COUNT: Joi.number().optional(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);
if (error) {
  logger.error('환경 변수 검증 오류', { error: error.message });
  process.exit(1);
}

module.exports = {
  REDIS_URL: envVars.REDIS_URL,
  JWT_SECRET: envVars.JWT_SECRET,
  PORT: envVars.PORT,
  redis,
  logger,
};