import type Database from 'better-sqlite3';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getGeminiApiKey } from '@/features/brief/config';

const MAX_TOKENS_CEILING = 32000;
const TOKENS_PER_ITEM = 80;
const TOKENS_BASE = 500;
const SNIPPET_MAX_LENGTH = 300;

export type BriefResult = {
  brief_id: number;
  items_ranked: number;
};

export type SuggestedAction = {
  proposed_title: string;
  proposed_start: string;
  proposed_end: string;
};

type RankedItem = {
  synced_item_id: number;
  rank: number;
  reason: string;
  score?: number;
  suggested_action?: SuggestedAction | null;
};

type InputItem = {
  id: number;
  source: string;
  title: string | null;
  sender_email: string | null;
  snippet: string | null;
  occurred_at: string | null;
  person_name: string | null;
  person_is_vip: number | null;
  project_name: string | null;
};

type InputLink = {
  item_id: number;
  related_item_id: number;
  link_type: string;
};

// Items store occurred_at as UTC ISO (e.g. "...T20:05:00.000Z"). The brief is for
// the user's LOCAL calendar day, so `date(occurred_at)` (which yields the UTC date)
// is the wrong filter — a mail sent 1am IST on Aug 19 has a UTC date of Aug 18.
// Instead compute the [start, end) UTC window covering the local day using the
// renderer's timezone offset (minutes to add to local time to get UTC).
export function localDayWindowUtc(date: string, tzOffsetMinutes: number): { startIso: string; endIso: string } {
  const [y, m, d] = date.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000;
  const endMs = Date.UTC(y, m - 1, d + 1) + tzOffsetMinutes * 60_000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

function buildSystemPrompt(role: string | null, focusSummary: string | null, vips: { name: string; email: string | null }[]): string {
  const parts: string[] = ['You are Lexas, an executive assistant ranking engine. Rank items by importance considering the user\'s role, focus areas, VIP contacts, and how items connect to each other.\n'];

  parts.push('User context:');
  parts.push(`- Role: ${role || 'Not specified'}`);
  parts.push(`- Focus: ${focusSummary || 'Not specified'}`);

  if (vips.length > 0) {
    const vipList = vips.map((v) => `${v.name}${v.email ? ` (${v.email})` : ''}`).join(', ');
    parts.push(`- VIPs: ${vipList}`);
  }

  parts.push('\nToday\'s items:');

  parts.push(
    '\nOptional suggested_action: For EMAIL items that clearly imply a scheduled task or meeting, ' +
    'include a suggested_action with a concise proposed_title (calendar event title), and ' +
    'proposed_start/proposed_end as ISO 8601 datetimes resolved from the email\'s occurred_at ' +
    'and any time mentioned in the text. NEVER suggest an action for calendar events. ' +
    'Leave suggested_action out entirely when the email does not imply a schedulable event.',
  );

  return parts.join('\n');
}

function buildUserMessage(items: Record<string, unknown>[], links: InputLink[]): string {
  const parts: string[] = [];

  const itemsJson = JSON.stringify(items, null, 2);
  parts.push(itemsJson);

  parts.push('\nItem links:');
  parts.push(JSON.stringify(links, null, 2));

  parts.push('\nReturn ONLY valid JSON (no markdown, no preamble):');
  parts.push('[{"synced_item_id": 42, "rank": 1, "reason": "...", "score": 0.95}, ...]');

  return parts.join('\n');
}

export async function generateBrief(
  db: Database.Database,
  date: string,
  tzOffsetMinutes: number,
): Promise<BriefResult> {
  const userContext = db.prepare(
    'SELECT role, focus_summary FROM user_context WHERE id = 1',
  ).get() as { role: string | null; focus_summary: string | null } | undefined;

  const vips = db.prepare(
    'SELECT name, email FROM people WHERE is_vip = 1 ORDER BY name',
  ).all() as { name: string; email: string | null }[];

  const { startIso, endIso } = localDayWindowUtc(date, tzOffsetMinutes);

  const items = db.prepare(`
    SELECT
      si.id,
      si.source,
      si.title,
      si.sender_email,
      si.snippet,
      si.occurred_at,
      p.name AS person_name,
      p.is_vip AS person_is_vip,
      pr.name AS project_name
    FROM synced_items si
    LEFT JOIN people p ON si.person_id = p.id
    LEFT JOIN projects pr ON si.project_id = pr.id
    WHERE si.occurred_at >= ? AND si.occurred_at < ?
      AND si.source = 'email'
    ORDER BY si.occurred_at ASC
  `).all(startIso, endIso) as InputItem[];

  const itemIds = items.map((i) => i.id);
  const links = itemIds.length > 0
    ? db.prepare(`
        SELECT item_id, related_item_id, link_type
        FROM item_links
        WHERE item_id IN (${itemIds.map(() => '?').join(',')})
           OR related_item_id IN (${itemIds.map(() => '?').join(',')})
      `).all(...itemIds, ...itemIds) as InputLink[]
    : [];

  const role = userContext?.role ?? null;
  const focusSummary = userContext?.focus_summary ?? null;
  const systemPrompt = buildSystemPrompt(role, focusSummary, vips);

  const itemsForPrompt = items.map((i) => ({
    id: i.id,
    source: i.source,
    title: i.title || '(no title)',
    sender_email: i.sender_email,
    snippet: i.snippet ? i.snippet.slice(0, SNIPPET_MAX_LENGTH) : null,
    occurred_at: i.occurred_at,
    person_name: i.person_name,
    person_vip: i.person_is_vip === 1,
    project_name: i.project_name,
  }));

  const uniqueLinks: InputLink[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const key = [link.item_id, link.related_item_id].sort().join(':');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLinks.push(link);
    }
  }

  const userMessage = buildUserMessage(itemsForPrompt, uniqueLinks);

  const estimatedTokens = items.length * TOKENS_PER_ITEM + TOKENS_BASE;
  const maxTokens = Math.min(estimatedTokens, MAX_TOKENS_CEILING);

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Add it to your .env file.');
  }

  let ranked: RankedItem[] = [];

  if (items.length > 0) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: {
        temperature: 0,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              synced_item_id: { type: SchemaType.INTEGER },
              rank: { type: SchemaType.INTEGER },
              reason: { type: SchemaType.STRING },
              score: { type: SchemaType.NUMBER },
              suggested_action: {
                type: SchemaType.OBJECT,
                nullable: true,
                properties: {
                  proposed_title: { type: SchemaType.STRING },
                  proposed_start: { type: SchemaType.STRING },
                  proposed_end: { type: SchemaType.STRING },
                },
                required: ['proposed_title', 'proposed_start', 'proposed_end'],
              },
            },
            required: ['synced_item_id', 'rank', 'reason', 'score'],
          },
        },
      } as any,
    });

    const response = result.response;
    const rawText = response.text().trim();
    const finishReason = response.candidates?.[0]?.finishReason?.toString();

    if (finishReason === 'MAX_TOKENS') {
      throw new Error(
        `Brief truncated: response cut off at ${maxTokens} tokens ` +
        `(${items.length} items). Finish reason: MAX_TOKENS. ` +
        `Raw response: ${rawText.slice(0, 500)}`,
      );
    }

    try {
      ranked = JSON.parse(rawText) as RankedItem[];
    } catch {
      throw new Error(
        `Brief JSON parse failed. Finish reason: ${finishReason ?? 'none'}. ` +
        `Raw response: ${rawText.slice(0, 500)}`,
      );
    }

    const validIds = new Set(items.map((i) => i.id));
    ranked = ranked.filter((r) => {
      if (!validIds.has(r.synced_item_id)) {
        process.stderr.write(
          `[brief] Skipping unknown synced_item_id ${r.synced_item_id} from LLM response\n`,
        );
        return false;
      }
      return true;
    });
  }

  const replaceBrief = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM briefs WHERE brief_date = ?').get(date) as { id: number } | undefined;
    if (existing) {
      db.prepare('DELETE FROM brief_items WHERE brief_id = ?').run(existing.id);
      db.prepare('DELETE FROM briefs WHERE id = ?').run(existing.id);
    }

    const info = db.prepare(
      'INSERT INTO briefs (brief_date) VALUES (?)',
    ).run(date);
    const briefId = info.lastInsertRowid as number;

    const insertItem = db.prepare(
      'INSERT INTO brief_items (brief_id, synced_item_id, rank, reason, score, suggested_action) VALUES (?, ?, ?, ?, ?, ?)',
    );

    for (const r of ranked) {
      insertItem.run(
        briefId,
        r.synced_item_id,
        r.rank,
        r.reason,
        r.score ?? null,
        r.suggested_action ? JSON.stringify(r.suggested_action) : null,
      );
    }

    return briefId;
  });

  const briefId = replaceBrief();

  process.stderr.write(
    `[brief] Generated brief for ${date}: ${ranked.length} items ranked (brief_id=${briefId})\n`,
  );

  return { brief_id: briefId, items_ranked: ranked.length };
}
