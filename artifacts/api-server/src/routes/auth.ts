import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  setupAuth, verifyLogin, getAuthStatus, rotateToken, clearAuth, authState,
} from '../lib/auth-state.js';

const router = Router();

router.get('/status', (req: Request, res: Response) => {
  res.json(getAuthStatus());
});

router.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (authState.data.isAuthenticated) {
    res.status(409).json({ error: 'Authentication is already configured. Use /auth/login.' });
    return;
  }

  const token = setupAuth(username.trim(), password);
  res.json({ success: true, token });
});

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const token = verifyLogin(username.trim(), password);
  if (!token) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  res.json({ success: true, token, username: authState.data.username });
});

router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

router.post('/rotate-token', (req: Request, res: Response) => {
  if (!authState.data.isAuthenticated) {
    res.status(400).json({ error: 'No auth configured' });
    return;
  }
  const token = rotateToken();
  res.json({ success: true, token });
});

router.post('/clear', (req: Request, res: Response) => {
  clearAuth();
  res.json({ success: true });
});

export default router;
