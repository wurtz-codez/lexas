import { useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDayCalendarEvents, todayLocal } from '@/features/brief/hooks';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatBriefDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric' });
}

export function CalendarEventsButton() {
  const [open, setOpen] = useState(false);
  const date = todayLocal();
  const { data, isLoading, isError, error } = useDayCalendarEvents(date, open);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <CalendarDays className="size-4" />
        Calendar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Today&apos;s Calendar</DialogTitle>
            <DialogDescription>{formatBriefDate(date)}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <p className="py-8 text-center text-sm text-destructive">
                {error instanceof Error ? error.message : "Couldn't load calendar events"}
              </p>
            ) : data && data.length > 0 ? (
              data.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-3 rounded-xl border border-white/40 bg-white/40 p-3 backdrop-blur-md dark:bg-slate-900/40"
                >
                  <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold leading-tight text-primary">
                    <span>{formatTime(ev.occurred_at)}</span>
                    <span className="text-[10px] font-normal text-primary/70">→ {formatTime(ev.ends_at)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ev.title || '(no title)'}</p>
                    {ev.snippet && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ev.snippet}</p>
                    )}
                    {ev.organizer_email && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{ev.organizer_email}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No calendar events for this day.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
