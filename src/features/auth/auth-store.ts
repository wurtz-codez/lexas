import { create } from 'zustand';
import type { OAuthProvider, AuthStatus } from '@/types';

type AuthState = {
  status: 'loading' | 'disconnected' | 'connecting' | 'connected';
  provider: OAuthProvider | null;
  email: string | null;
  error: string | null;
  checkStatus: () => Promise<void>;
  startOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  provider: null,
  email: null,
  error: null,

  checkStatus: async () => {
    try {
      const result: AuthStatus = await window.electron.auth.getStatus();
      set({
        status: result.connected ? 'connected' : 'disconnected',
        provider: result.provider,
        email: result.email,
      });
    } catch {
      set({ status: 'disconnected' });
    }
  },

  startOAuth: async (provider: OAuthProvider) => {
    set({ status: 'connecting', error: null });
    try {
      const result = await window.electron.auth.startOAuth(provider);
      if (result.success) {
        set({
          status: 'connected',
          provider: result.provider,
          email: result.email,
        });
      }
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Authentication failed',
      });
    }
  },

  signOut: async () => {
    try {
      await window.electron.auth.signOut();
      set({ status: 'disconnected', provider: null, email: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sign out failed',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
