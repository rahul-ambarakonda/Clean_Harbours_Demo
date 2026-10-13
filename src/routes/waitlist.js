import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isValidEmail } from '../lib/validate.js';
import { addEntry, hasEmail } from '../lib/store.js';
import { log } from '../server.js';

const router = Router();

// Rate limiting for the waitlist endpoint
const waitlistRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  standardHeaders: true, // Return rate limit info in the headers
  handler: (req, res) => {
    log({ event: 'waitlist_submitted', outcome: 'rate_limited', ip: req.ip });
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
    const ip = req.ip; // req.ip is available due to app.set('trust proxy', 1) in server.js

    if (!isValidEmail(email)) {
      log({ event: 'waitlist_submitted', outcome: 'invalid', ip });
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'That does not look like an email address.',
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await hasEmail(normalizedEmail)) {
      log({ event: 'waitlist_submitted', outcome: 'duplicate', ip });
      return res.status(409).json({
        error: {
          code: 'ALREADY_JOINED',
          message: 'You are already on the list.',
        },
      });
    }

    await addEntry(normalizedEmail, ip);
    log({ event: 'waitlist_submitted', outcome: 'joined', ip });
    res.status(201).json({ status: 'joined' });

  } catch (error) {
    if (error.message === 'STORE_UNAVAILABLE') {
      log({ event: 'waitlist_store_error', message: error.message, ip: req.ip });
      return next({ statusCode: 500, code: 'STORE_UNAVAILABLE', message: 'Something went wrong. Try again shortly.' });
    }
    next(error); // Pass other errors to the central error handler
  }
});

export { router };
