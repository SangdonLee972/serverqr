// src/controllers/matchController.js
const matchService = require('../services/matchService');
const { matchSchema } = require('../utils/validation');

exports.joinMatch = async (req, res, next) => {
  try {
    await matchSchema.validateAsync(req.body);
    const result = await matchService.join(req.body.userId, req.body.bet);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.cancelMatch = async (req, res, next) => {
  try {
    await matchSchema.validateAsync(req.body);
    await matchService.cancel(req.body.userId, req.body.bet);
    res.json({ cancelled: true });
  } catch (err) {
    next(err);
  }
};