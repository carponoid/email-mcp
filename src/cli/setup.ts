/**
 * Interactive setup wizard for email-mcp.
 *
 * Guides users through account configuration with auto-detection and connection testing.
 */

import fs from 'node:fs/promises';

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  password as p_password,
  spinner as p_spinner,
  select,
  text,
} from '@clack/prompts';
import { parse as parseTOML } from 'smol-toml';
import { CONFIG_FILE, configExists, saveConfig } from '../config/loader.js';
import type { RawAccountConfig, RawAppConfig } from '../config/schema.js';
import { AppConfigFileSchema } from '../config/schema.js';
import ConnectionManager from '../connections/manager.js';
import type { AccountConfig } from '../types/index.js';
import { detectProvider } from './providers.js';

class SetupCancelledError extends Error {
  constructor() {
    super('Setup cancelled.');
  }
}

function assertNotCancel<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel('Setup cancelled.');
    throw new SetupCancelledError();
  }
}

async function promptServerSettings() {
  const imapHost = await text({
    message: 'IMAP host',
    placeholder: 'imap.example.com',
    validate: (v) => (!v || v.length === 0 ? 'IMAP host is required' : undefined),
  });
  assertNotCancel(imapHost);

  const imapPortStr = await text({
    message: 'IMAP port',
    placeholder: '993',
    defaultValue: '993',
  });
  assertNotCancel(imapPortStr);
  const imapPort = parseInt(imapPortStr || '993', 10);

  const imapTls = await confirm({
    message: 'IMAP use TLS?',
    initialValue: true,
  });
  assertNotCancel(imapTls);

  const smtpHost = await text({
    message: 'SMTP host',
    placeholder: 'smtp.example.com',
    validate: (v) => (!v || v.length === 0 ? 'SMTP host is required' : undefined),
  });
  assertNotCancel(smtpHost);

  const smtpPortStr = await text({
    message: 'SMTP port',
    placeholder: '465',
    defaultValue: '465',
  });
  assertNotCancel(smtpPortStr);
  const smtpPort = parseInt(smtpPortStr || '465', 10);

  const smtpSecurity = await select({
    message: 'SMTP security',
    options: [
      { value: 'tls', label: 'TLS (port 465)' },
      { value: 'starttls', label: 'STARTTLS (port 587)' },
      { value: 'none', label: 'None (not recommended)' },
    ],
  });
  assertNotCancel(smtpSecurity);

  return {
    imapHost,
    imapPort,
    imapTls,
    smtpHost,
    smtpPort,
    smtpTls: smtpSecurity === 'tls',
    smtpStarttls: smtpSecurity === 'starttls',
  };
}

export default async function runSetup(): Promise<void> {
  intro('email-mcp setup');

  // Check existing config
  let existingConfig: RawAppConfig | undefined;
  const exists = await configExists();
  if (exists) {
    const action = await select({
      message: `Config file exists at ${CONFIG_FILE}. What would you like to do?`,
      options: [
        { value: 'add', label: 'Add a new account' },
        { value: 'overwrite', label: 'Start fresh (overwrite)' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });

    if (isCancel(action) || action === 'cancel') {
      cancel('Setup cancelled.');
      return;
    }

    if (action === 'add') {
      try {
        const content = await fs.readFile(CONFIG_FILE, 'utf-8');
        existingConfig = parseTOML(content) as unknown as RawAppConfig;
      } catch {
        log.warning('Could not parse existing config. Starting fresh.');
      }
    }
  }

  // Account name
  const accountName = await text({
    message: 'Account name',
    placeholder: 'personal',
    validate: (v) => (!v || v.length === 0 ? 'Account name is required' : undefined),
  });
  assertNotCancel(accountName);

  // Email address
  const email = await text({
    message: 'Email address',
    placeholder: 'you@example.com',
    validate: (v) => (v?.includes('@') ? undefined : 'Please enter a valid email address'),
  });
  assertNotCancel(email);

  // Full name
  const fullName = await text({
    message: 'Full name (optional)',
    placeholder: 'Your Name',
  });
  assertNotCancel(fullName);

  // Auto-detect provider
  const provider = detectProvider(email);
  let imapHost: string;
  let imapPort: number;
  let imapTls: boolean;
  let smtpHost: string;
  let smtpPort: number;
  let smtpTls: boolean;
  let smtpStarttls: boolean;

  if (provider) {
    log.success(`Auto-detected: ${provider.name}`);
    log.info(
      `  IMAP: ${provider.imap.host}:${provider.imap.port} (${provider.imap.tls ? 'TLS' : 'plain'})`,
    );
    const smtpSecurity = provider.smtp.tls ? 'TLS' : 'plain';
    const smtpLabel = provider.smtp.starttls ? 'STARTTLS' : smtpSecurity;
    log.info(`  SMTP: ${provider.smtp.host}:${provider.smtp.port} (${smtpLabel})`);

    if (provider.notes) {
      log.warning(`  Note: ${provider.notes}`);
    }

    const useDetected = await confirm({
      message: 'Use detected settings?',
      initialValue: true,
    });
    assertNotCancel(useDetected);

    if (useDetected) {
      imapHost = provider.imap.host;
      imapPort = provider.imap.port;
      imapTls = provider.imap.tls;
      smtpHost = provider.smtp.host;
      smtpPort = provider.smtp.port;
      smtpTls = provider.smtp.tls;
      smtpStarttls = provider.smtp.starttls;
    } else {
      const settings = await promptServerSettings();
      ({ imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, smtpStarttls } = settings);
    }
  } else {
    log.info('Provider not auto-detected. Please enter server settings manually.');
    const settings = await promptServerSettings();
    ({ imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls, smtpStarttls } = settings);
  }

  // Username
  const username = await text({
    message: 'Username',
    placeholder: email,
    defaultValue: email,
  });
  assertNotCancel(username);

  // Password
  const password = await p_password({
    message: 'Password / App Password',
    validate: (v) => (!v || v.length === 0 ? 'Password is required' : undefined),
  });
  assertNotCancel(password);

  // Build account config for testing
  const testAccount: AccountConfig = {
    name: accountName,
    email,
    fullName: fullName || undefined,
    username: username || email,
    password,
    imap: {
      host: imapHost,
      port: imapPort,
      tls: imapTls,
      starttls: !imapTls,
      verifySsl: true,
    },
    smtp: {
      host: smtpHost,
      port: smtpPort,
      tls: smtpTls,
      starttls: smtpStarttls,
      verifySsl: true,
    },
  };

  // Test connections
  const spinner = p_spinner();

  spinner.start('Testing IMAP connection...');
  const imapResult = await ConnectionManager.testImap(testAccount);
  if (imapResult.success) {
    spinner.stop(
      `IMAP ✓ ${imapHost}:${imapPort} — ${imapResult.details?.messages} messages, ${imapResult.details?.folders} folders`,
    );
  } else {
    spinner.stop(`IMAP ✗ ${imapResult.error}`);
  }

  spinner.start('Testing SMTP connection...');
  const smtpResult = await ConnectionManager.testSmtp(testAccount);
  if (smtpResult.success) {
    spinner.stop(`SMTP ✓ ${smtpHost}:${smtpPort} — authenticated`);
  } else {
    spinner.stop(`SMTP ✗ ${smtpResult.error}`);
  }

  if (!imapResult.success || !smtpResult.success) {
    const proceed = await confirm({
      message: 'Some connections failed. Save config anyway?',
      initialValue: false,
    });
    if (isCancel(proceed) || !proceed) {
      cancel('Setup cancelled. Please check your credentials and server settings.');
      return;
    }
  }

  // Build config
  const newAccount: RawAccountConfig = {
    name: accountName,
    email,
    full_name: fullName || undefined,
    username: username || email,
    password,
    imap: {
      host: imapHost,
      port: imapPort,
      tls: imapTls,
      starttls: !imapTls,
      verify_ssl: true,
    },
    smtp: {
      host: smtpHost,
      port: smtpPort,
      tls: smtpTls,
      starttls: smtpStarttls,
      verify_ssl: true,
    },
  };

  const config: RawAppConfig = existingConfig
    ? {
        ...existingConfig,
        accounts: [...(existingConfig.accounts ?? []), newAccount],
      }
    : {
        settings: { rate_limit: 10, read_only: false },
        accounts: [newAccount],
      };

  // Validate and save
  AppConfigFileSchema.parse(config);
  await saveConfig(config);
  log.success(`Saved to ${CONFIG_FILE}`);

  // Print MCP client config snippet
  note(
    JSON.stringify(
      {
        mcpServers: {
          email: {
            command: 'email-mcp',
            args: ['stdio'],
          },
        },
      },
      null,
      2,
    ),
    'Add this to your MCP client config (e.g., Claude Desktop, Cursor)',
  );

  outro('Setup complete! 🎉');
}
