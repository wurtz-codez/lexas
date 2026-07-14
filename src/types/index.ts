export type Theme = 'dark' | 'light' | 'system';

export type OAuthProvider = 'google' | 'microsoft';

export type AuthStatus = {
  connected: boolean;
  provider: OAuthProvider | null;
  email: string | null;
};

export type AuthResult = {
  success: boolean;
  provider: OAuthProvider;
  email: string | null;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
};

declare global {
  interface Window {
    electron: {
      auth: {
        startOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
        signOut: () => Promise<void>;
        getStatus: () => Promise<AuthStatus>;
      };
    };
  }
}
