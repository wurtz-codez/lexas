import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/auth-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme-provider';
import { RootLayout } from '@/components/layout/root-layout';
import { Toaster } from '@/components/ui/sonner';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import type { OnboardingStatus } from '@/types';

const queryClient = new QueryClient();

export default function App() {
  const connected = useAuthStore((s) => s.status === 'connected');
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);

  useEffect(() => {
    if (connected) {
      window.electron.onboarding.getStatus().then(setOnboarding);
    }
  }, [connected]);

  const handleOnboardingDone = async () => {
    const status = await window.electron.onboarding.getStatus();
    setOnboarding(status);
  };

  const showOnboarding =
    connected && onboarding && !onboarding.completed;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="light" storageKey="lexas-theme">
          {showOnboarding ? (
            <OnboardingFlow onDone={handleOnboardingDone} />
          ) : (
            <AuthGate>
              <RootLayout onboarding={onboarding} />
            </AuthGate>
          )}
          <Toaster />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
