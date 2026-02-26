import { Command } from 'commander';
import { KickbaseClient } from '../lib/client.js';
import { respond, respondError, isAgent } from '../lib/envelope.js';

export function registerChatCommands(program: Command, client: KickbaseClient) {
  const chat = program.command('chat').description('Chat services');

  chat
    .command('leagues')
    .description('Get chat league selection')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/chat/leagueselection');
        if (!isAgent && Array.isArray(result.it)) {
          for (const l of result.it) {
            const joined = l.uj ? ` (joined ${String(l.uj).slice(0, 10)})` : '';
            console.log(`${l.n ?? l.i}${joined}`);
          }
          result._printed = true;
        }
        respond('kickbase chat leagues', result, [
          { command: 'kickbase chat refresh-token', description: 'Refresh chat token' },
        ]);
      } catch (err: any) {
        respondError('kickbase chat leagues', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  chat
    .command('refresh-token')
    .description('Refresh chat authentication token')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/chat/refreshtoken');
        if (!isAgent) {
          console.log(`Token: ${result.tkn}`);
          console.log(`Expires: ${result.tknex}`);
          result._printed = true;
        }
        respond('kickbase chat refresh-token', result, [
          { command: 'kickbase chat leagues', description: 'View chat leagues' },
        ]);
      } catch (err: any) {
        respondError('kickbase chat refresh-token', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  chat
    .command('users <leagueId>')
    .description('List chat users in a league')
    .action(async (leagueId: string) => {
      try {
        const result = await client.get<any>(`/v4/chat/leagueselection/${leagueId}/users`);
        if (!isAgent && result.it) {
          for (const u of result.it) {
            console.log(`${u.n ?? u.unm ?? u.i}`);
          }
          result._printed = true;
        }
        respond('kickbase chat users', result, [
          { command: 'kickbase chat leagues', description: 'View chat leagues' },
        ]);
      } catch (err: any) {
        respondError('kickbase chat users', err.message, 'FETCH_FAILED',
          `Check that league ID "${leagueId}" is valid.`);
      }
    });
}
