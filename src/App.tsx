import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/auth-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme-provider';
import { RootLayout } from '@/components/layout/root-layout';
import { AuthGate } from '@/features/auth/components/auth-gate';

const queryClient = new QueryClient();

export default function App() {
  const checkStatus = useAuthStore((s) => s.checkStatus);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark" storageKey="lexas-theme">
          <AuthGate>
            <RootLayout />
          </AuthGate>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
