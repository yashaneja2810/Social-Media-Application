import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5,
  message: 'Too many attempts, please try again later.',
});

export const socketRateLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10,
  message: 'Rate limit exceeded',
});
