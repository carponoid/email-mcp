/**
 * MCP tools: save_draft, draft_reply, draft_reply_all
 *
 * NOTE (carponoid fork): send_draft has been permanently removed.
 * This server operates in read+draft-only mode. Sending email via MCP
 * is intentionally disabled for security. Drafts can be saved for human
 * review and sent manually via a proper email client.
 *
 * All three tools support:
 *   - plain text body
 *   - HTML body (if provided alongside body, creates multipart/alternative)
 *   - file attachments (base64-encoded content)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import audit from '../safety/audit.js';

import type ImapService from '../services/imap.service.js';

// SmtpService is intentionally NOT imported — no send path exists in this fork.

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const attachmentSchema = z.object({
  filename: z.string().min(1).max(255).describe('Attachment filename, e.g. "report.pdf"'),
  mime_type: z
    .string()
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/,
      'Must be a valid MIME type, e.g. "application/pdf"',
    )
    .describe('MIME type of the attachment, e.g. "application/pdf"'),
  content_base64: z
    .string()
    .max(7_000_000) // ~5 MB decoded — consistent with download_attachment cap
    .describe('Base64-encoded file content'),
});

/**
 * Registers only the save_draft, draft_reply, and draft_reply_all tools.
 * Sending drafts is not available.
 */
export default function registerDraftTools(server: McpServer, imapService: ImapService): void {
  // ---------------------------------------------------------------------------
  // save_draft
  // ---------------------------------------------------------------------------
  server.tool(
    'save_draft',
    'Save a new email draft to the Drafts folder. Supports plain text, HTML, and file attachments. Use list_emails with the Drafts mailbox to review saved drafts.',
    {
      account: z.string().describe('Account name from list_accounts'),
      to: z
        .array(z.string().email())
        .default([])
        .describe('Recipient email addresses (can be empty while drafting)'),
      subject: z.string().describe('Email subject'),
      body: z
        .string()
        .describe(
          'Plain text body. Always include this for email clients that do not render HTML.',
        ),
      html_body: z
        .string()
        .optional()
        .describe(
          'HTML version of the body. When provided together with body, the draft becomes a multipart/alternative message with both formats.',
        ),
      cc: z.array(z.string().email()).optional().describe('CC recipients'),
      bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      in_reply_to: z
        .string()
        .optional()
        .describe('Message-ID of the email being replied to, for threading (from get_email)'),
      attachments: z
        .array(attachmentSchema)
        .optional()
        .describe('File attachments to include in the draft'),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({
      account,
      to,
      subject,
      body,
      html_body,
      cc,
      bcc,
      in_reply_to: inReplyTo,
      attachments,
    }) => {
      try {
        const result = await imapService.saveDraft(account, {
          to,
          subject,
          body,
          htmlBody: html_body,
          cc,
          bcc,
          inReplyTo,
          attachments: attachments?.map((a) => ({
            filename: a.filename,
            mimeType: a.mime_type,
            contentBase64: a.content_base64,
          })),
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
          content: [{ type: 'text' as const, text: `Failed to save draft: ${errMsg}` }],
        };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // draft_reply
  // ---------------------------------------------------------------------------
  server.tool(
    'draft_reply',
    'Save a reply draft addressed only to the original sender. Threading headers (In-Reply-To, References) and subject prefix ("Re:") are set automatically. Supports plain text, HTML, and attachments.',
    {
      account: z.string().describe('Account name from list_accounts'),
      email_id: z.string().describe('UID of the email to reply to (from list_emails or get_email)'),
      mailbox: z.string().default('INBOX').describe('Mailbox that contains the original email'),
      body: z.string().describe('Plain text reply body'),
      html_body: z
        .string()
        .optional()
        .describe(
          'HTML version of the reply body (creates multipart/alternative when combined with body)',
        ),
      bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      attachments: z
        .array(attachmentSchema)
        .optional()
        .describe('File attachments to include in the reply draft'),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ account, email_id, mailbox, body, html_body, bcc, attachments }) => {
      try {
        const result = await imapService.saveDraftReply(account, email_id, mailbox, {
          body,
          htmlBody: html_body,
          replyAll: false,
          bcc,
          attachments: attachments?.map((a) => ({
            filename: a.filename,
            mimeType: a.mime_type,
            contentBase64: a.content_base64,
          })),
        });

        await audit.log('draft_reply', account, { email_id, mailbox }, 'ok');

        return {
          content: [
            {
              type: 'text' as const,
              text: `📝 Reply draft saved (ID: ${result.id}, folder: ${result.mailbox}).`,
            },
          ],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await audit.log('draft_reply', account, { email_id, mailbox }, 'error', errMsg);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Failed to save reply draft: ${errMsg}` }],
        };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // draft_reply_all
  // ---------------------------------------------------------------------------
  server.tool(
    'draft_reply_all',
    'Save a Reply All draft — addresses the original sender in To and all other original recipients in Cc (excluding yourself). Threading headers and subject prefix are set automatically. Supports plain text, HTML, and attachments.',
    {
      account: z.string().describe('Account name from list_accounts'),
      email_id: z.string().describe('UID of the email to reply to (from list_emails or get_email)'),
      mailbox: z.string().default('INBOX').describe('Mailbox that contains the original email'),
      body: z.string().describe('Plain text reply body'),
      html_body: z
        .string()
        .optional()
        .describe(
          'HTML version of the reply body (creates multipart/alternative when combined with body)',
        ),
      extra_cc: z
        .array(z.string().email())
        .optional()
        .describe('Additional recipients to add to Cc beyond those already on the original thread'),
      bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      attachments: z
        .array(attachmentSchema)
        .optional()
        .describe('File attachments to include in the reply draft'),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ account, email_id, mailbox, body, html_body, extra_cc, bcc, attachments }) => {
      try {
        const result = await imapService.saveDraftReply(account, email_id, mailbox, {
          body,
          htmlBody: html_body,
          replyAll: true,
          cc: extra_cc,
          bcc,
          attachments: attachments?.map((a) => ({
            filename: a.filename,
            mimeType: a.mime_type,
            contentBase64: a.content_base64,
          })),
        });

        await audit.log('draft_reply_all', account, { email_id, mailbox }, 'ok');

        return {
          content: [
            {
              type: 'text' as const,
              text: `📝 Reply-all draft saved (ID: ${result.id}, folder: ${result.mailbox}).`,
            },
          ],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await audit.log('draft_reply_all', account, { email_id, mailbox }, 'error', errMsg);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Failed to save reply-all draft: ${errMsg}` }],
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
