import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Plus } from 'lucide-react';
import type { OnboardingData } from '@/types';

const ROLE_OPTIONS = [
  'Student',
  'Founder / Cofounder',
  'Freelancer',
  'Job',
  'Unemployed',
  'Others',
] as const;

export function ContextEditor({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    roles: [],
    projects: [],
    people: [],
    focusSummary: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loaded = useRef(false);
  const [customRole, setCustomRole] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    window.electron.onboarding.getStatus().then((status) => {
      if (cancelled || loaded.current) return;
      loaded.current = true;
      setData({
        displayName: status.displayName || '',
        roles: status.roles || [],
        projects: status.projects.map((p) => ({ name: p.name, description: p.description || '' })),
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

  const toggleRole = (role: string) => {
    if (data.roles.includes(role)) {
      setData({ ...data, roles: data.roles.filter((r) => r !== role) });
    } else {
      setData({ ...data, roles: [...data.roles, role] });
    }
  };

  const addCustomRole = () => {
    if (customRole.trim() && !data.roles.includes(customRole.trim())) {
      setData({ ...data, roles: [...data.roles, customRole.trim()] });
      setCustomRole('');
    }
  };

  const addProject = () => {
    if (newProjectName.trim()) {
      setData({
        ...data,
        projects: [
          ...data.projects,
          { name: newProjectName.trim(), description: newProjectDesc.trim() },
        ],
      });
      setNewProjectName('');
      setNewProjectDesc('');
    }
  };

  const addPerson = () => {
    if (newPersonName.trim()) {
      setData({
        ...data,
        people: [
          ...data.people,
          { name: newPersonName.trim(), email: newPersonEmail.trim() || undefined },
        ],
      });
      setNewPersonName('');
      setNewPersonEmail('');
    }
  };

  const customRoles = data.roles.filter(
    (r) => !(ROLE_OPTIONS as readonly string[]).includes(r),
  );

  return (
    <div className="mx-auto max-w-lg space-y-8 py-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Your Context</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit how you want the brief to understand your priorities.
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">What should I call you?</label>
        <Input
          value={data.displayName}
          onChange={(e) => setData({ ...data, displayName: e.target.value })}
          placeholder="Display name"
        />
      </div>

      {/* Roles */}
      <div className="space-y-3">
        <label className="text-sm font-medium">What do you do?</label>
        <p className="text-xs text-muted-foreground -mt-2">
          Select all that apply
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((role) => {
            const selected = data.roles.includes(role);
            const isOthers = role === 'Others';
            if (isOthers) return null;
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-card text-foreground hover:border-foreground/40'
                }`}
              >
                {role}
                {selected && (
                  <X className="size-3.5" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomRole();
              }
            }}
            placeholder="Add a custom role..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomRole}
            disabled={!customRole.trim()}
            size="icon"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        {customRoles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customRoles.map((role) => (
              <Badge key={role} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-2 text-sm">
                {role}
                <button
                  onClick={() => toggleRole(role)}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Projects */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Projects you're working on</label>
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Add a project
          </p>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addProject();
              }
            }}
            placeholder="Project name"
          />
          <textarea
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addProject}
            disabled={!newProjectName.trim()}
            className="gap-2 self-start"
          >
            <Plus className="size-4" />
            Add Project
          </Button>
        </div>
        {data.projects.length > 0 && (
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {data.projects.map((p, i) => (
              <Card key={i} className="relative">
                <CardContent className="p-3 pr-10">
                  <div className="font-medium text-sm">{p.name}</div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </CardContent>
                <button
                  onClick={() =>
                    setData({ ...data, projects: data.projects.filter((_, idx) => idx !== i) })
                  }
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* VIP Contacts */}
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
            onClick={addPerson}
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
                onClick={() =>
                  setData({ ...data, people: data.people.filter((_, idx) => idx !== i) })
                }
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Focus Summary */}
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
