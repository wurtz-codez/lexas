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

export type RunAllSyncResult = {
  gmail: SyncResult | null;
  calendar: SyncResult | null;
  correlation: CorrelationResult | null;
  errors: string[];
};

export type FeedbackType = 'important' | 'not_important' | 'dismissed';

export type SuggestedAction = {
  proposed_title: string;
  proposed_start: string;
  proposed_end: string;
};

export type CreateEventRequest = {
  title: string;
  start: string;
  end: string;
  synced_item_id: number;
};

export type CreateEventResult = {
  event_id: string;
};

export type BriefItemDetail = {
  id: number;
  synced_item_id: number;
  rank: number;
  reason: string | null;
  score: number | null;
  item: {
    source: 'email' | 'calendar';
    title: string | null;
    snippet: string | null;
    sender_email: string | null;
    occurred_at: string | null;
    ends_at: string | null;
  };
  person: { id: number; name: string; email: string | null; is_vip: boolean } | null;
  project: { id: number; name: string } | null;
  feedback: { type: FeedbackType; created_at: string } | null;
  suggested_action: SuggestedAction | null;
};

export type BriefDetail = {
  id: number;
  brief_date: string;
  generated_at: string;
  items: BriefItemDetail[];
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
        runAll: () => Promise<RunAllSyncResult>;
      };
      brief: {
        generate: (date: string, tzOffsetMinutes: number) => Promise<BriefResult>;
        getLatest: () => Promise<BriefDetail | null>;
      };
      feedback: {
        submit: (briefItemId: number, type: FeedbackType) => Promise<void>;
      };
      calendar: {
        createEvent: (details: CreateEventRequest) => Promise<CreateEventResult>;
      };
    };
  }
}
