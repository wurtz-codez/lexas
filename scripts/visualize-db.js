#!/usr/bin/env node
const { execSync } = require('child_process');
const db = process.env.HOME + '/Library/Application Support/lexas/data/lexas.db';

function q(sql) {
  try {
    const out = execSync(`sqlite3 -header -column "${db}" "${sql}"`, { encoding: 'utf-8' });
    return out.trim();
  } catch { return ''; }
}

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│                  Lexas Database Schema                  │');
console.log('└─────────────────────────────────────────────────────────┘');
console.log('');

const tables = [
  {
    name: 'user_context',
    desc: 'Your profile / current focus (single row)',
    icon: '👤',
    fks: [],
    sql: 'SELECT id, display_name, role, focus_summary, onboarding_completed, updated_at FROM user_context',
    cols: ['id', 'display_name', 'role', 'focus_summary', 'onboarding_completed', 'updated_at'],
  },
  {
    name: 'people',
    desc: 'Contacts / important people',
    icon: '👥',
    fks: [],
    sql: 'SELECT id, name, email, is_vip, relationship FROM people',
    cols: ['id', 'name', 'email', 'is_vip', 'relationship'],
  },
  {
    name: 'projects',
    desc: 'Projects you are working on',
    icon: '📋',
    fks: [],
    sql: 'SELECT id, name, status FROM projects',
    cols: ['id', 'name', 'status'],
  },
  {
    name: 'project_people',
    desc: 'Which people are on which projects',
    icon: '🔗',
    fks: ['projects', 'people'],
    sql: 'SELECT * FROM project_people',
    cols: ['project_id', 'person_id'],
  },
  {
    name: 'synced_items',
    desc: 'Emails + calendar events (unified)',
    icon: '📧',
    fks: ['people', 'projects'],
    sql: 'SELECT id, source, title, sender_email, person_id, project_id, occurred_at FROM synced_items',
    cols: ['id', 'source', 'title', 'sender_email', 'person_id', 'project_id', 'occurred_at'],
  },
  {
    name: 'auth_tokens',
    desc: 'OAuth tokens (refresh encrypted via Keychain)',
    icon: '🔐',
    fks: [],
    sql: `SELECT provider, email, length(encrypted_refresh_token) as token_bytes, access_token_expiry FROM auth_tokens`,
    cols: ['provider', 'email', 'token_bytes', 'access_token_expiry'],
  },
  {
    name: 'briefs',
    desc: 'Daily generated briefs',
    icon: '📅',
    fks: [],
    sql: 'SELECT * FROM briefs',
    cols: ['id', 'brief_date', 'generated_at'],
  },
  {
    name: 'brief_items',
    desc: 'Ranked items within a brief',
    icon: '🏷️',
    fks: ['briefs', 'synced_items'],
    sql: 'SELECT * FROM brief_items',
    cols: ['id', 'brief_id', 'synced_item_id', 'rank', 'reason', 'score'],
  },
  {
    name: 'feedback',
    desc: 'User feedback on brief items',
    icon: '👍',
    fks: ['brief_items'],
    sql: 'SELECT * FROM feedback',
    cols: ['id', 'brief_item_id', 'feedback_type', 'created_at'],
  },
];

for (const t of tables) {
  const data = q(t.sql);
  const rows = data ? data.split('\n').filter(l => l.trim()) : [];
  const headerRow = rows.length > 0 ? rows[0].replace(/\s+/g, ' │ ').trim() : '(empty)';
  const dataRows = rows.slice(1);

  console.log(`  ${t.icon}  ${t.name}`);
  console.log(`     ${t.desc}`);
  if (t.fks.length) console.log(`     → references: ${t.fks.join(', ')}`);
  console.log(`     ${'─'.repeat(50)}`);

  if (dataRows.length > 0) {
    console.log(`     Columns: ${t.cols.join(', ')}`);
    console.log(`     Rows: ${dataRows.length}`);
    console.log('');
    dataRows.slice(0, 5).forEach(r => {
      console.log(`     │ ${r.replace(/ {2,}/g, '  ').trim()}`);
    });
    if (dataRows.length > 5) console.log(`     │ ... and ${dataRows.length - 5} more`);
  } else {
    console.log('     (no rows)');
  }
  console.log('');
}

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│  Want a GUI? Install DB Browser for SQLite:             │');
console.log('│  brew install --cask db-browser-for-sqlite              │');
console.log('│  Then open: ~/Library/Application\\ Support/lexas/data/  │');
console.log('└─────────────────────────────────────────────────────────┘');
