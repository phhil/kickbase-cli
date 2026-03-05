import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { CliPolicyError, ERROR_CODES } from './error-codes.js';
import { getIdempotencyKey } from './idempotency.js';
import { getApprovalState, isApprovalActive } from './approval-gate.js';
import { getRuntimeOptions } from '../lib/runtime.js';

const CONFIG_DIR = join(homedir(), '.config', 'kickbase-cli');
const POLICY_FILE = join(CONFIG_DIR, 'policy.json');

export interface CliPolicy {
  enabled: boolean;
  version: number;
  write_allowlist: string[];
  allowed_leagues: string[];
  allowed_commands: string[];
}

const defaultPolicy: CliPolicy = {
  enabled: true,
  version: 1,
  write_allowlist: [
    '^/v4/leagues/\\d+/lineup',
    '^/v4/leagues/\\d+/lineup/(fill|clear)$',
    '^/v4/leagues/\\d+/market',
    '^/v4/leagues/\\d+/market/\\d+$',
    '^/v4/leagues/\\d+/market/\\d+/offers',
    '^/v4/leagues/\\d+/market/\\d+/offers/\\d+/(accept|decline)$',
    '^/v4/leagues/\\d+/market/\\d+/sell$',
    '^/v4/leagues/\\d+/scoutedplayers',
    '^/v4/challenges/',
    '^/v4/base/items/.+/click$',
    '^/v4/user/settings$',
    '^/v4/user/targets',
  ],
  allowed_leagues: [],
  allowed_commands: [],
};

const internalWriteBypass = [
  '/v4/user/login',
  '/v4/user/refreshtokens',
  '/v4/user/forgotpassword',
  '/v4/user/register',
  '/v4/user/password',
];

export function getPolicy(): CliPolicy {
  if (!existsSync(POLICY_FILE)) return defaultPolicy;
  try {
    const parsed = JSON.parse(readFileSync(POLICY_FILE, 'utf8')) as Partial<CliPolicy>;
    return {
      enabled: parsed.enabled ?? defaultPolicy.enabled,
      version: parsed.version ?? 1,
      write_allowlist: parsed.write_allowlist ?? defaultPolicy.write_allowlist,
      allowed_leagues: parsed.allowed_leagues ?? [],
      allowed_commands: parsed.allowed_commands ?? [],
    };
  } catch {
    return defaultPolicy;
  }
}

export function savePolicy(update: Partial<CliPolicy>): CliPolicy {
  const next = { ...getPolicy(), ...update };
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(POLICY_FILE, JSON.stringify(next, null, 2));
  return next;
}

function extractLeagueId(path: string): string | null {
  const m = path.match(/\/v4\/leagues\/(\d+)/);
  return m?.[1] ?? null;
}

export function validateWriteAllowed(method: string, path: string): void {
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'GET') return;
  if (internalWriteBypass.includes(path)) return;

  const policy = getPolicy();
  const tool = getRuntimeOptions().activeTool ?? 'unknown';
  if (!policy.enabled) return;

  const allowlisted = policy.write_allowlist.some((p) => {
    try {
      return new RegExp(p).test(path);
    } catch {
      return false;
    }
  });
  if (!allowlisted) {
    throw new CliPolicyError(ERROR_CODES.SCOPE_VIOLATION, `Write path not in write_allowlist: ${path}`, false, { path, tool });
  }

  const leagueId = extractLeagueId(path);
  if (policy.allowed_leagues.length > 0 && leagueId && !policy.allowed_leagues.includes(leagueId)) {
    throw new CliPolicyError(ERROR_CODES.POLICY_DENIED, `League ${leagueId} is not allowed by policy`, false, { leagueId, path, tool });
  }

  if (policy.allowed_commands.length > 0 && !policy.allowed_commands.includes(tool)) {
    throw new CliPolicyError(ERROR_CODES.POLICY_DENIED, `Command ${tool} is not allowed by policy`, false, { tool, path });
  }

  if (!isApprovalActive()) {
    throw new CliPolicyError(ERROR_CODES.APPROVAL_REQUIRED, 'No active approval session for write operations', false, { tool, path });
  }

  const approval = getApprovalState();
  if (approval.scope.leagues.length > 0 && leagueId && !approval.scope.leagues.includes(leagueId)) {
    throw new CliPolicyError(ERROR_CODES.POLICY_DENIED, `Approval scope does not include league ${leagueId}`, false, { leagueId, path });
  }
  if (approval.scope.commands.length > 0 && !approval.scope.commands.includes(tool)) {
    throw new CliPolicyError(ERROR_CODES.POLICY_DENIED, `Approval scope does not include tool ${tool}`, false, { tool, path });
  }

  if (!getIdempotencyKey()) {
    throw new CliPolicyError(ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED, 'idempotency key is required for writes', false, { tool, path });
  }
}

export function validatePolicy(): { valid: boolean; problems: string[]; policy: CliPolicy } {
  const policy = getPolicy();
  const problems: string[] = [];
  if (!Array.isArray(policy.write_allowlist) || policy.write_allowlist.length === 0) {
    problems.push('write_allowlist must contain at least one regex pattern');
  }
  for (const p of policy.write_allowlist) {
    try {
      void new RegExp(p);
    } catch {
      problems.push(`invalid regex in write_allowlist: ${p}`);
    }
  }
  return { valid: problems.length === 0, problems, policy };
}
