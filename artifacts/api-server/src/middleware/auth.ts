import type { Request, Response, NextFunction } from 'express';
import { verifyToken, authState } from '../lib/auth-state.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authState.data.isAuthenticated) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-auth-token'] as string;

  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
    return;
  }

  next();
}
