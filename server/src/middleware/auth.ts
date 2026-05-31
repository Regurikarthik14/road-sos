import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signToken(payload: JwtPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function signTempToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: '15m' } as jwt.SignOptions);
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
