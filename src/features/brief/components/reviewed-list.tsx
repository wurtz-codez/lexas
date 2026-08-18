import { CalendarDays, Mail, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { BriefItemDetail, FeedbackType } from '@/types';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function feedbackLabel(type: FeedbackType | null): string {
  if (type === 'important') return 'Kept';
  if (type === 'dismissed') return 'Dismissed';
  return 'Archived';
}

export function ReviewedList({
  items,
  onFeedback,
  feedbackPending,
}: {
  items: BriefItemDetail[];
  onFeedback: (syncedItemId: number, type: 'important' | 'not_important') => void;
  feedbackPending: boolean;
}) {
  const reviewed = items
    .filter((it) => it.feedback !== null)
    .sort((a, b) => (b.feedback?.created_at ?? '').localeCompare(a.feedback?.created_at ?? ''));

  if (reviewed.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">Reviewed</h3>
        <p className="text-xs text-muted-foreground">
          {reviewed.length} {reviewed.length === 1 ? 'item' : 'items'} · tap to change your vote
        </p>
      </div>

      <div className="space-y-2">
        {reviewed.map((item) => {
          const current = item.feedback?.type ?? null;

          const thumbClass = (type: FeedbackType): string =>
            current === type
              ? type === 'important'
                ? 'bg-primary/15 text-primary hover:bg-primary/25'
                : 'bg-destructive/15 text-destructive hover:bg-destructive/25'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground';

          return (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium leading-snug">
                    {item.item.source === 'email' ? (
                      <Mail className="size-3.5 shrink-0" />
                    ) : (
                      <CalendarDays className="size-3.5 shrink-0" />
                    )}
                    <span className="truncate">{item.item.title || '(no title)'}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(item.item.occurred_at)}</span>
                    {item.item.sender_email && <span className="truncate">{item.item.sender_email}</span>}
                  </div>
                </div>

                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    current === 'important'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
                  )}
                >
                  {feedbackLabel(current)}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onFeedback(item.synced_item_id, 'important')}
                    disabled={feedbackPending}
                    aria-label="Mark important"
                    className={cn(
                      'rounded-md p-1.5 transition-colors disabled:opacity-50',
                      thumbClass('important'),
                    )}
                  >
                    <ThumbsUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFeedback(item.synced_item_id, 'not_important')}
                    disabled={feedbackPending}
                    aria-label="Mark not important"
                    className={cn(
                      'rounded-md p-1.5 transition-colors disabled:opacity-50',
                      thumbClass('not_important'),
                    )}
                  >
                    <ThumbsDown className="size-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
