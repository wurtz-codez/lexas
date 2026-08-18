import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import type { BriefItemDetail } from '@/types';
import { ActionDock } from './action-dock';
import { BackgroundCard, SwipeCard } from './swipe-card';
import type { ExitSignal, TriageAction } from './deck-types';

type HistoryEntry = { item: BriefItemDetail; action: TriageAction };

// The deck treats the LAST element of the queue as the top card. The backend
// returns items rank-ascending (rank 1 = most important), so reverse that so the
// most important mail is on top of the deck, followed by less important ones.
function orderedQueue(items: BriefItemDetail[]): BriefItemDetail[] {
  return [...items].sort((a, b) => b.rank - a.rank);
}

function TriageComplete({ kept, archived }: { kept: number; archived: number }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-2xl shadow-black/5 backdrop-blur-xl dark:bg-slate-900/40">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/40 shadow-lg shadow-black/5 backdrop-blur-md">
        <CheckCheck className="size-7 text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold">All triaged</h3>
      <p className="text-sm text-muted-foreground">
        {kept} kept · {archived} archived
      </p>
    </div>
  );
}

export function SwipeDeck({
  items,
  onDecision,
}: {
  items: BriefItemDetail[];
  onDecision: (item: BriefItemDetail, action: TriageAction) => Promise<void> | void;
}) {
  const [queue, setQueue] = useState<BriefItemDetail[]>(() => orderedQueue(items));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [counts, setCounts] = useState({ keep: 0, archive: 0 });
  const [exitSignal, setExitSignal] = useState<ExitSignal>(null);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Keep queue items in sync with freshly refetched data (e.g. feedback state)
  // without re-adding cards that were already swiped away.
  useEffect(() => {
    if (items.length === 0) return;
    const latestById = new Map(items.map((it) => [it.id, it]));
    setQueue((q) => q.map((card) => latestById.get(card.id) ?? card));
  }, [items]);

  const finalize = useCallback(
    async (action: TriageAction) => {
      const top = queueRef.current[queueRef.current.length - 1];
      if (!top) return;
      setExitSignal(null);
      setQueue((q) => q.slice(0, -1));
      setHistory((h) => [...h, { item: top, action }]);
      setCounts((c) => ({ ...c, [action]: c[action] + 1 }));
      try {
        await onDecision(top, action);
      } catch {
        // Decision could not be recorded — put the card back.
        setQueue((q) => [...q, top]);
        setHistory((h) => h.slice(0, -1));
        setCounts((c) => ({ ...c, [action]: c[action] - 1 }));
      }
    },
    [onDecision],
  );

  const trigger = useCallback((action: TriageAction) => {
    if (queueRef.current.length === 0) return;
    setExitSignal({ action, ts: Date.now() });
  }, []);

  const undo = useCallback(() => {
    const last = historyRef.current[historyRef.current.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setQueue((q) => [...q, last.item]);
    setCounts((c) => ({ ...c, [last.action]: c[last.action] - 1 }));
  }, []);

  useEffect(() => {    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.closest?.('[role="dialog"]')) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'l') {
        e.preventDefault();
        trigger('keep');
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        trigger('archive');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trigger, undo]);

  if (queue.length === 0) {
    return <TriageComplete kept={counts.keep} archived={counts.archive} />;
  }

  return (
    <div className="relative flex w-full flex-col items-center gap-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-10 right-1/4 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative h-[460px] w-full max-w-xl">
        {queue.map((item, i) => {
          const isTop = i === queue.length - 1;
          const depth = queue.length - 1 - i;
          if (isTop) {
            return (
              <SwipeCard
                key={item.id}
                item={item}
                exitSignal={exitSignal}
                onSwipe={finalize}
              />
            );
          }
          return <BackgroundCard key={item.id} item={item} depth={depth} />;
        })}
      </div>

      <ActionDock
        onDiscard={() => trigger('archive')}
        onKeep={() => trigger('keep')}
        onUndo={undo}
        canUndo={history.length > 0}
      />

      <p className="text-xs text-muted-foreground">
        ← or H Archive · → or L Keep · ⌘Z / Ctrl+Z Undo
      </p>
    </div>
  );
}
