import { Command } from 'commander';
import { KickbaseClient } from '../lib/client.js';
import { respond, respondError, isAgent, formatTable } from '../lib/envelope.js';

export function registerLiveCommands(program: Command, client: KickbaseClient) {
  const live = program.command('live').description('Live match events');

  live
    .command('eventtypes')
    .description('List available event type codes')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/live/eventtypes');
        if (!isAgent && Array.isArray(result.it)) {
          const rows = result.it
            .map((e: any) => ({ code: e.i, name: e.ti }))
            .sort((a: any, b: any) => Number(a.code) - Number(b.code));
          formatTable(rows, [
            { key: 'code', label: 'Code', width: 8 },
            { key: 'name', label: 'Name', width: 48 },
          ]);
          if (result.lcud) {
            console.log(`\nLast updated: ${result.lcud}`);
          }
          result._printed = true;
        }
        respond('kickbase live eventtypes', result, [
          { command: 'kickbase matches details <matchId>', description: 'View match details' },
        ]);
      } catch (err: any) {
        respondError('kickbase live eventtypes', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });
}
