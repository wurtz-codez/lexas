import { useCallback } from 'react';
import { CalendarCheck2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBrief, useRefreshBrief, useSubmitFeedback, todayLocal } from '@/features/brief/hooks';
import { SwipeDeck } from '@/features/brief/components/swipe-deck';
import type { BriefItemDetail } from '@/types';
import type { TriageAction } from '@/features/brief/components/deck-types';

function formatBriefDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function BriefView() {
  const { data, isLoading, isError, error } = useBrief();
  const refresh = useRefreshBrief();
  const feedback = useSubmitFeedback();

  const handleRefresh = useCallback(async () => {
    try {
      const result = await refresh.mutateAsync();
      if (result.errors.length > 0) {
        toast.error(`Sync had issues: ${result.errors.join('; ')}`);
      } else {
        toast.success('Brief updated');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    }
  }, [refresh]);

  const handleDecision = useCallback(
    (item: BriefItemDetail, action: TriageAction) =>
      feedback.mutateAsync({
        briefItemId: item.id,
        type: action === 'keep' ? 'important' : 'not_important',
      }),
    [feedback],
  );

  const dateLabel = data?.brief_date
    ? formatBriefDate(data.brief_date)
    : formatBriefDate(todayLocal());

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your Brief</h2>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refresh.isPending}
          variant="outline"
          className="gap-2"
        >
          {refresh.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {refresh.isPending ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm font-medium text-destructive">Couldn't load your brief</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Something went wrong.'}
            </p>
          </CardContent>
        </Card>
      ) : data === null ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarCheck2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No brief yet</p>
            <p className="text-sm text-muted-foreground">
              Hit refresh to pull in your latest email and calendar and generate today's brief.
            </p>
          </CardContent>
        </Card>
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarCheck2 className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">You're all caught up</p>
            <p className="text-sm text-muted-foreground">
              Nothing needs your attention for this day.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SwipeDeck key={data.id} items={data.items} onDecision={handleDecision} />
      )}
    </div>
  );
}
