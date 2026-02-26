#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { KickbaseClient } from '../src/lib/client.js';
import { registerUserCommands } from '../src/commands/user.js';
import { registerConfigCommands } from '../src/commands/config.js';
import { registerBonusCommands } from '../src/commands/bonus.js';
import { registerChallengeCommands } from '../src/commands/challenges.js';
import { registerCompetitionCommands } from '../src/commands/competitions.js';
import { registerLeagueCommands } from '../src/commands/leagues.js';
import { registerLiveCommands } from '../src/commands/live.js';
import { registerMatchCommands } from '../src/commands/matches.js';
import { registerChatCommands } from '../src/commands/chat.js';
import { registerBaseCommands } from '../src/commands/base.js';
import { registerLigaInsiderCommands } from '../src/commands/ligainsider.js';
import { registerSmartCommands } from '../src/commands/smart.js';
import { disableCache } from '../src/lib/cache.js';
import { setRuntimeOptions, isJsonMode } from '../src/lib/runtime.js';
import { syncEnvelopeRuntimeFlags } from '../src/lib/envelope.js';

const program = new Command();
const client = new KickbaseClient();

function collectLeafCommands(root: Command) {
  const groups: Record<string, { command: string; description: string }[]> = {};

  function walk(cmd: Command, prefix: string) {
    for (const sub of cmd.commands) {
      const fullName = `${prefix} ${sub.name()}`.trim();
      if (sub.commands.length > 0) {
        walk(sub, fullName);
      } else {
        const category = fullName.split(' ')[1] ?? 'other';
        if (!groups[category]) groups[category] = [];
        groups[category].push({
          command: fullName,
          description: sub.description(),
        });
      }
    }
  }

  walk(root, 'kb');
  return groups;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function suggestTopLevelCommand(input: string, known: string[]): string | null {
  const normalized = input.toLowerCase();
  const ranked = known
    .map((cmd) => {
      const c = cmd.toLowerCase();
      let score = levenshtein(normalized, c);
      if (c.startsWith(normalized) || normalized.startsWith(c)) score -= 1;
      if (c.includes(normalized) || normalized.includes(c)) score -= 1;
      return { cmd, score };
    })
    .sort((a, b) => a.score - b.score || a.cmd.localeCompare(b.cmd));

  const best = ranked[0];
  if (!best) return null;
  return best.score <= Math.max(2, Math.floor(normalized.length / 3)) ? best.cmd : null;
}

program
  .name('kb')
  .description('CLI wrapper for the Kickbase fantasy football API')
  .version('1.0.0')
  .option('--json', 'Force JSON output')
  .option('--verbose', 'Verbose output')
  .option('--no-cache', 'Bypass cache')
  .option('--base-url <url>', 'Override API base URL')
  .hook('preAction', () => {
    const opts = program.opts();
    setRuntimeOptions({
      json: Boolean(opts.json) || !process.stdout.isTTY,
      verbose: Boolean(opts.verbose),
    });
    syncEnvelopeRuntimeFlags();
    if (opts.baseUrl) client.setBaseUrl(String(opts.baseUrl));
    if (opts.noCache) disableCache();
  });

program.showSuggestionAfterError(true);
program.showHelpAfterError('(add --help for usage)');
program.on('command:*', () => {
  program.error(`Unknown command: ${program.args.join(' ')}`);
});

// Register all command groups
registerUserCommands(program, client);
registerConfigCommands(program, client);
registerBonusCommands(program, client);
registerChallengeCommands(program, client);
registerCompetitionCommands(program, client);
registerLeagueCommands(program, client);
registerLiveCommands(program, client);
registerMatchCommands(program, client);
registerChatCommands(program, client);
registerBaseCommands(program, client);
registerLigaInsiderCommands(program, client);
registerSmartCommands(program, client);

program
  .command('search <terms...>')
  .alias('find')
  .description('Search commands by name or description')
  .option('-n, --limit <count>', 'Maximum results to show', '12')
  .action(async (terms: string[], opts: { limit?: string }) => {
    const query = terms.join(' ').trim().toLowerCase();
    const limit = Math.max(1, Number.parseInt(String(opts.limit ?? '12'), 10) || 12);
    const groups = collectLeafCommands(program);
    const allCommands = Object.values(groups).flat();

    const scored = allCommands
      .map((entry) => {
        const cmd = entry.command.toLowerCase();
        const desc = (entry.description ?? '').toLowerCase();
        const tokens = query.split(/\s+/).filter(Boolean);
        const tokenHits = tokens.filter(t => cmd.includes(t) || desc.includes(t)).length;
        if (!query || tokenHits === 0) return null;

        let score = tokenHits * 10;
        if (cmd.includes(query)) score += 60;
        if (cmd.startsWith(`kb ${query}`) || cmd.startsWith(query)) score += 100;
        if (desc.includes(query)) score += 25;

        return { ...entry, score };
      })
      .filter((row): row is { command: string; description: string; score: number } => row !== null)
      .sort((a, b) => b.score - a.score || a.command.localeCompare(b.command))
      .slice(0, limit);

    if (isJsonMode()) {
      console.log(JSON.stringify({
        ok: true,
        command: 'kb search',
        result: { query, count: scored.length, results: scored.map(({ score, ...r }) => r) },
        next_actions: scored.slice(0, 3).map(r => ({ command: r.command, description: r.description })),
      }));
      return;
    }

    const chalk = (await import('chalk')).default;
    console.log();
    console.log(chalk.bold(`  Search Results for "${terms.join(' ')}"`));
    console.log();
    if (scored.length === 0) {
      console.log(chalk.dim('  No commands matched. Try broader terms like "league", "market", or "player".'));
      console.log();
      return;
    }
    for (const row of scored) {
      console.log(`  ${chalk.green(row.command.padEnd(28))} ${chalk.dim(row.description)}`);
    }
    console.log();
  });

// Self-documenting root: no args → show command tree
program.action(async () => {
  if (program.args.length > 0) {
    program.error(`Unknown command: ${program.args.join(' ')}`);
  }

  const isAgent = isJsonMode();

  // Collect all leaf commands grouped by category
  const groups = collectLeafCommands(program);

  if (isAgent) {
    // Agent mode: structured JSON
    const commands = Object.values(groups).flat();
    console.log(JSON.stringify({
      ok: true, command: 'kb', result: {
        description: program.description(), version: program.version(), commands,
      },
      next_actions: [
        { command: 'kb user login', description: 'Login to Kickbase' },
        { command: 'kb leagues list', description: 'List your leagues' },
        { command: 'kb briefing', description: 'Morning briefing' },
      ],
    }));
  } else {
    // Human mode: formatted overview
    const chalk = (await import('chalk')).default;
    console.log();
    console.log(chalk.bold('  Kickbase CLI') + chalk.dim(' v1.0.0'));
    console.log(chalk.dim('  Fantasy football from the command line\n'));

    // Quick start section
    console.log(chalk.bold.underline('  Quick Start\n'));
    const quickStart = [
      ['kb briefing', 'Morning briefing: rank, lineup, top players'],
      ['kb squad-report', 'Squad analysis with SELL/HOLD/WATCH advice'],
      ['kb transfer-check', 'Market opportunities ranked by avg points'],
      ['kb li news', 'Latest LigaInsider injury & lineup intel'],
      ['kb li alpha', 'Cross-ref your squad with injury data'],
    ];
    for (const [cmd, desc] of quickStart) {
      console.log(`  ${chalk.green(cmd.padEnd(22))} ${chalk.dim(desc)}`);
    }

    // Command groups
    console.log(chalk.bold.underline('\n  Commands\n'));
    const groupOrder = ['user', 'config', 'bonus', 'leagues', 'challenges', 'competitions', 'li', 'matches', 'live', 'chat', 'base', 'briefing', 'transfer-check', 'squad-report'];
    const groupLabels: Record<string, string> = {
      user: 'User & Auth', config: 'Configuration', bonus: 'Daily Bonus',
      leagues: 'Leagues (squad, market, lineup, players...)',
      challenges: 'Challenges & Lobby', competitions: 'Competitions & Teams',
      li: 'LigaInsider (scraper)', matches: 'Matches', live: 'Live Events',
      chat: 'Chat', base: 'News & Content',
      briefing: 'Smart Commands', 'transfer-check': '', 'squad-report': '',
    };

    const smartCmds = new Set(['briefing', 'transfer-check', 'squad-report']);
    const printed = new Set<string>();
    for (const group of groupOrder) {
      if (printed.has(group) || smartCmds.has(group)) continue;
      const cmds = groups[group];
      if (!cmds) continue;
      const label = groupLabels[group] ?? group;
      if (label) {
        console.log(`  ${chalk.bold(label)} ${chalk.dim(`(${cmds.length} commands)`)}`);
        console.log(`  ${chalk.dim(`kb ${group} --help for details`)}\n`);
      }
      printed.add(group);
    }

    // Smart commands are top-level, show them grouped
    const smartEntries = [...smartCmds].flatMap(s => groups[s] ?? []);
    if (smartEntries.length > 0) {
      console.log(`  ${chalk.bold('Smart Commands')} ${chalk.dim(`(${smartEntries.length} commands)`)}`);
      for (const entry of smartEntries) {
        console.log(`    ${chalk.green(entry.command.padEnd(24))} ${chalk.dim(entry.description)}`);
      }
      console.log();
    }

    const total = Object.values(groups).flat().length;
    console.log(chalk.dim(`  ${total} commands total. Run kb <command> --help for usage.\n`));
  }
});

const argv = process.argv.slice(2);
const topLevelCommands = new Set(
  program.commands.flatMap(cmd => {
    const aliases = (cmd as any)._aliases as string[] | undefined;
    return [cmd.name(), ...(aliases ?? [])];
  })
);
let firstOperand: string | undefined;

for (let i = 0; i < argv.length; i++) {
  const token = argv[i];
  if (token === '--base-url') {
    i++;
    continue;
  }
  if (token.startsWith('-')) continue;
  firstOperand = token;
  break;
}

if (firstOperand && !topLevelCommands.has(firstOperand)) {
  const suggestion = suggestTopLevelCommand(firstOperand, [...topLevelCommands]);
  const suffix = suggestion ? ` (did you mean: ${suggestion}?)` : '';
  program.error(`Unknown command: ${firstOperand}${suffix}`);
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
