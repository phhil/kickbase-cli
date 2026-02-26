import { Command } from 'commander';
import { KickbaseClient } from '../lib/client.js';
import { respond, respondError, isAgent, formatKeyValue } from '../lib/envelope.js';
import { setConfig, getDefaultLeagueId } from '../lib/config.js';
import { clearCache } from '../lib/cache.js';

export function registerConfigCommands(program: Command, client: KickbaseClient) {
  const config = program.command('config').description('App configuration');

  config
    .command('set-league <leagueId>')
    .description('Set default league ID (used when leagueId is omitted)')
    .action(async (leagueId: string) => {
      setConfig({ defaultLeagueId: leagueId });
      if (!isAgent) console.log(`Default league set to: ${leagueId}`);
      respond('kb config set-league', { defaultLeagueId: leagueId, _printed: !isAgent }, [
        { command: 'kb leagues ranking', description: 'View ranking (uses default league)' },
      ]);
    });

  config
    .command('get-league')
    .description('Show current default league ID')
    .action(async () => {
      const id = getDefaultLeagueId();
      if (!isAgent) console.log(id ? `Default league: ${id}` : 'No default league set. Run: kb config set-league <leagueId>');
      respond('kb config get-league', { defaultLeagueId: id ?? null, _printed: !isAgent }, []);
    });

  config
    .command('clear-cache')
    .description('Clear all cached API responses')
    .action(async () => {
      const count = clearCache();
      if (!isAgent) console.log(`Cleared ${count} cached entries.`);
      respond('kb config clear-cache', { cleared: count, _printed: !isAgent }, []);
    });

  config
    .command('show')
    .description('Get app configuration')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/config');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config show', result, [
          { command: 'kickbase config version', description: 'View version info' },
          { command: 'kickbase config onboarding', description: 'View onboarding config' },
        ]);
      } catch (err: any) {
        respondError('kickbase config show', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  config
    .command('version')
    .description('Get version info and feature flags')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/config/version');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config version', result, []);
      } catch (err: any) {
        respondError('kickbase config version', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  config
    .command('onboarding')
    .description('Get onboarding configuration')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/config/onboarding');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config onboarding', result, []);
      } catch (err: any) {
        respondError('kickbase config onboarding', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  config
    .command('overview')
    .description('Get base overview')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/base/overview');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config overview', result, []);
      } catch (err: any) {
        respondError('kickbase config overview', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  config
    .command('products')
    .description('View available products/shop items')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/products');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config products', result, []);
      } catch (err: any) {
        respondError('kickbase config products', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  config
    .command('promotion')
    .description('View active promotions')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/promotion');
        if (!isAgent) console.log(JSON.stringify(result, null, 2));
        respond('kickbase config promotion', result, []);
      } catch (err: any) {
        respondError('kickbase config promotion', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });
}
