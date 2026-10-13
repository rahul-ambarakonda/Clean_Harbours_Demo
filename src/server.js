import express from 'express';
import helmet from 'helmet';
import { router as healthRouter } from './routes/health.js';
import { router as waitlistRouter } from './routes/waitlist.js';

const app = express();
const PORT = process.env.PORT || 3000;

// A simple log helper to output JSON lines to stdout.
// This is used instead of console.log for structured logging.
function log(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// Trust proxy for correct IP in rate limiting
app.set('trust proxy', 1);

// Body parser for JSON requests, with a size limit
app.use(express.json({ limit: '1kb' }));

// Health endpoint
app.use('/', healthRouter);

// Waitlist API endpoint
app.use('/', waitlistRouter);

// Serve static files from the public directory
app.use(express.static('public'));

// Central error handling middleware
app.use((err, req, res, next) => {
  log({ event: 'error', message: err.message, stack: err.stack, path: req.path });

  // Default to 500 if the error doesn't have a status code
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'SERVER_ERROR';
  const errorMessage = err.message || 'Something went wrong. Try again shortly.';

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: errorMessage,
    },
  });
});

app.listen(PORT, () => {
  log({ event: 'server_started', port: PORT });
});

export { log };
