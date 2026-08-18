export type TriageAction = 'keep' | 'archive';

export type ExitSignal = { action: TriageAction; ts: number } | null;
