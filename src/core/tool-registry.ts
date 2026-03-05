import { Command } from 'commander';

export interface ToolDefinition {
  tool: string;
  command: string;
  description: string;
  argsSchema: Record<string, unknown>;
  resultSchema: Record<string, unknown>;
  mutable: boolean;
}

function toToolName(command: string): string {
  return command.replace(/^kb\s+/, '').trim().replace(/\s+/g, '.');
}

function isMutableCommand(command: string): boolean {
  return /(offer|buy|sell|accept|decline|remove|delete|reset|set|update|create|fill|clear|click|unlock|leave|kick)/i.test(command);
}

export function collectToolDefinitions(root: Command): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  function walk(cmd: Command, prefix: string) {
    for (const sub of cmd.commands) {
      const full = `${prefix} ${sub.name()}`.trim();
      if (sub.commands.length > 0) {
        walk(sub, full);
      } else {
        tools.push({
          tool: toToolName(full),
          command: full,
          description: sub.description() ?? '',
          argsSchema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              argv: { type: 'array', items: { type: 'string' } },
              options: { type: 'object', additionalProperties: true },
            },
          },
          resultSchema: {
            type: 'object',
            additionalProperties: true,
          },
          mutable: isMutableCommand(full),
        });
      }
    }
  }

  walk(root, 'kb');
  return tools.sort((a, b) => a.tool.localeCompare(b.tool));
}
