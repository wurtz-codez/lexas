import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BriefDetail, FeedbackType, RunAllSyncResult } from '@/types';

const BRIEF_KEY = ['brief', 'latest'] as const;

// todayLocal() caveat: brief_date is the LOCAL calendar day, but the ranking
// engine matches date(si.occurred_at) in UTC. A user syncing ~9pm-midnight local
// in a timezone ahead of UTC (mirrored behind UTC) can get a brief generated for
// the wrong calendar date right at that boundary. If "brief showed up on the
// wrong day" is ever reported, revisit timezone handling here first.
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useBrief() {
  return useQuery({
    queryKey: BRIEF_KEY,
    queryFn: (): Promise<BriefDetail | null> => window.electron.brief.getLatest(),
    staleTime: 30_000,
  });
}

export function useRefreshBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RunAllSyncResult> => {
      const sync = await window.electron.sync.runAll();
      await window.electron.brief.generate(todayLocal());
      return sync;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BRIEF_KEY });
    },
  });
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ briefItemId, type }: { briefItemId: number; type: FeedbackType }) =>
      window.electron.feedback.submit(briefItemId, type),
    onMutate: async ({ briefItemId, type }) => {
      await queryClient.cancelQueries({ queryKey: BRIEF_KEY });
      const previous = queryClient.getQueryData<BriefDetail | null>(BRIEF_KEY);
      queryClient.setQueryData<BriefDetail | null>(BRIEF_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((it) =>
            it.id === briefItemId
              ? { ...it, feedback: { type, created_at: new Date().toISOString() } }
              : it,
          ),
        };
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(BRIEF_KEY, context.previous);
      }
      toast.error(err instanceof Error ? err.message : 'Feedback failed to save');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BRIEF_KEY });
    },
  });
}
