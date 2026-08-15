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

export type OnboardingData = {
  displayName: string;
  roles: string[];
  projects: { name: string; description: string }[];
  people: { name: string; email?: string }[];
  focusSummary: string;
};

export type SyncResult = {
  synced: number;
};

export type BriefResult = {
  brief_id: number;
  items_ranked: number;
};

export type CorrelationResult = {
  resolved: number;
  links: number;
};

export type OnboardingStatus = {
  completed: boolean;
  displayName: string | null;
  roles: string[];
  projects: { id: number; name: string; description: string | null }[];
  people: { id: number; name: string; email: string | null }[];
  focusSummary: string | null;
};

declare global {
  interface Window {
    electron: {
      auth: {
        startOAuth: (provider: OAuthProvider) => Promise<AuthResult>;
        signOut: () => Promise<void>;
        getStatus: () => Promise<AuthStatus>;
      };
      onboarding: {
        save: (data: OnboardingData) => Promise<void>;
        setCompleted: () => Promise<void>;
        getStatus: () => Promise<OnboardingStatus>;
      };
      sync: {
        gmail: () => Promise<SyncResult>;
        calendar: () => Promise<SyncResult>;
        correlate: () => Promise<CorrelationResult>;
      };
      brief: {
        generate: (date: string) => Promise<BriefResult>;
      };
    };
  }
}
