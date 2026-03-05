export interface RuntimeOptions {
  json: boolean;
  verbose: boolean;
  agent: boolean;
  schemaVersion: string;
  failOnWarning: boolean;
  idempotencyKey?: string;
  activeTool?: string;
  activeCommand?: string;
  commandStartedAt?: number;
}

const runtimeOptions: RuntimeOptions = {
  json: !process.stdout.isTTY,
  verbose: false,
  agent: false,
  schemaVersion: '2.0',
  failOnWarning: false,
};

export function setRuntimeOptions(updates: Partial<RuntimeOptions>): void {
  Object.assign(runtimeOptions, updates);
}

export function getRuntimeOptions(): RuntimeOptions {
  return { ...runtimeOptions };
}

export function isJsonMode(): boolean {
  return runtimeOptions.json;
}

export function isVerboseMode(): boolean {
  return runtimeOptions.verbose;
}

export function isAgentMode(): boolean {
  return runtimeOptions.agent;
}

export function beginCommandContext(command: string): void {
  runtimeOptions.activeCommand = command;
  runtimeOptions.activeTool = toToolName(command);
  runtimeOptions.commandStartedAt = Date.now();
}

export function endCommandContext(): void {
  runtimeOptions.activeCommand = undefined;
  runtimeOptions.activeTool = undefined;
  runtimeOptions.commandStartedAt = undefined;
}

export function getDurationMs(): number | null {
  if (!runtimeOptions.commandStartedAt) return null;
  return Math.max(0, Date.now() - runtimeOptions.commandStartedAt);
}

export function toToolName(command: string): string {
  const normalized = command.replace(/^kickbase\s+|^kb\s+/i, '').trim();
  if (!normalized) return 'kb';
  return normalized.replace(/\s+/g, '.');
}
