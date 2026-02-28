/**
 * MCP tools: save_draft
 *
 * NOTE (carponoid fork): send_draft has been permanently removed.
 * This server operates in read+draft-only mode. Sending email via MCP
 * is intentionally disabled for security. Drafts can be saved for human
 * review and sent manually via a proper email client.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import audit from '../safety/audit.js';

import type ImapService from '../services/imap.service.js';

// SmtpService is intentionally NOT imported — no send path exists in this fork.

/**
 * Registers only the save_draft tool. Sending drafts is not available.
 */
export default function registerDraftTools(server: McpServer, imapService: ImapService): void {
  // ---------------------------------------------------------------------------
  // save_draft
  // ---------------------------------------------------------------------------
  server.tool(
    'save_draft',
    'Save an email draft to the Drafts folder. Compose over time, then use send_draft to send it. Use list_emails with the Drafts mailbox to see saved drafts.',
    {
      account: z.string().describe('Account name from list_accounts'),
      to: z
        .array(z.string().email())
        .default([])
        .describe('Recipient email addresses (can be empty for drafts)'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body content'),
      cc: z.array(z.string().email()).optional().describe('CC recipients'),
      bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      html: z.boolean().default(false).describe('Send as HTML (default: plain text)'),
      in_reply_to: z.string().optional().describe('Message-ID for threading (from get_email)'),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ account, to, subject, body, cc, bcc, html, in_reply_to: inReplyTo }) => {
      try {
        const result = await imapService.saveDraft(account, {
          to,
          subject,
          body,
          cc,
          bcc,
          html,
          inReplyTo,
        });

        await audit.log('save_draft', account, { to, subject }, 'ok');

        return {
          content: [
            {
              type: 'text' as const,
              text: `📝 Draft saved (ID: ${result.id}, folder: ${result.mailbox}).`,
            },
          ],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await audit.log('save_draft', account, { to, subject }, 'error', errMsg);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Failed to save draft: ${errMsg}`,
            },
          ],
        };
      }
    },
  );
}

/**
 * send_draft is permanently disabled in this fork.
 * Drafts can be saved and must be sent manually via a real email client.
 */
// send_draft intentionally omitted — no send path exists in this fork.
