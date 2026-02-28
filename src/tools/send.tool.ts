/**
 * send.tool.ts — PERMANENTLY DISABLED
 *
 * carponoid/email-mcp security fork:
 * send_email, reply_email, and forward_email have been removed from this server.
 *
 * This MCP server is intentionally READ + DRAFT ONLY.
 * No email can ever be sent, replied to, or forwarded via MCP tools.
 * Drafts can be saved (save_draft) for human review and sent manually
 * via a trusted email client.
 *
 * If you need to re-enable sending, you must revert this fork to upstream:
 *   https://github.com/codefuturist/email-mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type SmtpService from '../services/smtp.service.js';

/**
 * This function intentionally does NOTHING and registers NO tools.
 * It exists only to satisfy the import in register.ts without breaking the build.
 *
 * send_email, reply_email, forward_email are permanently disabled.
 */
export default function registerSendTools(_server: McpServer, _smtpService: SmtpService): void {
  // INTENTIONALLY EMPTY — all send/reply/forward tools are permanently removed.
  // This is a security measure. Do not add tools here.
}
