import { useState } from 'react';
import { ConnectAccount } from './connect-account';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WelcomePage() {
  const [showProviders, setShowProviders] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-center border-b border-border/40">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          lexas
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6">
        {!showProviders ? (
          <div className="flex flex-col items-center gap-6 max-w-lg text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="size-7 text-primary" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Welcome to Lexas
            </h1>

            <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              Your intelligent assistant for email and calendar.
              Stay organized, respond faster, and never miss a beat.
            </p>

            <Button
              onClick={() => setShowProviders(true)}
              className="mt-2 h-12 rounded-full px-10 text-base font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            >
              Get Started
            </Button>
          </div>
        ) : (
          <div className="transition-all duration-500">
            <ConnectAccount onBack={() => setShowProviders(false)} />
          </div>
        )}
      </main>
    </div>
  );
}
