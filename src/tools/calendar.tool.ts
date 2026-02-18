/**
 * MCP Tool: extract_calendar
 *
 * Extracts calendar/ICS events from an email.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type CalendarService from '../services/calendar.service.js';
import type ImapService from '../services/imap.service.js';

export default function registerCalendarTools(
  server: McpServer,
  imapService: ImapService,
  calendarService: CalendarService,
): void {
  server.tool(
    'extract_calendar',
    'Extract calendar events (ICS/iCalendar) from an email. Returns structured event data including time, location, attendees, and status.',
    {
      account: z.string().describe('Account name'),
      email_id: z.string().describe('Email UID'),
      mailbox: z.string().default('INBOX').describe('Mailbox path (default: INBOX)'),
    },
    async ({ account, email_id: emailId, mailbox }) => {
      // Get email for subject
      const email = await imapService.getEmail(account, emailId, mailbox);

      // Extract ICS content from body structure
      const icsContents = await imapService.getCalendarParts(account, mailbox, emailId);

      if (icsContents.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  email_subject: email.subject,
                  events: [],
                  count: 0,
                  message: 'No calendar/ICS content found in this email',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const events = calendarService.extractFromParts(icsContents);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                email_subject: email.subject,
                events,
                count: events.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
