import { rateLimit } from 'express-rate-limit';

const integerFromEnvironment = (value, fallback, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return Math.min(parsed, maximum);
};

export const requestRateLimitConfig = (environment = process.env) => ({
  api: {
    windowMs: integerFromEnvironment(environment.RATE_LIMIT_API_WINDOW_MS, 60_000, { minimum: 1_000, maximum: 3_600_000 }),
    limit: integerFromEnvironment(environment.RATE_LIMIT_API_MAX, 180, { maximum: 10_000 }),
    message: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
  },
  login: {
    windowMs: integerFromEnvironment(environment.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60_000, { minimum: 1_000, maximum: 24 * 60 * 60_000 }),
    limit: integerFromEnvironment(environment.RATE_LIMIT_LOGIN_MAX, 5, { maximum: 1_000 }),
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.',
    skipSuccessfulRequests: true,
  },
  ownerWrite: {
    windowMs: integerFromEnvironment(environment.RATE_LIMIT_WRITE_WINDOW_MS, 10 * 60_000, { minimum: 1_000, maximum: 24 * 60 * 60_000 }),
    limit: integerFromEnvironment(environment.RATE_LIMIT_WRITE_MAX, 60, { maximum: 10_000 }),
    message: 'Có quá nhiều thao tác thay đổi dữ liệu. Vui lòng chờ rồi thử lại.',
  },
});

export const createRequestRateLimiter = ({ windowMs, limit, message, skipSuccessfulRequests = false }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests,
  handler: (request, response, _next, options) => {
    const resetTime = request.rateLimit?.resetTime?.getTime();
    const retryAfterSeconds = resetTime ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)) : Math.ceil(windowMs / 1000);
    return response.status(options.statusCode).json({
      success: false,
      code: 'RATE_LIMITED',
      message,
      retryAfterSeconds,
    });
  },
});

export const trustProxyHops = (environment = process.env) => {
  if (environment.VERCEL) return 1;
  return integerFromEnvironment(environment.TRUST_PROXY_HOPS, 0, { minimum: 1, maximum: 10 });
};
