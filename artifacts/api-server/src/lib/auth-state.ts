import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface AuthData {
  isAuthenticated: boolean;
  username?: string;
  passwordHash?: string;
  accessToken?: string;
  janitorApiKey?: string;
}

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAuthFromFile(): AuthData {
  try {
    ensureDataDir();
    if (fs.existsSync(AUTH_FILE)) {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      return JSON.parse(raw) as AuthData;
    }
  } catch {}
  return { isAuthenticated: false };
}

function writeAuthToFile(data: AuthData): void {
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Auth] Failed to write auth file:', e);
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function bootstrap(): AuthData {
  const existing = readAuthFromFile();
  // Always ensure a janitorApiKey exists
  if (!existing.janitorApiKey) {
    existing.janitorApiKey = generateToken();
    writeAuthToFile(existing);
  }
  return existing;
}

export const authState: { data: AuthData } = {
  data: bootstrap(),
};

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'jt_salt_2025').digest('hex');
}

export function setupAuth(username: string, password: string): string {
  const token = generateToken();
  const data: AuthData = {
    ...authState.data,
    isAuthenticated: true,
    username,
    passwordHash: hashPassword(password),
    accessToken: token,
  };
  authState.data = data;
  writeAuthToFile(data);
  return token;
}

export function verifyLogin(username: string, password: string): string | null {
  const data = authState.data;
  if (!data.isAuthenticated || !data.username || !data.passwordHash) return null;
  if (data.username !== username) return null;
  if (data.passwordHash !== hashPassword(password)) return null;
  return data.accessToken || null;
}

export function verifyToken(token: string): boolean {
  return !!authState.data.accessToken && authState.data.accessToken === token;
}

export function verifyJanitorApiKey(key: string): boolean {
  return !!authState.data.janitorApiKey && authState.data.janitorApiKey === key;
}

export function rotateToken(): string {
  const token = generateToken();
  authState.data = { ...authState.data, accessToken: token };
  writeAuthToFile(authState.data);
  return token;
}

export function rotateJanitorApiKey(): string {
  const key = generateToken();
  authState.data = { ...authState.data, janitorApiKey: key };
  writeAuthToFile(authState.data);
  return key;
}

export function clearAuth(): void {
  const key = authState.data.janitorApiKey || generateToken();
  authState.data = { isAuthenticated: false, janitorApiKey: key };
  writeAuthToFile(authState.data);
}

export function getAuthStatus(): { isAuthenticated: boolean; username?: string } {
  return {
    isAuthenticated: authState.data.isAuthenticated,
    username: authState.data.username,
  };
}

export function getJanitorApiKey(): string {
  if (!authState.data.janitorApiKey) {
    authState.data.janitorApiKey = generateToken();
    writeAuthToFile(authState.data);
  }
  return authState.data.janitorApiKey;
}
