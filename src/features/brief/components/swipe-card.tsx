import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { CalendarDays, Mail, Sparkles, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { BriefItemDetail } from '@/types';
import type { ExitSignal, TriageAction } from './deck-types';

const SWIPE_THRESHOLD = 150;
const VELOCITY_THRESHOLD = 700;
const FLY_DISTANCE = 640;

type DragEndInfo = {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function categoryPill(item: BriefItemDetail): { label: string; className: string } {
  if (item.person?.is_vip) {
    return { label: 'VIP', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
  }
  if (item.project) {
    return { label: item.project.name, className: 'bg-primary/10 text-primary' };
  }
  return {
    label: item.item.source === 'email' ? 'Email' : 'Calendar',
    className: 'bg-white/30 text-foreground/70',
  };
}

function feedbackChip(item: BriefItemDetail): { label: string; className: string } | null {
  switch (item.feedback?.type) {
    case 'important':
      return { label: 'Kept', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    case 'not_important':
      return { label: 'Archived', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' };
    case 'dismissed':
      return { label: 'Dismissed', className: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' };
    default:
      return null;
  }
}

export function CardBody({ item, dimmed }: { item: BriefItemDetail; dimmed?: boolean }) {
  const senderName = item.person?.name ?? item.item.sender_email ?? 'Unknown';
  const senderEmail = item.item.sender_email;
  const pill = categoryPill(item);
  const chip = feedbackChip(item);

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className={cn('h-11 w-11', dimmed && 'opacity-80')}>
            <AvatarFallback className="bg-gradient-to-br from-primary/25 to-indigo-400/25 text-sm font-semibold">
              {initials(senderName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{senderName}</p>
              {item.person?.is_vip && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
            </div>
            {senderEmail && (
              <p className="truncate text-xs text-muted-foreground">{senderEmail}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {chip && (
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md', chip.className)}>
                {chip.label}
              </span>
            )}
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md', pill.className)}>
              {pill.label}
            </span>
          </div>
          <span className="rounded-full bg-white/30 px-2 py-0.5 text-[11px] font-medium text-foreground/70 backdrop-blur-md dark:bg-white/10">
            {formatTime(item.item.occurred_at)}
          </span>
        </div>
      </div>

      <h3 className="text-lg font-bold leading-snug tracking-tight">
        {item.item.title || '(no title)'}
      </h3>

      {item.item.snippet && (
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {item.item.snippet}
        </p>
      )}

      {item.reason && (
        <div className="mt-auto rounded-2xl border border-white/30 bg-white/30 px-3.5 py-2.5 backdrop-blur-md dark:bg-white/5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            Why this matters
          </div>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground/85">{item.reason}</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {item.item.source === 'email' ? (
            <Mail className="size-3.5" />
          ) : (
            <CalendarDays className="size-3.5" />
          )}
          {item.item.source === 'email' ? 'Email' : 'Calendar event'}
        </span>
        <span className="tabular-nums">Rank #{item.rank}</span>
      </div>
    </div>
  );
}

export function SwipeCard({
  item,
  onSwipe,
  exitSignal,
}: {
  item: BriefItemDetail;
  onSwipe: (action: TriageAction) => void;
  exitSignal: ExitSignal;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-16, 16]);
  const keepOpacity = useTransform(x, [20, 120], [0, 1]);
  const archiveOpacity = useTransform(x, [-120, -20], [1, 0]);
  const exited = useRef(false);

  async function flyOff(direction: 'left' | 'right'): Promise<void> {
    await animate(x, direction === 'right' ? FLY_DISTANCE : -FLY_DISTANCE, {
      type: 'spring',
      stiffness: 180,
      damping: 22,
    });
  }

  function handleDragEnd(_event: unknown, info: DragEndInfo): void {
    if (exited.current) return;
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      exited.current = true;
      void flyOff('right').then(() => onSwipe('keep'));
    } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD) {
      exited.current = true;
      void flyOff('left').then(() => onSwipe('archive'));
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }

  useEffect(() => {
    if (!exitSignal || exited.current) return;
    exited.current = true;
    const direction = exitSignal.action === 'keep' ? 'right' : 'left';
    void flyOff(direction).then(() => onSwipe(exitSignal.action));
  }, [exitSignal, onSwipe, x]);

  return (
    <motion.div
      className="absolute inset-0 z-10 select-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-hidden rounded-3xl border border-white/40 bg-white/60 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
        <CardBody item={item} />

        <motion.div
          className="absolute left-5 top-5"
          style={{ opacity: keepOpacity }}
        >
          <span className="inline-flex rotate-[-8deg] items-center gap-1.5 rounded-full border-2 border-emerald-500 bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 backdrop-blur-md dark:text-emerald-400">
            <ThumbsUp className="size-3.5" />
            Keep
          </span>
        </motion.div>

        <motion.div
          className="absolute right-5 top-5"
          style={{ opacity: archiveOpacity }}
        >
          <span className="inline-flex rotate-[8deg] items-center gap-1.5 rounded-full border-2 border-slate-500 bg-slate-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-600 backdrop-blur-md dark:text-slate-300">
            <ThumbsDown className="size-3.5" />
            Archive
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function BackgroundCard({ item, depth }: { item: BriefItemDetail; depth: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 select-none"
      initial={false}
      animate={{
        scale: 1 - depth * 0.05,
        y: depth * 14,
        opacity: Math.max(1 - depth * 0.28, 0.15),
        filter: depth > 0 ? 'blur(2px)' : 'none',
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      aria-hidden
    >
      <div className="h-full overflow-hidden rounded-3xl border border-white/30 bg-white/40 shadow-xl shadow-black/5 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/40">
        <CardBody item={item} dimmed />
      </div>
    </motion.div>
  );
}
