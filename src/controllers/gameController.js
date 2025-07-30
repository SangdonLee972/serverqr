// src/controllers/gameController.js
const gameService = require('../services/gameService');
const { resultSchema } = require('../utils/validation');

exports.processResult = async (req, res, next) => {
  try {
    await resultSchema.validateAsync(req.body);
    const summary = await gameService.process(req.user.id, req.body.roomId, req.body.winnerId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
};