import { getDurationMs, getRuntimeOptions, toToolName } from '../lib/runtime.js';

export interface ToolNextAction {
  tool: string;
  args_schema_ref: string;
  reason: string;
}

export interface ToolEnvelopeSuccess {
  ok: true;
  tool: string;
  schema_version: string;
  result: Record<string, unknown>;
  error: null;
  warnings: string[];
  next_actions: ToolNextAction[];
  meta: {
    timestamp: string;
    duration_ms: number;
    source: 'kickbase-cli';
    cached: boolean;
    league_id?: string;
    competition_id?: string;
  };
}

export interface ToolEnvelopeError {
  ok: false;
  tool: string;
  schema_version: string;
  result: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  warnings: string[];
  next_actions: ToolNextAction[];
  meta: {
    timestamp: string;
    duration_ms: number;
    source: 'kickbase-cli';
    cached: boolean;
  };
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortObject(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export function deterministicJSONStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

export function toToolNextActions(actions: Array<{ command: string; description: string }>): ToolNextAction[] {
  return actions.map((a) => ({
    tool: toToolName(a.command),
    args_schema_ref: `tool://${toToolName(a.command)}/args`,
    reason: a.description,
  }));
}

export function makeSuccessEnvelope(
  command: string,
  result: Record<string, unknown>,
  nextActions: ToolNextAction[],
  warnings: string[] = []
): ToolEnvelopeSuccess {
  const opts = getRuntimeOptions();
  return {
    ok: true,
    tool: toToolName(command),
    schema_version: opts.schemaVersion,
    result,
    error: null,
    warnings,
    next_actions: nextActions,
    meta: {
      timestamp: new Date().toISOString(),
      duration_ms: getDurationMs() ?? 0,
      source: 'kickbase-cli',
      cached: false,
    },
  };
}

export function makeErrorEnvelope(
  command: string,
  code: string,
  message: string,
  retryable: boolean,
  nextActions: ToolNextAction[] = [],
  details?: Record<string, unknown>,
  warnings: string[] = []
): ToolEnvelopeError {
  const opts = getRuntimeOptions();
  return {
    ok: false,
    tool: toToolName(command),
    schema_version: opts.schemaVersion,
    result: null,
    error: {
      code,
      message,
      retryable,
      details,
    },
    warnings,
    next_actions: nextActions,
    meta: {
      timestamp: new Date().toISOString(),
      duration_ms: getDurationMs() ?? 0,
      source: 'kickbase-cli',
      cached: false,
    },
  };
}
