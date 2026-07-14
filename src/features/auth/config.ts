import type { OAuthProvider } from '@/types';

export type ProviderConfig = {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  icon: OAuthProvider;
};

export const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    icon: 'google',
  },
  microsoft: {
    name: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Calendars.Read',
      'offline_access',
    ],
    icon: 'microsoft',
  },
};

function getClientId(provider: OAuthProvider): string {
  if (provider === 'google') return process.env.GOOGLE_CLIENT_ID || '';
  if (provider === 'microsoft') return process.env.MICROSOFT_CLIENT_ID || '';
  return '';
}

function getClientSecret(provider: OAuthProvider): string | undefined {
  if (provider === 'google') return process.env.GOOGLE_CLIENT_SECRET || undefined;
  return undefined;
}

export function validateProvider(provider: OAuthProvider): void {
  const config = PROVIDERS[provider];
  const clientId = getClientId(provider);
  if (!clientId || clientId === 'your_google_client_id_here' || clientId === 'your_microsoft_client_id_here') {
    throw new Error(
      `Client ID not configured for ${config.name}. Add it to your .env file.`,
    );
  }
}

export { getClientId, getClientSecret };
