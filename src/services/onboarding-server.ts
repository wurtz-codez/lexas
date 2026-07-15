import { ipcMain } from 'electron';
import { getDb } from './database';
import type { OnboardingData, OnboardingStatus } from '@/types';

export function registerOnboardingHandlers(): void {
  ipcMain.handle('onboarding:save', (_event, data: OnboardingData) => {
    try {
      process.stderr.write(`[onboarding:save] projects=${JSON.stringify(data.projects)} people=${JSON.stringify(data.people)}\n`);
      const db = getDb();

      db.prepare(`
        INSERT INTO user_context (id, display_name, role, focus_summary, updated_at)
        VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          role = excluded.role,
          focus_summary = excluded.focus_summary,
          updated_at = CURRENT_TIMESTAMP
      `).run(data.displayName || null, data.role || null, data.focusSummary || null);
      process.stderr.write('[onboarding:save] user_context OK\n');

      db.prepare('DELETE FROM projects').run();
      const insertProject = db.prepare('INSERT INTO projects (name) VALUES (?)');
      let count = 0;
      for (const name of data.projects) {
        if (name.trim()) { insertProject.run(name.trim()); count++; }
      }
      process.stderr.write(`[onboarding:save] projects OK (${count} inserted)\n`);

      db.prepare('DELETE FROM people WHERE is_vip = 1').run();
      const insertPerson = db.prepare(
        'INSERT OR IGNORE INTO people (name, email, is_vip) VALUES (?, ?, 1)',
      );
      count = 0;
      for (const person of data.people) {
        if (person.name.trim()) {
          const result = insertPerson.run(person.name.trim(), person.email?.trim() || null);
          if (result.changes > 0) count++;
        }
      }
      process.stderr.write(`[onboarding:save] people OK (${count} inserted)\n`);
    } catch (err) {
      process.stderr.write(`[onboarding:save] ERROR: ${err}\n`);
      throw err;
    }
  });

  ipcMain.handle('onboarding:setCompleted', () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO user_context (id, onboarding_completed, updated_at)
      VALUES (1, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        onboarding_completed = 1,
        updated_at = CURRENT_TIMESTAMP
    `).run();
  });

  ipcMain.handle('onboarding:getStatus', (): OnboardingStatus => {
    const db = getDb();

    const row = db
      .prepare(
        'SELECT display_name, role, focus_summary, onboarding_completed FROM user_context WHERE id = 1',
      )
      .get() as
      | {
          display_name: string | null;
          role: string | null;
          focus_summary: string | null;
          onboarding_completed: number;
        }
      | undefined;

    const projects = db
      .prepare('SELECT id, name FROM projects WHERE status = \'active\'')
      .all() as { id: number; name: string }[];

    const people = db
      .prepare('SELECT id, name, email FROM people WHERE is_vip = 1')
      .all() as { id: number; name: string; email: string | null }[];

    return {
      completed: row ? row.onboarding_completed === 1 : false,
      displayName: row?.display_name ?? null,
      role: row?.role ?? null,
      focusSummary: row?.focus_summary ?? null,
      projects,
      people,
    };
  });
}
