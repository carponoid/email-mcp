/**
 * MCP tool: get_thread
 *
 * Reconstructs an email conversation thread using References / In-Reply-To
 * header chains. Returns messages in chronological order.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type ImapService from '../services/imap.service.js';

export default function registerThreadTools(server: McpServer, imapService: ImapService): void {
  server.tool(
    'get_thread',
    'Reconstruct a full email conversation thread by following References and In-Reply-To headers. Returns all related messages in chronological order with participant list. Use get_email first to obtain the message_id.',
    {
      account: z.string().describe('Account name from list_accounts'),
      message_id: z.string().describe('Message-ID header value (from get_email)'),
      mailbox: z.string().default('INBOX').describe('Mailbox to search (default: INBOX)'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ account, message_id: messageId, mailbox }) => {
      try {
        const thread = await imapService.getThread(account, messageId, mailbox);

        if (thread.messageCount === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No thread found for Message-ID: ${messageId}`,
              },
            ],
          };
        }

        const parts: string[] = [
          `🧵 Thread: ${thread.messageCount} message${thread.messageCount === 1 ? '' : 's'}`,
          `Thread-ID: ${thread.threadId}`,
          `Participants: ${thread.participants.map((p) => (p.name ? `${p.name} <${p.address}>` : p.address)).join(', ')}`,
          '',
        ];

        thread.messages.forEach((email, idx) => {
          const from = email.from.name
            ? `${email.from.name} <${email.from.address}>`
            : email.from.address;
          parts.push(`--- Message ${idx + 1} of ${thread.messageCount} ---`);
          parts.push(`From: ${from}`);
          parts.push(`To: ${email.to.map((a) => a.address).join(', ')}`);
          parts.push(`Date: ${email.date}`);
          parts.push(`Subject: ${email.subject}`);
          if (email.attachments.length > 0) {
            parts.push(`📎 ${email.attachments.map((a) => a.filename).join(', ')}`);
          }
          parts.push('');
          parts.push(email.bodyText ?? email.bodyHtml ?? '(no content)');
          parts.push('');
        });

        return {
          content: [{ type: 'text' as const, text: parts.join('\n') }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Failed to get thread: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
