/**
 * One-shot calendar processing state.
 *
 * Tracks which emails have already been auto-processed for calendar/reminder
 * creation via the hook system. Once an email is marked as processed, the
 * auto-trigger is suppressed — the user must explicitly instruct the AI to
 * create further events or reminders for that email.
 *
 * Manual tool calls (add_to_calendar, create_reminder) always work regardless
 * of this state — it only gates the automatic hook trigger.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { CALENDAR_STATE_FILE } from '../config/xdg.js';

export type CalendarAction = 'event' | 'reminder' | 'both' | 'skipped';

export interface ProcessedEntry {
  processedAt: string;
  action: CalendarAction;
  title?: string;
}

interface StateFile {
  processedEmails: Record<string, ProcessedEntry>;
}

function stateKey(accountName: string, emailId: string): string {
  return `${accountName.replace(/\s+/g, '_')}__${emailId}`;
}

async function readState(): Promise<StateFile> {
  try {
    const raw = await readFile(CALENDAR_STATE_FILE, 'utf8');
    return JSON.parse(raw) as StateFile;
  } catch {
    return { processedEmails: {} };
  }
}

async function writeState(state: StateFile): Promise<void> {
  await mkdir(dirname(CALENDAR_STATE_FILE), { recursive: true });
  await writeFile(CALENDAR_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/** Returns true if this email has already been auto-processed by the hook system. */
export async function isCalendarProcessed(accountName: string, emailId: string): Promise<boolean> {
  const state = await readState();
  return stateKey(accountName, emailId) in state.processedEmails;
}

/** Marks an email as processed so the hook auto-trigger won't fire again. */
export async function markCalendarProcessed(
  accountName: string,
  emailId: string,
  action: CalendarAction,
  title?: string,
): Promise<void> {
  const state = await readState();
  state.processedEmails[stateKey(accountName, emailId)] = {
    processedAt: new Date().toISOString(),
    action,
    title,
  };
  await writeState(state);
}

/** Returns all processed entries (for inspection/debugging). */
export async function listCalendarProcessed(): Promise<
  { key: string; entry: ProcessedEntry }[]
> {
  const state = await readState();
  return Object.entries(state.processedEmails).map(([key, entry]) => ({ key, entry }));
}
