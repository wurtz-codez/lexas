import { ipcMain } from 'electron';
import { getDb } from './database';
import { generateBrief } from './context-engine';
import type { BriefResult } from './context-engine';

export function registerBriefHandlers(): void {
  ipcMain.handle('brief:generate', async (_event, date: string): Promise<BriefResult> => {
    process.stderr.write(`[brief:generate] Generating brief for ${date}\n`);
    const db = getDb();
    return generateBrief(db, date);
  });
}
