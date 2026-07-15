import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import type { OnboardingData } from '@/types';

export function ContextEditor({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    role: '',
    projects: [],
    people: [],
    focusSummary: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loaded = useRef(false);
  const [newProject, setNewProject] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    window.electron.onboarding.getStatus().then((status) => {
      if (cancelled || loaded.current) return;
      loaded.current = true;
      setData({
        displayName: status.displayName || '',
        role: status.role || '',
        projects: status.projects.map((p) => p.name),
        people: status.people.map((p) => ({ name: p.name, email: p.email || undefined })),
        focusSummary: status.focusSummary || '',
      });
    });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await window.electron.onboarding.save(data);
      onClose?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your Context</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit how you want the brief to understand your priorities.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">What should I call you?</label>
        <Input
          value={data.displayName}
          onChange={(e) => setData({ ...data, displayName: e.target.value })}
          placeholder="Display name"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">What do you do?</label>
        <Input
          value={data.role}
          onChange={(e) => setData({ ...data, role: e.target.value })}
          placeholder="Role / title"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Projects you're working on</label>
        <div className="flex gap-2">
          <Input
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newProject.trim()) {
                e.preventDefault();
                setData({ ...data, projects: [...data.projects, newProject.trim()] });
                setNewProject('');
              }
            }}
            placeholder="Project name"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={!newProject.trim()}
            onClick={() => {
              setData({ ...data, projects: [...data.projects, newProject.trim()] });
              setNewProject('');
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.projects.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm"
            >
              {p}
              <button
                onClick={() => setData({ ...data, projects: data.projects.filter((_, idx) => idx !== i) })}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">VIP contacts</label>
        <p className="text-xs text-muted-foreground -mt-2">
          Emails from these people will always be flagged.
        </p>
        <div className="flex gap-2">
          <Input
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Name"
          />
          <Input
            value={newPersonEmail}
            onChange={(e) => setNewPersonEmail(e.target.value)}
            placeholder="Email (optional)"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={!newPersonName.trim()}
            onClick={() => {
              setData({
                ...data,
                people: [
                  ...data.people,
                  { name: newPersonName.trim(), email: newPersonEmail.trim() || undefined },
                ],
              });
              setNewPersonName('');
              setNewPersonEmail('');
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {data.people.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{p.name}</span>
                {p.email && (
                  <span className="ml-2 text-muted-foreground">{p.email}</span>
                )}
              </div>
              <button
                onClick={() => setData({ ...data, people: data.people.filter((_, idx) => idx !== i) })}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Anything else?</label>
        <textarea
          value={data.focusSummary}
          onChange={(e) => setData({ ...data, focusSummary: e.target.value })}
          placeholder="Free text for the LLM to consider..."
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>

      <div className="flex gap-3">
        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}
        {onClose && (
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        )}
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
