import { ipcMain, shell, safeStorage, BrowserWindow } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';
import net from 'node:net';
import { getDb } from './database';
import type { OAuthProvider, TokenPair, AuthResult, AuthStatus } from '@/types';
import { PROVIDERS, getClientId, getClientSecret, validateProvider, type ProviderConfig } from '@/features/auth/config';

function pkceVerifier(): string {
  return crypto.randomBytes(32)
    .toString('base64url');
}

function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest()
    .toString('base64url');
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function startLocalServer(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/' || url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<html><body><h1>Authentication failed: ${error}</h1><p>You can close this tab.</p></body></html>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Missing authorization code</h1></body></html>');
          server.close();
          reject(new Error('Missing authorization code'));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>State mismatch — possible CSRF</h1></body></html>');
          server.close();
          reject(new Error('State mismatch'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authentication successful!</h1><p>You can close this tab and return to Lexas.</p></body></html>');
        server.close();
        resolve(code);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port);
  });
}

async function exchangeCode(
  config: ProviderConfig,
  clientId: string,
  clientSecret: string | undefined,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenPair> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
  });

  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json();
}

function decodeIdToken(idToken: string): { email?: string; sub?: string } | null {
  try {
    const payload = idToken.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return { email: decoded.email, sub: decoded.sub };
  } catch {
    return null;
  }
}

function storeTokens(
  provider: string,
  encryptedRefreshToken: Buffer,
  accessToken: string,
  accessTokenExpiry: string,
  email: string | null,
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO auth_tokens (provider, encrypted_refresh_token, access_token, access_token_expiry, email)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      access_token = excluded.access_token,
      access_token_expiry = excluded.access_token_expiry,
      email = excluded.email,
      updated_at = CURRENT_TIMESTAMP
  `).run(provider, encryptedRefreshToken, accessToken, accessTokenExpiry, email);
}

async function refreshAccessToken(config: ProviderConfig, clientId: string, clientSecret: string | undefined, refreshToken: string): Promise<TokenPair> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    grant_type: 'refresh_token',
  });

  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function startOAuthFlow(provider: OAuthProvider): Promise<AuthResult> {
  const config = PROVIDERS[provider];
  const clientId = getClientId(provider);

  validateProvider(provider);

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('System keychain is not available. Cannot securely store credentials.');
  }

  const port = await findAvailablePort();
  const redirectUri = `http://localhost:${port}/`;
  const codeVerifier = pkceVerifier();
  const codeChallenge = pkceChallenge(codeVerifier);
  const state = crypto.randomUUID();

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  const authPromise = startLocalServer(port, state);

  await shell.openExternal(authUrl.toString());

  const code = await authPromise;

  const tokens = await exchangeCode(config, clientId, getClientSecret(provider), code, redirectUri, codeVerifier);

  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    throw new Error('System keychain is not available. Cannot securely store credentials.');
  }

  const encrypted = safeStorage.encryptString(tokens.refresh_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const userInfo = tokens.id_token ? decodeIdToken(tokens.id_token) : null;
  const email = userInfo?.email || null;

  storeTokens(provider, encrypted, tokens.access_token, expiresAt, email);

  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }

  return { success: true, provider, email };
}

function signOut(): void {
  const db = getDb();
  db.prepare('DELETE FROM auth_tokens').run();
}

function getAuthStatus(): AuthStatus {
  const db = getDb();
  const row = db.prepare('SELECT provider, email FROM auth_tokens LIMIT 1').get() as { provider: string; email: string | null } | undefined;

  if (!row) {
    return { connected: false, provider: null, email: null };
  }

  return {
    connected: true,
    provider: row.provider as OAuthProvider,
    email: row.email,
  };
}

export async function getValidAccessToken(provider: OAuthProvider): Promise<string> {
  const db = getDb();
  const row = db.prepare(
    'SELECT access_token, access_token_expiry, encrypted_refresh_token FROM auth_tokens WHERE provider = ?'
  ).get(provider) as { access_token: string | null; access_token_expiry: string | null; encrypted_refresh_token: Buffer } | undefined;

  if (!row) {
    throw new Error(`No auth tokens found for ${provider}. Connect your account first.`);
  }

  if (row.access_token && row.access_token_expiry && new Date(row.access_token_expiry) > new Date()) {
    return row.access_token;
  }

  const config = PROVIDERS[provider];
  const clientId = getClientId(provider);
  const refreshToken = safeStorage.decryptString(row.encrypted_refresh_token);

  const clientSecret = getClientSecret(provider);
  const tokens = await refreshAccessToken(config, clientId, clientSecret, refreshToken);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const existing = db.prepare('SELECT email FROM auth_tokens WHERE provider = ?').get(provider) as { email: string | null } | undefined;
  storeTokens(provider, row.encrypted_refresh_token, tokens.access_token, expiresAt, existing?.email ?? null);

  return tokens.access_token;
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:start', async (_event, provider: OAuthProvider): Promise<AuthResult> => {
    return startOAuthFlow(provider);
  });

  ipcMain.handle('auth:signout', async (): Promise<void> => {
    signOut();
  });

  ipcMain.handle('auth:status', async (): Promise<AuthStatus> => {
    return getAuthStatus();
  });
}
