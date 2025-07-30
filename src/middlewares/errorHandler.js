// src/middlewares/errorHandler.js
const { logger } = require('../config');

module.exports = (err, req, res, next) => {
  // 1) 에러 로깅: stack까지 찍어서 콘솔과 Winston에 기록
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    user: req.user?.id,
  });

  // 2) 클라이언트 응답
  //    개발 중에는 err.stack까지, 프로덕션에선 메시지만 노출하도록 조정 가능
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      // stack: err.stack, // production에선 제거
    },
  });
};
