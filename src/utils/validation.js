const Joi = require('joi');

// 요청 바디 스키마 예시
exports.matchSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  bet: Joi.number().integer().positive().required(),
});

exports.resultSchema = Joi.object({
  roomId: Joi.string().uuid().required(),
  winnerId: Joi.string().uuid().required(),
});
