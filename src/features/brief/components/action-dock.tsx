import { ThumbsDown, ThumbsUp, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function DockButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/40 shadow-lg shadow-black/5 backdrop-blur-md transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40 dark:bg-slate-900/40',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ActionDock({
  onDiscard,
  onKeep,
  onUndo,
  canUndo,
}: {
  onDiscard: () => void;
  onKeep: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-full border border-white/40 bg-white/30 px-5 py-3 shadow-2xl shadow-black/10 backdrop-blur-xl dark:bg-slate-900/30">
      <DockButton label="Archive (←)" onClick={onDiscard} className="text-destructive">
        <ThumbsDown className="size-5" />
      </DockButton>
      <DockButton label="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo} className="text-foreground">
        <Undo2 className="size-5" />
      </DockButton>
      <DockButton label="Keep (→)" onClick={onKeep} className="text-emerald-600 dark:text-emerald-400">
        <ThumbsUp className="size-5" />
      </DockButton>
    </div>
  );
}
