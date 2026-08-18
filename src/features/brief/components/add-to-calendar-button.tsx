import { useState } from 'react';
import { CalendarPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateEvent } from '@/features/brief/hooks';
import type { BriefItemDetail } from '@/types';

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function AddToCalendarButton({ item }: { item: BriefItemDetail }) {
  const createEvent = useCreateEvent();
  const action = item.suggested_action;
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const openModal = () => {
    if (!action) return;
    setTitle(action.proposed_title);
    setStart(isoToLocalInput(action.proposed_start));
    setEnd(isoToLocalInput(action.proposed_end));
    setOpen(true);
  };

  const confirm = async () => {
    if (!action) return;
    try {
      await createEvent.mutateAsync({
        title,
        start: localInputToIso(start),
        end: localInputToIso(end),
        synced_item_id: item.synced_item_id,
      });
      setAdded(true);
      setOpen(false);
      toast.success('Added to your calendar');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add to calendar');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={added}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/40 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur-md transition-colors hover:bg-white/60 disabled:cursor-default disabled:opacity-60 dark:bg-slate-900/40"
      >
        {added ? (
          <>
            <Check className="size-3.5" />
            Added
          </>
        ) : (
          <>
            <CalendarPlus className="size-3.5" />
            Add to Calendar
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Calendar</DialogTitle>
            <DialogDescription>
              Review and edit before adding — nothing is created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start</label>
                <Input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End</label>
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={createEvent.isPending || !title.trim() || !start || !end}
            >
              {createEvent.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Add to Calendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
