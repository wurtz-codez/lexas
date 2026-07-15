import { useState } from 'react';
import { useTheme } from '@/lib/theme-provider';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ContextEditor } from '@/features/settings/components/context-editor';
import type { OnboardingStatus } from '@/types';

function isEmpty(status: OnboardingStatus | null): boolean {
  if (!status) return true;
  return !status.displayName && !status.role && status.projects.length === 0 && status.people.length === 0 && !status.focusSummary;
}

export function RootLayout({ onboarding }: { onboarding: OnboardingStatus | null }) {
  const { theme, setTheme } = useTheme();
  const [showBanner, setShowBanner] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const userContextEmpty = onboarding && isEmpty(onboarding) && showBanner;

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-lg font-semibold tracking-tight">lexas</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {userContextEmpty && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b bg-muted/50"
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-sm text-muted-foreground">
                Add your projects and key people for better rankings{' '}
                <button
                  onClick={() => setShowSettings(true)}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Set up context
                </button>
              </p>
              <button
                onClick={() => setShowBanner(false)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSettings ? (
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-4">
            <ContextEditor onClose={() => setShowSettings(false)} />
          </div>
        </main>
      ) : (
        <main className="flex-1">
          <div className="container mx-auto p-4" />
        </main>
      )}
    </div>
  );
}
