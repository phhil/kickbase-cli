import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.config', 'kickbase-cli');
const APPROVALS_FILE = join(CONFIG_DIR, 'approvals.json');

export interface ApprovalState {
  active: boolean;
  token: string | null;
  openedAt: string | null;
  expiresAt: string | null;
  scope: {
    leagues: string[];
    commands: string[];
  };
}

function defaultState(): ApprovalState {
  return {
    active: false,
    token: null,
    openedAt: null,
    expiresAt: null,
    scope: { leagues: [], commands: [] },
  };
}

export function getApprovalState(): ApprovalState {
  if (!existsSync(APPROVALS_FILE)) return defaultState();
  try {
    const parsed = JSON.parse(readFileSync(APPROVALS_FILE, 'utf8')) as ApprovalState;
    return { ...defaultState(), ...parsed, scope: { leagues: parsed.scope?.leagues ?? [], commands: parsed.scope?.commands ?? [] } };
  } catch {
    return defaultState();
  }
}

function saveApprovalState(state: ApprovalState): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(APPROVALS_FILE, JSON.stringify(state, null, 2));
}

export function openApproval(ttlMinutes: number, scope?: { leagues?: string[]; commands?: string[] }): ApprovalState {
  const now = new Date();
  const expires = new Date(now.getTime() + Math.max(1, ttlMinutes) * 60_000);
  const token = `apr_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  const state: ApprovalState = {
    active: true,
    token,
    openedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    scope: {
      leagues: scope?.leagues ?? [],
      commands: scope?.commands ?? [],
    },
  };
  saveApprovalState(state);
  return state;
}

export function closeApproval(): ApprovalState {
  const state = defaultState();
  saveApprovalState(state);
  return state;
}

export function isApprovalActive(): boolean {
  const state = getApprovalState();
  if (!state.active || !state.expiresAt) return false;
  if (new Date(state.expiresAt).getTime() <= Date.now()) {
    closeApproval();
    return false;
  }
  return true;
}
