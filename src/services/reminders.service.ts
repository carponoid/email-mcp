/**
 * macOS Reminders.app integration via JXA (JavaScript for Automation).
 *
 * Lets the AI create reminders from email content — action items, deadlines,
 * follow-ups, etc. — with a native confirmation dialog before adding.
 *
 * Linux: no-op (Reminders.app is macOS-only). Returns a clear error.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReminderPriority = 'none' | 'low' | 'medium' | 'high';

export interface ReminderInput {
  title: string;
  notes?: string;
  /** ISO date string for when the reminder should fire */
  dueDate?: string;
  priority?: ReminderPriority;
  /** Name of the Reminders list to add to (default list if omitted) */
  listName?: string;
}

export type AddReminderStatus = 'added' | 'cancelled' | 'timed_out' | 'no_display';

export interface AddReminderResult {
  status: AddReminderStatus;
  reminderId?: string;
  listName?: string;
  message: string;
}

export interface ReminderListInfo {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// JXA priority mapping: none=0, low=9, medium=5, high=1
// ---------------------------------------------------------------------------

const PRIORITY_MAP: Record<ReminderPriority, number> = {
  none: 0,
  low: 9,
  medium: 5,
  high: 1,
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function reminderStatusMessage(
  status: AddReminderStatus,
  title: string,
  listName: string | undefined,
): string {
  switch (status) {
    case 'added':
      return `\u2705 Reminder added: "${title}" \u2192 ${listName ?? 'Reminders'}.`;
    case 'cancelled':
      return '\uD83D\uDEAB Cancelled \u2014 reminder was not added.';
    case 'timed_out':
      return '\u23F1\uFE0F Dialog timed out \u2014 reminder was not added. Try again.';
    case 'no_display':
      return '\u26A0\uFE0F Cannot add reminder: run check_calendar_permissions to verify access.';
    default:
      return `Unknown status: ${status as string}`;
  }
}

async function checkPermissionsMacOS(): Promise<boolean> {
  const script = `(() => {
    try {
      const r = Application('Reminders');
      return JSON.stringify({ granted: true, count: r.lists().length });
    } catch(e) {
      return JSON.stringify({ granted: false });
    }
  })()`;
  try {
    const { stdout } = await execFile('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: 10_000,
    });
    const parsed = JSON.parse(stdout.trim()) as { granted: boolean };
    return parsed.granted;
  } catch {
    return false;
  }
}

async function listListsMacOS(): Promise<ReminderListInfo[]> {
  const script = `(() => {
    try {
      const r = Application('Reminders');
      return JSON.stringify(r.lists().map(l => {
        try { return { id: l.id(), name: l.name() }; } catch(e) { return null; }
      }).filter(Boolean));
    } catch(e) {
      return JSON.stringify([]);
    }
  })()`;
  try {
    const { stdout } = await execFile('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: 10_000,
    });
    return JSON.parse(stdout.trim()) as ReminderListInfo[];
  } catch {
    return [];
  }
}

function buildReminderJXAScript(input: ReminderInput, confirm: boolean): string {
  const priority = PRIORITY_MAP[input.priority ?? 'none'];

  const t = {
    title: JSON.stringify(input.title),
    notes: JSON.stringify(input.notes ?? ''),
    dueDate: JSON.stringify(input.dueDate ?? ''),
    listName: JSON.stringify(input.listName ?? ''),
    priority: String(priority),
    confirm: confirm ? 'true' : 'false',
  };

  return `(() => {
  const title    = ${t.title};
  const notes    = ${t.notes};
  const dueStr   = ${t.dueDate};
  const listName = ${t.listName};
  const priority = ${t.priority};
  const doConfirm = ${t.confirm};

  const app = Application.currentApplication();
  app.includeStandardAdditions = true;
  const Reminders = Application('Reminders');

  if (doConfirm) {
    const lines = ['\uD83D\uDD14 ' + title];
    if (dueStr)   lines.push('\uD83D\uDD50 Due: ' + new Date(dueStr).toLocaleString('en'));
    if (notes)    lines.push('\uD83D\uDCDD ' + notes.substring(0, 200) + (notes.length > 200 ? '\u2026' : ''));
    if (listName) lines.push('\uD83D\uDCCB List: ' + listName);
    if (priority > 0) {
      const pLabel = priority <= 2 ? 'High' : (priority <= 6 ? 'Medium' : 'Low');
      lines.push('\u26A0\uFE0F Priority: ' + pLabel);
    }

    let dlg;
    try {
      dlg = app.displayDialog(lines.join('\\n'), {
        withTitle: 'email-mcp \u2014 Add Reminder?',
        buttons: ['Cancel', 'Add Reminder'],
        defaultButton: 'Add Reminder',
        cancelButton: 'Cancel',
        givingUpAfter: 60,
      });
    } catch(e) {
      return JSON.stringify({ status: 'cancelled' });
    }
    if (dlg.gaveUp) return JSON.stringify({ status: 'timed_out' });
    if (dlg.buttonReturned !== 'Add Reminder') return JSON.stringify({ status: 'cancelled' });
  }

  let targetList;
  try {
    targetList = listName
      ? Reminders.lists.whose({ name: listName })[0]
      : Reminders.defaultList;
  } catch(e) {
    targetList = Reminders.defaultList;
  }
  if (!targetList) {
    return JSON.stringify({ status: 'no_display', error: 'Reminders list not found' });
  }

  const props = { name: title, completed: false };
  if (notes)    props.body     = notes;
  if (priority) props.priority = priority;
  if (dueStr) {
    try { props.dueDate = new Date(dueStr); } catch(e) {}
  }

  const reminder = Reminders.Reminder(props);
  targetList.reminders.push(reminder);

  let rid = '';
  try { rid = reminder.id(); } catch(e) {}
  let finalList = '';
  try { finalList = targetList.name(); } catch(e) {}

  return JSON.stringify({ status: 'added', reminderId: rid, listName: finalList });
})()`;
}

async function addReminderMacOS(
  input: ReminderInput,
  confirm: boolean,
): Promise<AddReminderResult> {
  const script = buildReminderJXAScript(input, confirm);

  try {
    const { stdout } = await execFile('osascript', ['-l', 'JavaScript', '-e', script], {
      timeout: 90_000,
    });
    const result = JSON.parse(stdout.trim()) as {
      status: AddReminderStatus;
      reminderId?: string;
      listName?: string;
    };
    return {
      status: result.status,
      reminderId: result.reminderId,
      listName: result.listName,
      message: reminderStatusMessage(result.status, input.title, result.listName),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/user canceled|(-128)/i.test(msg)) {
      return { status: 'cancelled', message: 'Cancelled by user.' };
    }
    if (/not authorized|access/i.test(msg)) {
      return {
        status: 'no_display',
        message:
          'Reminders access denied. Go to System Settings \u2192 Privacy \u2192 Reminders and enable Terminal.',
      };
    }
    return { status: 'no_display', message: `Could not add reminder: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export default class RemindersService {
  private readonly platform = process.platform;

  get isSupported(): boolean {
    return this.platform === 'darwin';
  }

  async checkPermissions(): Promise<{
    granted: boolean;
    platform: string;
    instructions: string[];
  }> {
    if (this.platform !== 'darwin') {
      return {
        granted: false,
        platform: this.platform,
        instructions: ['Reminders.app is only available on macOS.'],
      };
    }
    const granted = await checkPermissionsMacOS();
    if (granted) return { granted: true, platform: 'darwin', instructions: [] };
    return {
      granted: false,
      platform: 'darwin',
      instructions: [
        'Reminders access was denied or unavailable.',
        '1. Open System Settings \u2192 Privacy & Security \u2192 Reminders',
        '2. Enable access for Terminal (or your terminal emulator)',
        '3. Quit and restart the terminal, then try again.',
      ],
    };
  }

  async listLists(): Promise<ReminderListInfo[]> {
    if (this.platform !== 'darwin') return [];
    return listListsMacOS();
  }

  async addReminder(
    input: ReminderInput,
    opts: { confirm?: boolean } = {},
  ): Promise<AddReminderResult> {
    if (this.platform !== 'darwin') {
      return {
        status: 'no_display',
        message: 'Reminders.app is only available on macOS.',
      };
    }
    const confirm = opts.confirm !== false;
    return addReminderMacOS(input, confirm);
  }
}
