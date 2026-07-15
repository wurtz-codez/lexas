import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, CheckCircle } from 'lucide-react';
import type { OnboardingData } from '@/types';

const DOTS = 5;

const STEP_QUESTIONS = [
  'What should I call you?',
  'What do you do?',
  'What are you currently working on?',
  "Who are the people you don't want to miss?",
  'Anything else I should know?',
] as const;

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    role: '',
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
      {/* progress dots */}
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

      {/* step content */}
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
                      ? data.role
                      : step === 2
                        ? ''
                        : step === 3
                          ? ''
                          : data.focusSummary
                }
                orValue={
                  step === 2
                    ? data.projects
                    : step === 3
                      ? data.people
                      : undefined
                }
                onChange={(val) => {
                  setData((d) => {
                    if (step === 2) return { ...d, projects: val as string[] };
                    if (step === 3) return { ...d, people: val as { name: string; email?: string }[] };
                    if (step === 0) return { ...d, displayName: val as string };
                    if (step === 1) return { ...d, role: val as string };
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

      {/* skip / next */}
      {step < DOTS && (
        <p className="fixed bottom-8 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            {(step === 0 && data.displayName) ||
            (step === 1 && data.role) ||
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
  value: string;
  orValue?: string[] | { name: string; email?: string }[];
  onChange: (val: string | string[] | { name: string; email?: string }[]) => void;
  onEnter: () => void;
  step: number;
};

function QuestionStep({ question, value, orValue, onChange, onEnter, step }: StepProps) {
  if (step === 2) {
    return (
      <ProjectListStep
        projects={orValue as string[]}
        onChange={onChange}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  if (step === 3) {
    return (
      <PeopleListStep
        people={orValue as { name: string; email?: string }[]}
        onChange={onChange}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  if (step === 4) {
    return (
      <TextareaStep
        value={value}
        onChange={(v) => onChange(v)}
        question={question}
        onEnter={onEnter}
      />
    );
  }
  return (
    <TextStep
      value={value}
      onChange={(v) => onChange(v)}
      question={question}
      onEnter={onEnter}
      placeholder={
        step === 0
          ? 'e.g. Lucky or Wurtz'
          : 'e.g. Founder building a fintech startup'
      }
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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-6" onClick={() => inputRef.current?.focus()}>
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <Input
        ref={inputRef}
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

function ProjectListStep({
  projects,
  onChange,
  question,
  onEnter,
}: {
  projects: string[];
  onChange: (v: string[]) => void;
  question: string;
  onEnter: () => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    if (input.trim()) {
      onChange([...projects, input.trim()]);
      setInput('');
    }
  };

  const remove = (i: number) => {
    onChange(projects.filter((_, idx) => idx !== i));
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <div className="flex gap-2">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (input.trim()) {
                add();
              } else {
                onEnter();
              }
            }
          }}
          placeholder="Type a project and press Enter"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={add}
          disabled={!input.trim()}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm"
            >
              {p}
              <button
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold tracking-tight">{question}</h2>
      <p className="text-sm text-muted-foreground -mt-4">
        If an email from these people shows up, always flag it
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (name.trim()) {
                add();
              } else {
                onEnter();
              }
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
              if (name.trim() || email.trim()) {
                add();
              } else {
                onEnter();
              }
            }
          }}
          placeholder="Email (optional)"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={add}
          disabled={!name.trim()}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {people.length > 0 && (
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
      )}
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
