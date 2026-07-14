import type Database from 'better-sqlite3';

export type { Database };

export type UserContext = {
  id: number;
  role: string | null;
  focus_summary: string | null;
  updated_at: string;
};

export type Person = {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  relationship: string | null;
  is_vip: number;
  notes: string | null;
  created_at: string;
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

export type SyncedItem = {
  id: number;
  source: 'email' | 'calendar';
  external_id: string;
  title: string | null;
  snippet: string | null;
  sender_email: string | null;
  person_id: number | null;
  project_id: number | null;
  occurred_at: string | null;
  ends_at: string | null;
  raw_json: string | null;
  synced_at: string;
};

export type Brief = {
  id: number;
  brief_date: string;
  generated_at: string;
};

export type BriefItem = {
  id: number;
  brief_id: number;
  synced_item_id: number;
  rank: number;
  reason: string | null;
  score: number | null;
};

export type Feedback = {
  id: number;
  brief_item_id: number;
  feedback_type: 'important' | 'not_important' | 'dismissed';
  created_at: string;
};
