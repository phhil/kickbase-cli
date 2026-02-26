import { Command } from 'commander';
import { KickbaseClient } from '../lib/client.js';
import { respond, respondError, isAgent, formatTable } from '../lib/envelope.js';

export function registerCompetitionCommands(program: Command, client: KickbaseClient) {
  const comp = program.command('competitions').description('Competition data (Bundesliga etc.)');
  const fmtMoney = (n: number | undefined | null) => typeof n === 'number' ? `${(n / 1_000_000).toFixed(1)}M` : '?';
  const posLabel = (p: number | string | undefined) => ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' } as Record<number, string>)[Number(p)] ?? String(p ?? '?');

  comp
    .command('list')
    .description('List all available competitions')
    .action(async () => {
      try {
        const result = await client.get<any>('/v4/competitions');
        if (!isAgent && result.it) {
          formatTable(result.it, [
            { key: 'i', label: 'ID', width: 4 },
            { key: 'n', label: 'Competition', width: 25 },
          ]);
        }
        respond('kickbase competitions list', result, [
          ...(result.it ?? []).map((c: any) => ({
            command: `kickbase competitions overview ${c.i}`,
            description: `View ${c.n}`,
          })),
        ]);
      } catch (err: any) {
        respondError('kickbase competitions list', err.message, 'FETCH_FAILED',
          'Ensure you are logged in. Run: kickbase user login');
      }
    });

  comp
    .command('overview <competitionId>')
    .description('Get competition overview')
    .action(async (competitionId: string) => {
      try {
        const all = await client.get<any>('/v4/competitions');
        const result = (all.it ?? []).find((c: any) => String(c.i) === String(competitionId));
        if (!result) {
          throw new Error(`Competition ID "${competitionId}" not found`);
        }
        if (!isAgent) {
          formatTable([{
            id: result.i,
            name: result.n,
            features: Array.isArray(result.fts) ? result.fts.join(',') : '',
          }], [
            { key: 'id', label: 'ID', width: 4 },
            { key: 'name', label: 'Competition', width: 24 },
            { key: 'features', label: 'Features', width: 12 },
          ]);
        }
        respond('kickbase competitions overview', { ...result, _printed: !isAgent }, [
          { command: `kickbase competitions matchdays ${competitionId}`, description: 'View matchdays' },
          { command: `kickbase competitions table ${competitionId}`, description: 'View league table' },
          { command: `kickbase competitions players ${competitionId}`, description: 'View players' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions overview', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  comp
    .command('matchdays <competitionId>')
    .description('Get fixtures and matchdays')
    .action(async (competitionId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/matchdays`);
        if (!isAgent && Array.isArray(result.it)) {
          console.log(`Matchdays: ${result.it.length} (current: ${result.day ?? '?'})`);
          const current = result.it.find((d: any) => Number(d.day) === Number(result.day)) ?? result.it[0];
          if (current?.it) {
            console.log(`\nMatchday ${current.day}:`);
            for (const m of current.it) {
              const score = m.st === 2 ? ` ${m.t1g ?? 0}-${m.t2g ?? 0}` : '';
              console.log(`  ${m.dt ?? ''}  ${m.t1sy ?? m.t1} vs ${m.t2sy ?? m.t2}${score}`);
            }
          }
          result._printed = true;
        }
        respond('kickbase competitions matchdays', result, [
          { command: `kickbase competitions table ${competitionId}`, description: 'View league table' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions matchdays', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  comp
    .command('table <competitionId>')
    .description('Get league table')
    .action(async (competitionId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/table`);
        if (!isAgent && result.it) {
          const sorted = [...result.it].sort((a: any, b: any) => (a.cpl ?? 999) - (b.cpl ?? 999));
          formatTable(sorted.map((t: any) => ({
            rank: t.cpl ?? '?',
            team: t.tn,
            mp: t.mc ?? '?',
            pts: t.cp ?? '?',
            gd: t.gd ?? '?',
            kbPts: t.sp ?? '?',
          })), [
            { key: 'rank', label: '#', width: 3 },
            { key: 'team', label: 'Team', width: 18 },
            { key: 'mp', label: 'MP', width: 3 },
            { key: 'pts', label: 'Pts', width: 4 },
            { key: 'gd', label: 'GD', width: 4 },
            { key: 'kbPts', label: 'KB Pts', width: 7 },
          ]);
        }
        respond('kickbase competitions table', { ...result, _printed: !isAgent }, [
          { command: `kickbase competitions ranking ${competitionId}`, description: 'View team ranking' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions table', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  comp
    .command('ranking <competitionId>')
    .description('Get team ranking')
    .action(async (competitionId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/ranking`);
        if (!isAgent && result.it) {
          const sorted = [...result.it].sort((a: any, b: any) => (a.spl ?? 999) - (b.spl ?? 999));
          formatTable(sorted.map((t: any) => ({
            rank: t.spl ?? '?',
            team: t.tn,
            pts: t.sp ?? '?',
            md: t.mdp ?? '?',
            mdRank: t.mdpl ?? '?',
          })), [
            { key: 'rank', label: '#', width: 3 },
            { key: 'team', label: 'Team', width: 18 },
            { key: 'pts', label: 'KB Pts', width: 7 },
            { key: 'md', label: 'MD Pts', width: 6 },
            { key: 'mdRank', label: 'MD#', width: 4 },
          ]);
        }
        respond('kickbase competitions ranking', { ...result, _printed: !isAgent }, [
          { command: `kickbase competitions table ${competitionId}`, description: 'View league table' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions ranking', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  // --- Players ---

  comp
    .command('players <competitionId>')
    .description('List players in a competition')
    .option('--day <dayNumber>', 'Filter by matchday')
    .action(async (competitionId: string, opts: any) => {
      try {
        const query = opts.day ? `?dayNumber=${opts.day}` : '';
        const result = await client.get<any>(`/v4/competitions/${competitionId}/players${query}`);
        if (!isAgent && result.it) {
          formatTable(result.it.map((p: any) => ({
            id: p.pi ?? p.i,
            n: p.n,
            pos: posLabel(p.pos),
            points: p.p ?? '?',
            minutes: p.mt ?? '?',
          })), [
            { key: 'id', label: 'ID', width: 12 },
            { key: 'n', label: 'Name', width: 25 },
            { key: 'pos', label: 'Pos', width: 5 },
            { key: 'points', label: 'Pts', width: 6 },
            { key: 'minutes', label: 'Min', width: 5 },
          ]);
          result._printed = true;
        }
        respond('kickbase competitions players', result, [
          { command: `kickbase competitions players-search ${competitionId} --query "name"`, description: 'Search players' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions players', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  comp
    .command('players-search <competitionId>')
    .description('Search players in a competition')
    .option('--league <leagueId>', 'Filter by league')
    .option('--query <q>', 'Search by name')
    .option('--start <n>', 'Offset', '0')
    .option('--max <n>', 'Max results', '25')
    .action(async (competitionId: string, opts: any) => {
      try {
        const params = new URLSearchParams();
        if (opts.league) params.set('leagueId', opts.league);
        if (opts.query) params.set('query', opts.query);
        params.set('start', opts.start);
        params.set('max', opts.max);
        const result = await client.get<any>(`/v4/competitions/${competitionId}/players/search?${params}`);
        if (!isAgent && result.it) {
          formatTable(result.it.map((p: any) => ({
            id: p.pi ?? p.i,
            name: p.n,
            pos: posLabel(p.pos),
            value: fmtMoney(p.mv),
          })), [
            { key: 'id', label: 'ID', width: 12 },
            { key: 'name', label: 'Name', width: 25 },
            { key: 'pos', label: 'Pos', width: 5 },
            { key: 'value', label: 'Value', width: 8 },
          ]);
          result._printed = true;
        }
        respond('kickbase competitions players-search', result, []);
      } catch (err: any) {
        respondError('kickbase competitions players-search', err.message, 'FETCH_FAILED',
          `Check that competition ID "${competitionId}" is valid.`);
      }
    });

  comp
    .command('player <competitionId> <playerId>')
    .description('Get individual player details in a competition')
    .action(async (competitionId: string, playerId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/players/${playerId}`);
        if (!isAgent) {
          console.log(`${result.fn ?? ''} ${result.ln ?? result.n ?? 'Unknown'} (${result.tn ?? ''})`);
          console.log(`Position: ${posLabel(result.pos)} | Value: ${fmtMoney(result.mv)} | Avg: ${result.ap ?? 'N/A'}`);
          console.log(`Goals: ${result.g ?? 0} | Assists: ${result.a ?? 0} | Total Pts: ${result.tp ?? 0}`);
          result._printed = true;
        }
        respond('kickbase competitions player', result, [
          { command: `kickbase competitions player-performance ${competitionId} ${playerId}`, description: 'View performance' },
          { command: `kickbase competitions player-events ${competitionId} ${playerId}`, description: 'View events' },
          { command: `kickbase competitions player-marketvalue ${competitionId} ${playerId}`, description: 'View market value' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions player', err.message, 'FETCH_FAILED',
          'Check that competition and player IDs are valid.');
      }
    });

  comp
    .command('player-performance <competitionId> <playerId>')
    .description('Get player performance history')
    .action(async (competitionId: string, playerId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/players/${playerId}/performance`);
        if (!isAgent && Array.isArray(result.it)) {
          for (const season of result.it.slice(0, 3)) {
            const games = Array.isArray(season.ph) ? season.ph.length : 0;
            const recent = (season.ph ?? []).filter((g: any) => g.p !== undefined).slice(-3);
            const recentText = recent.map((g: any) => `MD${g.day}:${g.p}`).join(', ');
            console.log(`${season.ti ?? season.n}: ${games} matchdays${recentText ? ` | recent ${recentText}` : ''}`);
          }
          result._printed = true;
        }
        respond('kickbase competitions player-performance', result, [
          { command: `kickbase competitions player-events ${competitionId} ${playerId}`, description: 'View event history' },
          { command: `kickbase competitions player-marketvalue ${competitionId} ${playerId}`, description: 'View market value chart' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions player-performance', err.message, 'FETCH_FAILED',
          'Check that competition and player IDs are valid.');
      }
    });

  comp
    .command('player-events <competitionId> <playerId>')
    .description('Get player event history')
    .option('--day <dayNumber>', 'Filter by matchday')
    .action(async (competitionId: string, playerId: string, opts: any) => {
      try {
        const query = opts.day ? `?dayNumber=${opts.day}` : '';
        const result = await client.get<any>(`/v4/competitions/${competitionId}/playercenter/${playerId}${query}`);
        if (!isAgent) {
          console.log(`${result.n ?? playerId} | ${result.t1g ?? '?'}-${result.t2g ?? '?'} | ${result.p ?? 0} pts`);
          console.log(`Minutes: ${result.mt ?? '?'} | Status: ${result.st ?? '?'}`);
          if (Array.isArray(result.events)) {
            console.log(`Events (${result.events.length})`);
            for (const e of result.events.slice(0, 20)) {
              console.log(`  ${e.mt ?? '?'}' eti=${e.eti ?? '?'} pts=${e.p ?? 0}${e.att !== undefined ? ` att=${e.att}` : ''}`);
            }
            if (result.events.length > 20) console.log(`  ... ${result.events.length - 20} more`);
          }
          result._printed = true;
        }
        respond('kickbase competitions player-events', result, [
          { command: `kickbase competitions player-performance ${competitionId} ${playerId}`, description: 'View performance' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions player-events', err.message, 'FETCH_FAILED',
          'Check that competition and player IDs are valid.');
      }
    });

  comp
    .command('player-marketvalue <competitionId> <playerId>')
    .description('Get player market value chart')
    .option('--timeframe <days>', 'Timeframe in days (92 or 365)', '365')
    .action(async (competitionId: string, playerId: string, opts: any) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/players/${playerId}/marketvalue/${opts.timeframe}`);
        if (!isAgent) {
          const points = Array.isArray(result.it) ? result.it : [];
          const latest = points[points.length - 1];
          console.log(`Points: ${points.length}`);
          console.log(`Current: ${fmtMoney(latest?.mv)}`);
          console.log(`Low/High: ${fmtMoney(result.lmv)} / ${fmtMoney(result.hmv)}`);
          result._printed = true;
        }
        respond('kickbase competitions player-marketvalue', result, [
          { command: `kickbase competitions player-performance ${competitionId} ${playerId}`, description: 'View performance' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions player-marketvalue', err.message, 'FETCH_FAILED',
          'Check that competition and player IDs are valid.');
      }
    });

  // --- Teams ---

  comp
    .command('team-matchday <competitionId> <teamId>')
    .description('Get team players for a matchday')
    .option('--day <dayNumber>', 'Matchday number')
    .action(async (competitionId: string, teamId: string, opts: any) => {
      try {
        const query = opts.day ? `?dayNumber=${opts.day}` : '';
        const result = await client.get<any>(`/v4/competitions/${competitionId}/teams/${teamId}/teamcenter${query}`);
        if (!isAgent) {
          console.log(`${result.tn ?? teamId} | Matchday points: ${result.p ?? '?'} | Place: ${result.pl ?? '?'}`);
          if (result.ma) {
            console.log(`Match: ${result.ma.t1 ?? '?'}-${result.ma.t2 ?? '?'} (${result.ma.t1g ?? '?'}:${result.ma.t2g ?? '?'})`);
          }
          if (Array.isArray(result.it)) {
            formatTable(result.it.map((p: any) => ({
              name: p.n,
              pts: p.p ?? '?',
              status: p.mdst ?? '?',
              keys: Array.isArray(p.k) ? p.k.join(',') : '',
            })), [
              { key: 'name', label: 'Player', width: 20 },
              { key: 'pts', label: 'Pts', width: 6 },
              { key: 'status', label: 'St', width: 3 },
              { key: 'keys', label: 'K', width: 8 },
            ]);
          }
          result._printed = true;
        }
        respond('kickbase competitions team-matchday', result, [
          { command: `kickbase competitions team-profile ${competitionId} ${teamId}`, description: 'View all team players' },
        ]);
      } catch (err: any) {
        respondError('kickbase competitions team-matchday', err.message, 'FETCH_FAILED',
          'Check that competition and team IDs are valid.');
      }
    });

  comp
    .command('team-profile <competitionId> <teamId>')
    .description('Get all players on a team')
    .action(async (competitionId: string, teamId: string) => {
      try {
        const result = await client.get<any>(`/v4/competitions/${competitionId}/teams/${teamId}/teamprofile`);
        if (!isAgent && result.it) {
          console.log(`${result.tn ?? teamId} | Squad ${result.npt ?? result.it.length} | Team value ${fmtMoney(result.tv)}`);
          formatTable(result.it.map((p: any) => ({
            id: p.i,
            name: p.n,
            pos: posLabel(p.pos),
            value: fmtMoney(p.mv),
            avg: p.ap ?? '',
            prob: p.prob ?? '',
          })), [
            { key: 'id', label: 'ID', width: 12 },
            { key: 'name', label: 'Name', width: 22 },
            { key: 'pos', label: 'Pos', width: 4 },
            { key: 'value', label: 'Value', width: 8 },
            { key: 'avg', label: 'Avg', width: 4 },
            { key: 'prob', label: 'Prob', width: 4 },
          ]);
          result._printed = true;
        }
        respond('kickbase competitions team-profile', result, []);
      } catch (err: any) {
        respondError('kickbase competitions team-profile', err.message, 'FETCH_FAILED',
          'Check that competition and team IDs are valid.');
      }
    });
}
