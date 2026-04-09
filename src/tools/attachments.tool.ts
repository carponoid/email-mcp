/**
 * MCP tool: download_attachment
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type ImapService from '../services/imap.service.js';

const IMAGE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB

export default function registerAttachmentTools(server: McpServer, imapService: ImapService): void {
  // ---------------------------------------------------------------------------
  // download_attachment
  // ---------------------------------------------------------------------------
  server.tool(
    'download_attachment',
    'Download an email attachment by filename. First use get_email to see available attachments and their filenames. Returns base64-encoded content for files ≤5MB.',
    {
      account: z.string().describe('Account name from list_accounts'),
      id: z.string().describe('Email ID (UID) from list_emails or get_email'),
      mailbox: z.string().default('INBOX').describe('Mailbox containing the email'),
      filename: z.string().describe('Exact attachment filename (from get_email metadata)'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ account, id, mailbox, filename }) => {
      try {
        const result = await imapService.downloadAttachment(account, id, mailbox, filename);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  filename: result.filename,
                  mimeType: result.mimeType,
                  size: result.size,
                  sizeHuman: `${Math.round(result.size / 1024)}KB`,
                },
                null,
                2,
              ),
            },
            {
              type: 'text' as const,
              text: `\n--- Base64 Content ---\n${result.contentBase64}`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Failed to download attachment: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  // ---------------------------------------------------------------------------
  // get_inline_image
  // ---------------------------------------------------------------------------
  server.tool(
    'get_inline_image',
    'Fetch an image embedded inline in an HTML email body (referenced as cid: in the HTML). ' +
      'First call get_email to see the "🖼️ Inline images" list with CID values, then call this tool. ' +
      'Returns the image directly so multimodal AI models can visually interpret charts, ' +
      'screenshots, logos, and other embedded visuals. ' +
      'Limit: 5 MB per image.',
    {
      account: z.string().describe('Account name from list_accounts'),
      id: z.string().describe('Email ID (UID) from list_emails or get_email'),
      mailbox: z.string().default('INBOX').describe('Mailbox containing the email'),
      cid: z
        .string()
        .describe(
          'Content-ID of the inline image, without angle brackets (shown in get_email inline images list)',
        ),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ account, id, mailbox, cid }) => {
      try {
        const result = await imapService.downloadInlineImage(
          account,
          id,
          mailbox,
          cid,
          IMAGE_SIZE_LIMIT_BYTES,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Inline image: ${result.filename} | cid:${result.cid} | ${result.mimeType} | ${Math.round(result.size / 1024)}KB`,
            },
            {
              type: 'image' as const,
              data: result.contentBase64,
              mimeType: result.mimeType as `image/${string}`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Failed to get inline image: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
