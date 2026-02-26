import { Command } from 'commander';
import { KickbaseClient } from '../lib/client.js';
import { respond, respondError, isAgent } from '../lib/envelope.js';

export function registerBonusCommands(program: Command, client: KickbaseClient) {
  const bonus = program.command('bonus').description('Bonus system');

  bonus
    .command('collect')
    .description('Collect daily bonus')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/bonus/collect');
        if (!isAgent) {
          console.log('Bonus collected!');
          if (result.it) console.log(JSON.stringify(result.it, null, 2));
        }
        respond('kickbase bonus collect', result, [
          { command: 'kickbase leagues list', description: 'View your leagues' },
        ]);
      } catch (err: any) {
        respondError('kickbase bonus collect', err.message, 'BONUS_FAILED',
          'Bonus may already be collected today. Try again tomorrow.');
      }
    });
}
