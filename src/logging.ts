/**
 * MCP protocol logging bridge.
 *
 * Forwards structured log messages to the connected MCP client
 * via the logging notification channel declared in server capabilities.
 *
 * Usage:
 *   bindServer(server)       — call once after creating the McpServer
 *   mcpLog("info", …)        — fire-and-forget from anywhere
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

let mcpServerRef: McpServer | null = null;

/**
 * Bind an McpServer instance so subsequent `mcpLog()` calls
 * are forwarded to the connected client.
 */
export function bindServer(server: McpServer): void {
  mcpServerRef = server;
}

/**
 * Emit a structured log message over the MCP logging channel.
 *
 * Safe to call before the server is connected or after it is closed —
 * the message is silently dropped in those cases.
 */
export async function mcpLog(level: LogLevel, logger: string, data: unknown): Promise<void> {
  if (!mcpServerRef?.isConnected()) return;
  try {
    await mcpServerRef.sendLoggingMessage({ level, logger, data });
  } catch {
    // Never let a logging failure break tool execution
  }
}
