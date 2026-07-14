import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/auth-store';
import { ConnectAccount } from '@/features/auth/components/connect-account';
import { WelcomePage } from '@/features/auth/components/welcome-page';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, error, checkStatus } = useAuthStore();

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-center text-lg font-medium">
              Waiting for you to finish signing in...
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Check your browser to complete the login.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-center text-lg font-medium text-destructive">
              Authentication failed
            </p>
            <p className="text-center text-sm text-muted-foreground">{error}</p>
            <ConnectAccount onRetry />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'disconnected') {
    return <WelcomePage />;
  }

  return <>{children}</>;
}
