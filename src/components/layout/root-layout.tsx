import { useTheme } from '@/lib/theme-provider';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export function RootLayout() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-lg font-semibold tracking-tight">lexas</span>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto p-4" />
      </main>
    </div>
  );
}
