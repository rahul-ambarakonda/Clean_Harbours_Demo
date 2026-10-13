import { Router } from 'express';

const router = Router();

router.get('/healthz', (req, res) => {
  const uptime = Math.floor(process.uptime());
  res.status(200).json({ status: 'ok', uptime });
});

export { router };
