/**
 * SMTP service — permanently disabled stub.
 *
 * carponoid/email-mcp security fork:
 * sendEmail, replyToEmail, forwardEmail, and sendDraft are permanently
 * blocked. This server is READ + DRAFT ONLY.
 *
 * No MCP dependency — fully unit-testable.
 */

/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable class-methods-use-this */

import type { IConnectionManager } from '../connections/types.js';
import type RateLimiter from '../safety/rate-limiter.js';
import type { SendResult } from '../types/index.js';
import type ImapService from './imap.service.js';

const SECURITY_MSG =
  'SECURITY BLOCK: Sending email is permanently disabled in this fork. ' +
  'This MCP server is read+draft only. No email can be sent via MCP. ' +
  'Save a draft and send it manually from your email client.';

export default class SmtpService {
  // Constructor signature preserved to match upstream server.ts instantiation.
  // biome-ignore lint/complexity/noUselessConstructor: needed for upstream compat
  constructor(_c: IConnectionManager, _r: RateLimiter, _i: ImapService) {}

  async sendEmail(
    _accountName: string,
    _options: {
      to: string[];
      subject: string;
      body: string;
      cc?: string[];
      bcc?: string[];
      html?: boolean;
    },
  ): Promise<SendResult> {
    throw new Error(SECURITY_MSG);
  }

  async replyToEmail(
    _accountName: string,
    _options: {
      emailId: string;
      mailbox?: string;
      body: string;
      replyAll?: boolean;
      html?: boolean;
    },
  ): Promise<SendResult> {
    throw new Error(SECURITY_MSG);
  }

  async forwardEmail(
    _accountName: string,
    _options: {
      emailId: string;
      mailbox?: string;
      to: string[];
      body?: string;
      cc?: string[];
    },
  ): Promise<SendResult> {
    throw new Error(SECURITY_MSG);
  }

  async sendDraft(_accountName: string, _draftId: number, _mailbox?: string): Promise<SendResult> {
    throw new Error(SECURITY_MSG);
  }
}
