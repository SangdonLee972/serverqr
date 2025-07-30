const router = require('express').Router();
const { joinMatch, cancelMatch } = require('../controllers/matchController');

router.post('/join', joinMatch);
router.post('/cancel', cancelMatch);

module.exports = router;