import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isValidEmail } from '../lib/validate.js';
import { addEntry, hasEmail } from '../lib/store.js';

export const router = Router();

const waitlistRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per 1 minute per IP
  standardHeaders: true,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Try again in a minute.',
      },
    });
  },
});

router.post('/api/waitlist', waitlistRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Email address is missing.',
        },
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'That does not look like an email address.',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await hasEmail(normalizedEmail)) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_JOINED',
          message: 'You are already on the list.',
        },
      });
    }

    const ip = req.ip;
    await addEntry(normalizedEmail, ip);

    return res.status(201).json({ status: 'joined' });
  } catch (error) {
    // Delegate error handling to the central error middleware
    next(error);
  }
});
