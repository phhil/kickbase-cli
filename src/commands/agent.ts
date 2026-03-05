import { Command } from 'commander';
import { spawnSync } from 'child_process';
import { z } from 'zod';
import { collectToolDefinitions, ToolDefinition } from '../core/tool-registry.js';
import { respond, respondError } from '../lib/envelope.js';
import { closeApproval, getApprovalState, openApproval } from '../core/approval-gate.js';
import { getPolicy, savePolicy, validatePolicy } from '../core/policy-engine.js';
import { ERROR_CODES } from '../core/error-codes.js';
import { getRuntimeOptions } from '../lib/runtime.js';

const runArgsSchema = z.object({
  argv: z.array(z.string()).optional().default([]),
  options: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
});

function buildArgvForTool(tool: ToolDefinition, args: unknown): string[] {
  const parsed = runArgsSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  const payload = parsed.data;
  const commandTokens = tool.command.replace(/^kb\s+/, '').split(/\s+/).filter(Boolean);
  const optionTokens = Object.entries(payload.options).flatMap(([key, value]) => {
    const flag = key.length === 1 ? `-${key}` : `--${key}`;
    if (typeof value === 'boolean') return value ? [flag] : [];
    if (value === null) return [flag];
    return [flag, String(value)];
  });
  return [...commandTokens, ...payload.argv, ...optionTokens];
}

export function registerAgentCommands(program: Command): void {
  const tools = program.command('tools').description('Agent tool discovery');
  tools
    .command('list')
    .description('List available tools for agent runtimes')
    .action(async () => {
      const defs = collectToolDefinitions(program).map((d) => ({
        tool: d.tool,
        description: d.description,
        mutable: d.mutable,
        args_schema_ref: `tool://${d.tool}/args`,
        result_schema_ref: `tool://${d.tool}/result`,
      }));
      respond('kb tools list', { count: defs.length, tools: defs }, [
        { command: 'kb tools describe <tool>', description: 'Describe a specific tool schema' },
      ]);
    });

  tools
    .command('describe <tool>')
    .description('Describe args/result schema for one tool')
    .action(async (tool: string) => {
      const defs = collectToolDefinitions(program);
      const def = defs.find((d) => d.tool === tool);
      if (!def) {
        respondError('kb tools describe', `Unknown tool: ${tool}`, ERROR_CODES.TOOL_NOT_FOUND, 'Run: kb tools list');
      }
      respond('kb tools describe', {
        ...def!,
        known_errors: def!.mutable
          ? [ERROR_CODES.APPROVAL_REQUIRED, ERROR_CODES.POLICY_DENIED, ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED, ERROR_CODES.SCOPE_VIOLATION]
          : [],
      });
    });

  program
    .command('run <tool>')
    .description('Run a tool by name with JSON args payload')
    .requiredOption('--args <json>', 'JSON payload: {"argv":[],"options":{}}')
    .action(async (toolName: string, opts: { args: string }) => {
      const defs = collectToolDefinitions(program);
      const def = defs.find((d) => d.tool === toolName);
      if (!def) {
        respondError('kb run', `Unknown tool: ${toolName}`, ERROR_CODES.TOOL_NOT_FOUND, 'Run: kb tools list');
      }
      if (['tools.list', 'tools.describe', 'run'].includes(toolName)) {
        respondError('kb run', `Tool ${toolName} cannot be invoked via kb run`, ERROR_CODES.TOOL_NOT_FOUND, 'Run the command directly.');
      }

      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(opts.args);
      } catch {
        respondError('kb run', 'Invalid --args JSON payload', ERROR_CODES.INVALID_ARGS, 'Pass valid JSON like {"argv":["7202758"],"options":{}}');
      }

      let argv: string[];
      try {
        argv = buildArgvForTool(def!, parsedArgs);
      } catch (err: any) {
        respondError('kb run', err.message, ERROR_CODES.INVALID_ARGS, 'Use args schema from: kb tools describe <tool>');
        return;
      }

      const runtime = getRuntimeOptions();
      const globalFlags = ['--agent', '--schema-version', runtime.schemaVersion];
      if (runtime.idempotencyKey) globalFlags.push('--idempotency-key', runtime.idempotencyKey);
      if (runtime.failOnWarning) globalFlags.push('--fail-on-warning');

      const entry = process.argv[1];
      const child = spawnSync(process.execPath, [entry, ...globalFlags, ...argv], {
        encoding: 'utf8',
      });

      if (child.stdout) process.stdout.write(child.stdout);
      if (child.stderr) process.stderr.write(child.stderr);
      process.exit(child.status ?? 1);
    });

  const policy = program.command('policy').description('Write policy management for agent mode');
  policy
    .command('show')
    .description('Show current write policy')
    .action(async () => {
      respond('kb policy show', { policy: getPolicy() });
    });

  policy
    .command('set')
    .description('Merge policy fields from JSON payload')
    .requiredOption('--data <json>', 'JSON partial policy')
    .action(async (opts: { data: string }) => {
      try {
        const patch = JSON.parse(opts.data) as Record<string, unknown>;
        const next = savePolicy(patch);
        respond('kb policy set', { policy: next }, [{ command: 'kb policy validate', description: 'Validate policy rules' }]);
      } catch (err: any) {
        respondError('kb policy set', err.message, ERROR_CODES.INVALID_ARGS, 'Pass valid JSON in --data');
      }
    });

  policy
    .command('validate')
    .description('Validate regex and structure in policy.json')
    .action(async () => {
      const result = validatePolicy();
      if (!result.valid) {
        respondError('kb policy validate', 'Policy is invalid', ERROR_CODES.POLICY_DENIED, result.problems.join('; '));
      }
      respond('kb policy validate', result);
    });

  const approval = program.command('approval').description('Approval gate for write operations');
  approval
    .command('open')
    .description('Open temporary approval window for writes')
    .option('--ttl-minutes <minutes>', 'Approval duration in minutes', '15')
    .option('--league <leagueId>', 'Limit approval to one league ID')
    .option('--tool <tool>', 'Limit approval to one tool')
    .action(async (opts: { ttlMinutes?: string; league?: string; tool?: string }) => {
      const ttl = Number.parseInt(String(opts.ttlMinutes ?? '15'), 10);
      const state = openApproval(Number.isFinite(ttl) ? ttl : 15, {
        leagues: opts.league ? [opts.league] : [],
        commands: opts.tool ? [opts.tool] : [],
      });
      respond('kb approval open', { approval: state });
    });

  approval
    .command('close')
    .description('Close active approval window')
    .action(async () => {
      respond('kb approval close', { approval: closeApproval() });
    });

  approval
    .command('status')
    .description('Show approval status')
    .action(async () => {
      respond('kb approval status', { approval: getApprovalState() });
    });
}
