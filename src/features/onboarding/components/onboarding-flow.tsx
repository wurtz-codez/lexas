import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, CheckCircle, Save, ArrowRight, Plus } from 'lucide-react';
import type { OnboardingData } from '@/types';

const DOTS = 5;

const STEP_QUESTIONS = [
  'What should I call you?',
  'What do you do?',
  'What are you currently working on?',
  "Who are the people you don't want to miss?",
  'Anything else I should know?',
] as const;

const ROLE_OPTIONS = [
  'Student',
  'Founder / Cofounder',
  'Freelancer',
  'Job',
  'Unemployed',
  'Others',
] as const;

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    roles: [],
    projects: [],
    people: [],
    focusSummary: '',
  });

  const advance = useCallback(() => {
    if (step < DOTS - 1) {
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [step]);

  const handleComplete = async () => {
    await window.electron.onboarding.save(data);
    await window.electron.onboarding.setCompleted();
    onDone();
  };

  const handleSkip = () => {
    if (step < DOTS - 1) {
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="fixed top-8 flex gap-1.5">
        {Array.from({ length: DOTS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === step
                ? 'bg-foreground'
                : i < step
                  ? 'bg-foreground/40'
                  : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {step < DOTS ? (
              <QuestionStep
                question={STEP_QUESTIONS[step]}
                value={
                  step === 0
                    ? data.displayName
                    : step === 1
                      ? data.roles
                      : step === 2
                        ? data.projects
                        : step === 3
                          ? data.people
                          : data.focusSummary
                }
                onChange={(val) => {
                  setData((d) => {
                    if (step === 2) return { ...d, projects: val as { name: string; description: string }[] };
                    if (step === 3) return { ...d, people: val as { name: string; email?: string }[] };
                    if (step === 0) return { ...d, displayName: val as string };
                    if (step === 1) return { ...d, roles: val as string[] };
                    if (step === 4) return { ...d, focusSummary: val as string };
                    return d;
                  });
                }}
                onEnter={advance}
                step={step}
              />
            ) : (
              <DoneScreen onContinue={handleComplete} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {step < DOTS && (
        <p className="fixed bottom-8 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {(step === 0 && data.displayName) ||
            (step === 1 && data.roles.length > 0) ||
            (step === 2 && data.projects.length > 0) ||
            (step === 3 && data.people.length > 0) ||
            (step === 4 && data.focusSummary)
              ? 'Continue'
              : 'Skip for now'}
          </button>
        </p>
      )}
    </div>
  );
}

type StepProps = {
  question: string;
  value: string | string[] | { name: string; description: string }[] | { name: string; email?: string }[];
  onChange: (val: string | string[] | { name: string; description: string }[] | { name: string; email?: string }[]) => void;
  onEnter: () => void;
  step: number;
};

function QuestionStep({ question, value, onChange, onEnter, step }: StepProps) {
  if (step === 1) {
    return (
      <RolesStep
        roles={value as string[]}
        onChange={onChange}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  if (step === 2) {
    return (
      <ProjectListStep
        projects={value as { name: string; description: string }[]}
        onChange={onChange}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  if (step === 3) {
    return (
      <PeopleListStep
        people={value as { name: string; email?: string }[]}
        onChange={onChange}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  if (step === 4) {
    return (
      <TextareaStep
        value={value as string}
        onChange={(v) => onChange(v)}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  return (
    <TextStep
      value={value as string}
      onChange={(v) => onChange(v)}
      question={question}
      onEnter={onEnter}
      placeholder="e.g. Lucky or Wurtz"
    />
  );
}

function TextStep({
  value,
  onChange,
  question,
  onEnter,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  question: string;
  onEnter: () => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="text-lg h-12"
      />
    </div>
  );
}

function RolesStep({
  roles,
  onChange,
  question,
  onEnter,
}: {
  roles: string[];
  onChange: (v: string[]) => void;
  question: string;
  onEnter: () => void;
}) {
  const [customRole, setCustomRole] = useState('');

  const toggleRole = (role: string) => {
    if (roles.includes(role)) {
      onChange(roles.filter((r) => r !== role));
    } else {
      onChange([...roles, role]);
    }
  };

  const addCustomRole = () => {
    if (customRole.trim() && !roles.includes(customRole.trim())) {
      onChange([...roles, customRole.trim()]);
      setCustomRole('');
    }
  };

  const shownRoles = roles.filter((r) => !(ROLE_OPTIONS as readonly string[]).includes(r));
  const hasOthers = shownRoles.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <p className="text-sm text-muted-foreground -mt-4">
        Select all that apply
      </p>

      <div className="flex flex-wrap gap-2">
        {ROLE_OPTIONS.map((role) => {
          const selected = roles.includes(role);
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
              {selected && <X className="size-3.5" />}
            </button>
          );
        })}
      </div>

      {/* Custom role input */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-muted-foreground/40 text-muted-foreground shrink-0">
          Others
        </span>
        <input
          value={customRole}
          onChange={(e) => setCustomRole(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomRole();
            }
          }}
          placeholder="Type your role..."
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

      {hasOthers && (
        <div className="flex flex-wrap gap-2">
          {shownRoles.map((role) => (
            <Badge key={role} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-2 text-sm">
              {role}
              <button
                onClick={() => onChange(roles.filter((r) => r !== role))}
                className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={onEnter}
        disabled={roles.length === 0}
        className="gap-2 w-full mt-2"
      >
        Proceed
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function ProjectListStep({
  projects,
  onChange,
  question,
  onEnter,
}: {
  projects: { name: string; description: string }[];
  onChange: (v: { name: string; description: string }[]) => void;
  question: string;
  onEnter: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const add = () => {
    if (name.trim()) {
      onChange([...projects, { name: name.trim(), description: description.trim() }]);
      setName('');
      setDescription('');
    }
  };

  const remove = (i: number) => {
    onChange(projects.filter((_, idx) => idx !== i));
  };

  const hasSaved = projects.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Add a project
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Project name"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={!name.trim()}
          className="gap-2 self-start"
        >
          <Save className="size-4" />
          Save
        </Button>
      </div>

      <Button
        type="button"
        onClick={onEnter}
        disabled={!hasSaved}
        className="gap-2 w-full"
      >
        Proceed
        <ArrowRight className="size-4" />
      </Button>

      {hasSaved && (
        <>
          <Separator />
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {projects.map((p, i) => (
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
                  onClick={() => remove(i)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PeopleListStep({
  people,
  onChange,
  question,
  onEnter,
}: {
  people: { name: string; email?: string }[];
  onChange: (v: { name: string; email?: string }[]) => void;
  question: string;
  onEnter: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const add = () => {
    if (name.trim()) {
      onChange([...people, { name: name.trim(), email: email.trim() || undefined }]);
      setName('');
      setEmail('');
    }
  };

  const remove = (i: number) => {
    onChange(people.filter((_, idx) => idx !== i));
  };

  const hasSaved = people.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <p className="text-sm text-muted-foreground -mt-4">
        If an email from these people shows up, always flag it
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Email (optional)"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={!name.trim()}
            className="gap-2 shrink-0"
          >
            <Save className="size-4" />
            Save
          </Button>
        </div>
        <Button
          type="button"
          onClick={onEnter}
          disabled={!hasSaved}
          className="gap-2 w-full"
        >
          Proceed
          <ArrowRight className="size-4" />
        </Button>
      </div>
      {hasSaved && (
        <>
          <Separator />
          <div className="space-y-2">
            {people.map((p, i) => (
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
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TextareaStep({
  value,
  onChange,
  question,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  question: string;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <p className="text-sm text-muted-foreground -mt-4">
        Optional free-text for the LLM to consider
      </p>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder="e.g. I'm heads-down on a fundraise this month"
        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
      />
    </div>
  );
}

function DoneScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <CheckCircle className="size-16 text-primary" />
      <h2 className="text-2xl font-semibold tracking-tight">All set!</h2>
      <p className="text-muted-foreground">
        You can update your context later from Settings.
      </p>
      <Button onClick={onContinue} className="mt-2">
        Go to Lexas
      </Button>
    </div>
  );
}
