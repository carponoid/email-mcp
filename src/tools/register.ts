/**
 * Tool registration — single wiring point.
 *
 * carponoid/email-mcp security fork:
 * This server is READ + DRAFT ONLY.
 * send_email, reply_email, forward_email, and send_draft are permanently removed.
 * save_draft is always registered so the AI can compose drafts for human review.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type ConnectionManager from '../connections/manager.js';
import type CalendarService from '../services/calendar.service.js';
import type HooksService from '../services/hooks.service.js';
import type ImapService from '../services/imap.service.js';
import type LocalCalendarService from '../services/local-calendar.service.js';
import type RemindersService from '../services/reminders.service.js';
import type SchedulerService from '../services/scheduler.service.js';
import type SmtpService from '../services/smtp.service.js';
import type TemplateService from '../services/template.service.js';
import type WatcherService from '../services/watcher.service.js';
import type { AppConfig } from '../types/index.js';
import registerAccountsTools from './accounts.tool.js';
import registerAnalyticsTools from './analytics.tool.js';
import registerAttachmentTools from './attachments.tool.js';
import registerBulkTools from './bulk.tool.js';
import registerCalendarTools from './calendar.tool.js';
import registerContactsTools from './contacts.tool.js';
import registerDraftTools from './drafts.tool.js'; // = registerSaveDraftTool (send_draft removed)
import registerEmailsTools from './emails.tool.js';
import registerFolderTools from './folders.tool.js';
import registerHealthTools from './health.tool.js';
import registerLabelTools from './label.tool.js';
import registerLocateTools from './locate.tool.js';
import registerMailboxesTools from './mailboxes.tool.js';
import registerManageTools from './manage.tool.js';
import registerSchedulerTools from './scheduler.tool.js';
import registerSendTools from './send.tool.js'; // stub — registers nothing
import { registerTemplateReadTools, registerTemplateWriteTools } from './templates.tool.js';
import registerThreadTools from './thread.tool.js';
import registerWatcherTools from './watcher.tool.js';

export default function registerAllTools(
  server: McpServer,
  connections: ConnectionManager,
  imapService: ImapService,
  smtpService: SmtpService,
  config: AppConfig,
  templateService: TemplateService,
  calendarService: CalendarService,
  localCalendarService: LocalCalendarService,
  remindersService: RemindersService,
  schedulerService: SchedulerService,
  watcherService: WatcherService,
  hooksService: HooksService,
): void {
  const { readOnly } = config.settings;

  // Read tools — always registered
  registerAccountsTools(server, connections);
  registerMailboxesTools(server, imapService);
  registerEmailsTools(server, imapService);
  registerAttachmentTools(server, imapService);
  registerContactsTools(server, imapService);
  registerThreadTools(server, imapService);
  registerTemplateReadTools(server, templateService);
  registerCalendarTools(
    server,
    imapService,
    calendarService,
    localCalendarService,
    remindersService,
  );
  registerAnalyticsTools(server, imapService);
  registerHealthTools(server, connections, imapService);
  registerLocateTools(server, imapService);
  registerWatcherTools(server, watcherService, hooksService);

  // save_draft — always registered (read+draft mode, no send path)
  // AI can compose drafts; a human must send them via a real email client.
  registerDraftTools(server, imapService);

  // send.tool stub — registers NOTHING (send_email/reply_email/forward_email are gone)
  registerSendTools(server, smtpService);

  // Non-send write tools — still gated by readOnly for extra safety
  if (!readOnly) {
    registerManageTools(server, imapService);
    registerLabelTools(server, imapService);
    registerBulkTools(server, imapService);
    registerFolderTools(server, imapService);
    registerTemplateWriteTools(server, templateService, imapService, smtpService);
    registerSchedulerTools(server, schedulerService);
  }
}
