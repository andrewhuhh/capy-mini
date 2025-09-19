import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function getClientId(req: Request): string {
  return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
}

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientId = getClientId(req);
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '900000'); // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_REQUESTS || '100');

  const entry = rateLimitMap.get(clientId);

  if (!entry || entry.resetTime < now) {
    rateLimitMap.set(clientId, {
      count: 1,
      resetTime: now + windowMs
    });
    return next();
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter
    });
  }

  entry.count++;
  next();
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(clientId);
    }
  }
}, 60000); // Clean every minute