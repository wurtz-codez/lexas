import { useState, useEffect, useRef } from 'react';
import { ConnectAccount } from './connect-account';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Brain, Mail, Calendar, Shield, ArrowUpRight, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

export function WelcomePage() {
  const [showProviders, setShowProviders] = useState(false);
  const { theme, setTheme } = useTheme();
  const bgRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const amount = 20;
      const x = ((e.clientX - window.innerWidth / 2) / (window.innerWidth / 2)) * amount;
      const y = ((e.clientY - window.innerHeight / 2) / (window.innerHeight / 2)) * amount;
      if (bgRef.current) {
        bgRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Navigation */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-max px-8 py-4 rounded-full backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-lg flex justify-between items-center gap-12 z-[100] bg-surface/10">
        <div className="flex items-center gap-6">
          <a className="text-xs uppercase tracking-wider font-semibold text-secondary opacity-60 hover:opacity-100 transition-opacity" href="#features">Features</a>
        </div>
        <div className="text-xl font-bold tracking-tight text-primary lowercase">lexas</div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="text-secondary/60 hover:text-primary hover:scale-110 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button 
            onClick={() => setShowProviders(true)}
            className="text-primary hover:scale-110 transition-transform cursor-pointer"
          >
            <User className="size-5" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full max-w-[1200px] flex-1 flex flex-col items-center justify-center pt-36 pb-24 px-6 md:px-10 relative">
        {/* Atmospheric Background Element */}
        <div ref={bgRef} className="absolute inset-0 pointer-events-none hero-gradient z-0 transition-transform duration-300 ease-out" />

        <AnimatePresence mode="wait">
          {!showProviders ? (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 text-center flex flex-col items-center max-w-[800px] w-full"
            >
              {/* Floating Chip */}
              <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-container/30 border border-outline-variant/20 backdrop-blur-sm">
                <Sparkles className="size-3.5 text-on-secondary-container animate-pulse" />
                <span className="text-xs text-on-secondary-container font-semibold uppercase tracking-widest">Beta development phase</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-6 leading-tight tracking-tight">
                Your day, <span className="italic font-serif opacity-80 font-normal">distilled.</span>
              </h1>

              {/* Description */}
              <p className="text-lg md:text-xl text-secondary mb-12 max-w-[600px] leading-relaxed">
                Lexas intelligently synthesizes your last 24 hours of emails and calendar events into a single, high-fidelity executive briefing. Focus on what matters, ignore the noise.
              </p>

              {/* Get Started Button */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                  onClick={() => setShowProviders(true)}
                  className="px-10 py-5 rounded-full bg-primary text-on-primary font-semibold hover-lift flex items-center gap-3 cursor-pointer shadow-lg hover:shadow-primary/25"
                >
                  Get Started
                  <ArrowRight className="size-5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="connect"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg glass-panel p-8 rounded-[32px] shadow-xl flex justify-center"
            >
              <ConnectAccount onBack={() => setShowProviders(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bento Grid Visualization */}
        <section id="features" className="w-full mt-32 grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
          {/* Main Preview Card */}
          <div className="md:col-span-7 min-h-[400px] rounded-[32px] glass-panel p-8 flex flex-col justify-between hover-lift">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="text-base font-bold text-primary">Intelligence Core</div>
                <div className="text-sm text-secondary opacity-60">Ranking 142 signals...</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                <Brain className="size-6 text-on-primary" />
              </div>
            </div>
            
            <div className="flex-1 mt-8 space-y-4">
              <div className="h-16 w-full rounded-2xl bg-white/40 dark:bg-white/5 flex items-center px-6 gap-4 border border-white/20 dark:border-white/5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center">
                  <Mail className="size-4 text-primary" />
                </div>
                <div className="flex-1 h-2 bg-outline-variant/30 rounded-full relative overflow-hidden">
                  <div className="absolute inset-0 shimmer" />
                </div>
                <div className="text-xs font-semibold text-primary">High Priority</div>
              </div>

              <div className="h-16 w-3/4 rounded-2xl bg-white/40 dark:bg-white/5 flex items-center px-6 gap-4 border border-white/20 dark:border-white/5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center">
                  <Calendar className="size-4 text-tertiary" />
                </div>
                <div className="flex-1 h-2 bg-outline-variant/30 rounded-full" />
              </div>
            </div>

            <div className="text-sm text-secondary italic mt-6">
              "lexas identified a conflict in your 2PM stand-up."
            </div>
          </div>

          {/* Sidebar Bento Item 1 */}
          <div className="md:col-span-5 flex flex-col gap-6">
            <div className="flex-1 min-h-[220px] rounded-[32px] bg-primary p-8 flex flex-col justify-between hover-lift overflow-hidden group relative">
              <div className="space-y-2 z-10">
                <div className="text-xs uppercase tracking-widest text-primary-fixed-dim/80 font-bold">The Morning Brief</div>
                <div className="text-2xl font-bold text-white">Delivered at 6:00 AM.</div>
              </div>
              <div className="relative h-20 mt-4 self-end z-10">
                <Sparkles className="size-16 text-primary-fixed/20 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Gradient glow */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700 pointer-events-none" />
            </div>

            <div className="h-[120px] rounded-[32px] glass-panel p-6 flex items-center justify-between hover-lift cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-on-tertiary-container flex items-center justify-center">
                  <Shield className="size-5 text-white" />
                </div>
                <div>
                  <div className="text-base font-bold text-primary">End-to-End</div>
                  <div className="text-xs text-secondary opacity-60">Privacy First AI</div>
                </div>
              </div>
              <ArrowUpRight className="size-5 text-outline" />
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="mt-32 w-full text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-secondary mb-12 opacity-50 font-semibold">Integrated with your workflow</p>
          <div className="flex flex-wrap justify-center items-center gap-16 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-xl font-bold tracking-tight">Google</span>
            </div>
            <div className="flex items-center gap-3 text-[#1f1f21] dark:text-[#fbf9fa]">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <rect x="0" y="0" width="11" height="11" fill="currentColor" />
                <rect x="13" y="0" width="11" height="11" fill="currentColor" />
                <rect x="0" y="13" width="11" height="11" fill="currentColor" />
                <rect x="13" y="13" width="11" height="11" fill="currentColor" />
              </svg>
              <span className="text-xl font-bold tracking-tight">Microsoft</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[1200px] py-12 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center border-t border-outline-variant/10 mt-12 gap-8 z-10">
        <div className="flex items-center gap-8">
          <span className="text-primary font-bold lowercase">lexas</span>
          <span className="text-xs text-secondary opacity-40">© 2026</span>
        </div>
        <div className="flex gap-8">
          <a className="text-xs text-secondary hover:text-primary transition-colors" href="#">Privacy</a>
          <a className="text-xs text-secondary hover:text-primary transition-colors" href="#">Terms</a>
          <a className="text-xs text-secondary hover:text-primary transition-colors" href="#">Status</a>
        </div>
      </footer>
    </div>
  );
}
