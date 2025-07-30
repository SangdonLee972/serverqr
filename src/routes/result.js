const router = require('express').Router();
const { processResult } = require('../controllers/gameController');

router.post('/result', processResult);

module.exports = router;