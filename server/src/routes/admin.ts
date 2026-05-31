import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getAllUsers, getUserById } from '../controllers/adminController.js';

const router = Router();

// Simple admin check via ADMIN_SECRET env var
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: 'Admin access not configured. Set ADMIN_SECRET environment variable.' });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token || token !== adminSecret) {
    res.status(401).json({ error: 'Invalid admin secret' });
    return;
  }

  next();
}

router.get('/users', requireAdmin, getAllUsers);
router.get('/users/:id', requireAdmin, getUserById);

export default router;
