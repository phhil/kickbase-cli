import { respond, respondError, isAgent, formatTable, formatKeyValue } from '../lib/envelope.js';
import { resolveLeagueId } from '../lib/config.js';
import { c } from '../lib/colors.js';
import { POSITION, PROB, STATUS, STATUS_SHORT, decodeEvents, formatSeconds } from '../lib/mappings.js';
export function registerLeagueCommands(program, client) {
    const leagues = program.command('leagues').description('League management, market, lineup, players');
    const fmtMoney = (n) => (typeof n === 'number' ? c.money(n) : '?');
    const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '?');
    const posLabel = (pos) => POSITION[pos ?? -1] ?? String(pos ?? '?');
    const probLabel = (prob) => PROB[prob ?? -1] ?? String(prob ?? '?');
    const statusLabel = (st) => STATUS_SHORT[st ?? -1] ?? STATUS[st ?? -1] ?? String(st ?? '?');
    // --- Selection & Overview ---
    leagues
        .command('list')
        .description('List all leagues you are in')
        .action(async () => {
        try {
            const result = await client.get('/v4/leagues/selection');
            if (!isAgent && result.it) {
                formatTable(result.it.map((l) => ({
                    id: l.i,
                    name: l.n,
                    managers: l.pl ?? '?',
                    squad: l.clpc ?? l.lpc ?? '?',
                    budget: fmtMoney(l.b),
                    teamValue: fmtMoney(l.tv),
                    rankMode: l.rnkm ?? '?',
                })), [
                    { key: 'id', label: 'ID', width: 10 },
                    { key: 'name', label: 'Name', width: 22 },
                    { key: 'managers', label: 'Mgrs', width: 4 },
                    { key: 'squad', label: 'Squad', width: 5 },
                    { key: 'budget', label: 'Budget', width: 9 },
                    { key: 'teamValue', label: 'Team Value', width: 10 },
                    { key: 'rankMode', label: 'Rank', width: 4 },
                ]);
            }
            respond('kickbase leagues list', { ...result, _printed: !isAgent }, [
                ...(result.it ?? []).slice(0, 3).map((l) => ({
                    command: `kickbase leagues overview ${l.i}`,
                    description: `View league "${l.n ?? l.i}"`,
                })),
            ]);
        }
        catch (err) {
            respondError('kickbase leagues list', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    leagues
        .command('overview [leagueId]')
        .description('Get league info')
        .option('--include-managers', 'Include managers and battles')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const query = opts.includeManagers ? '?includeManagersAndBattles=true' : '';
            const result = await client.get(`/v4/leagues/${lid}/overview${query}`);
            if (!isAgent) {
                console.log(c.header(`\n  League Overview: ${result.lnm ?? result.n ?? lid}\n`));
                formatKeyValue({
                    competition: result.cpn ?? result.cpi,
                    created: fmtDate(result.dt),
                    budget: fmtMoney(result.b),
                    maxManagers: result.mgm ?? result.mgc,
                    currentManagers: Array.isArray(result.mid) ? result.mid.length : undefined,
                    maxPlayersPerUser: result.mppu,
                    marketSlots: result.mpst,
                    marketOpen: result.ism,
                    adminMode: result.amd,
                    rankMode: result.rnkm,
                    description: result.d,
                }, [
                    { key: 'competition', label: 'Competition' },
                    { key: 'created', label: 'Created' },
                    { key: 'budget', label: 'Start Budget' },
                    { key: 'currentManagers', label: 'Managers' },
                    { key: 'maxManagers', label: 'Max Managers' },
                    { key: 'maxPlayersPerUser', label: 'Squad Limit' },
                    { key: 'marketSlots', label: 'Market Slots' },
                    { key: 'marketOpen', label: 'Market Open' },
                    { key: 'adminMode', label: 'Admin Mode' },
                    { key: 'rankMode', label: 'Rank Mode' },
                    { key: 'description', label: 'Description' },
                ]);
                console.log('');
            }
            respond('kickbase leagues overview', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues ranking ${lid}`, description: 'View ranking' },
                { command: `kickbase leagues squad ${lid}`, description: 'View your squad' },
                { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues overview', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('settings [leagueId]')
        .description('Get league settings (admin only)')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/settings`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues settings', result, [
                { command: `kickbase leagues settings-managers ${lid}`, description: 'View members' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues settings', err.message, 'FETCH_FAILED', 'You may not have admin access to this league.');
        }
    });
    leagues
        .command('settings-managers [leagueId]')
        .description('List league members (admin only)')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/settings/managers`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 14 },
                    { key: 'n', label: 'Name', width: 25 },
                ]);
            }
            respond('kickbase leagues settings-managers', result, []);
        }
        catch (err) {
            respondError('kickbase leagues settings-managers', err.message, 'FETCH_FAILED', 'You may not have admin access to this league.');
        }
    });
    // --- Ranking ---
    leagues
        .command('ranking [leagueId]')
        .description('Get full league ranking')
        .option('--day <dayNumber>', 'Filter by matchday')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const query = opts.day ? `?dayNumber=${opts.day}` : '';
            const result = await client.get(`/v4/leagues/${lid}/ranking${query}`);
            const users = result.us ?? result.it ?? [];
            if (!isAgent && users.length > 0) {
                const sortedUsers = [...users].sort((a, b) => (a.spl ?? a.pl ?? 999) - (b.spl ?? b.pl ?? 999));
                formatTable(sortedUsers.map((u) => ({
                    rank: u.spl ?? u.pl ?? '?',
                    name: u.n,
                    points: u.sp ?? '?',
                    md: u.mdp ?? '?',
                    teamValue: fmtMoney(u.tv),
                })), [
                    { key: 'rank', label: '#', width: 3 },
                    { key: 'name', label: 'Manager', width: 20 },
                    { key: 'points', label: 'Points', width: 8 },
                    { key: 'md', label: 'MD', width: 5 },
                    { key: 'teamValue', label: 'Team Value', width: 10 },
                ]);
            }
            respond('kickbase leagues ranking', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues overview ${lid}`, description: 'View league overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues ranking', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    // --- My Account ---
    leagues
        .command('me [leagueId]')
        .description('Get your stats in a league')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/me`);
            if (!isAgent) {
                console.log(c.header(`\n  My League Status: ${result.lnm ?? lid}\n`));
                formatKeyValue({
                    competition: result.cpi,
                    budget: fmtMoney(result.b),
                    bonusStreak: result.bs,
                    marketSlots: result.mpst,
                    maxPlayersPerUser: result.mppu,
                    rankMode: result.rnkm,
                }, [
                    { key: 'competition', label: 'Competition' },
                    { key: 'budget', label: 'Budget' },
                    { key: 'bonusStreak', label: 'Bonus Streak' },
                    { key: 'marketSlots', label: 'Market Slots' },
                    { key: 'maxPlayersPerUser', label: 'Squad Limit' },
                    { key: 'rankMode', label: 'Rank Mode' },
                ]);
                if (Array.isArray(result.tpc) && result.tpc.length > 0) {
                    console.log('\n  Players by Team');
                    formatTable(result.tpc.map((t) => ({
                        teamId: t.tid,
                        count: t.npt ?? 0,
                    })), [
                        { key: 'teamId', label: 'Team ID', width: 7 },
                        { key: 'count', label: 'Players', width: 7 },
                    ]);
                }
                console.log('');
            }
            respond('kickbase leagues me', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues budget ${lid}`, description: 'View budget' },
                { command: `kickbase leagues squad ${lid}`, description: 'View squad' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues me', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('budget [leagueId]')
        .description('Get your budget info')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/me/budget`);
            if (!isAgent) {
                console.log(c.header('\n  Budget\n'));
                formatKeyValue({
                    budget: fmtMoney(result.b ?? result.budget),
                    pendingBudget: fmtMoney(result.pbas),
                    bonusStreak: result.bs,
                }, [
                    { key: 'budget', label: 'Budget' },
                    { key: 'pendingBudget', label: 'Pending Budget' },
                    { key: 'bonusStreak', label: 'Bonus Streak' },
                ]);
                console.log('');
            }
            respond('kickbase leagues budget', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
                { command: `kickbase leagues squad ${lid}`, description: 'View your squad' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues budget', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('squad [leagueId]')
        .description('Get your players')
        .option('--details', 'Include full player details (team, goals, assists, trend)')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/squad`);
            const players = result.it ?? [];
            if (opts.details && players.length > 0) {
                // Fetch all player details in parallel
                const details = await Promise.all(players.map((p) => client.get(`/v4/leagues/${lid}/players/${p.i}`).catch(() => null)));
                const enriched = players.map((p, idx) => {
                    const d = details[idx];
                    return {
                        ...p,
                        tn: d?.tn ?? '',
                        g: d?.g ?? 0,
                        a: d?.a ?? 0,
                        cv: d?.cv ?? p.mv,
                        trendDay: p.mvgl ?? 0,
                    };
                });
                const posMap = { 1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW' };
                if (!isAgent) {
                    const sorted = [...enriched].sort((a, b) => (b.ap ?? 0) - (a.ap ?? 0));
                    formatTable(sorted.map((p) => ({
                        name: p.n,
                        pos: posMap[p.pos] ?? p.pos,
                        team: p.tn,
                        value: (p.mv / 1_000_000).toFixed(1) + 'M',
                        sellVal: (p.cv / 1_000_000).toFixed(1) + 'M',
                        avgPts: p.ap,
                        goals: p.g,
                        assists: p.a,
                        trend: p.trendDay > 0 ? `▲ +${(p.trendDay / 1_000_000).toFixed(1)}M` : p.trendDay < 0 ? `▼ ${(p.trendDay / 1_000_000).toFixed(1)}M` : '—',
                    })), [
                        { key: 'name', label: 'Player', width: 16 },
                        { key: 'pos', label: 'Pos', width: 4 },
                        { key: 'team', label: 'Team', width: 14 },
                        { key: 'value', label: 'Value', width: 8 },
                        { key: 'sellVal', label: 'Sell @', width: 8 },
                        { key: 'avgPts', label: 'Avg', width: 5 },
                        { key: 'goals', label: 'G', width: 3 },
                        { key: 'assists', label: 'A', width: 3 },
                        { key: 'trend', label: 'Trend', width: 10 },
                    ]);
                }
                respond('kickbase leagues squad', { players: enriched, count: enriched.length }, [
                    { command: `kickbase leagues lineup ${lid}`, description: 'View/set lineup' },
                    { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
                    { command: `kickbase leagues budget ${lid}`, description: 'Check budget' },
                ]);
            }
            else {
                if (!isAgent && players.length > 0) {
                    const posMap = { 1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW' };
                    formatTable(players.map((p) => ({
                        name: p.n,
                        pos: posMap[p.pos] ?? p.pos,
                        value: (p.mv / 1_000_000).toFixed(1) + 'M',
                        avgPts: p.ap,
                        trend: (p.mvgl ?? 0) > 0 ? '▲' : (p.mvgl ?? 0) < 0 ? '▼' : '—',
                    })), [
                        { key: 'name', label: 'Player', width: 16 },
                        { key: 'pos', label: 'Pos', width: 4 },
                        { key: 'value', label: 'Value', width: 8 },
                        { key: 'avgPts', label: 'Avg', width: 5 },
                        { key: 'trend', label: '~', width: 3 },
                    ]);
                }
                respond('kickbase leagues squad', result, [
                    { command: `kickbase leagues squad ${lid} --details`, description: 'View full details' },
                    { command: `kickbase leagues lineup ${lid}`, description: 'View/set lineup' },
                    { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
                ]);
            }
        }
        catch (err) {
            respondError('kickbase leagues squad', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('lineup [leagueId]')
        .description('Get your current lineup')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/lineup`);
            if (!isAgent) {
                const players = result.it ?? [];
                const formationCounts = players.reduce((acc, p) => {
                    const key = posLabel(p.pos);
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                }, {});
                const formation = `GK:${formationCounts.GK ?? 0} DEF:${formationCounts.DEF ?? 0} MF:${formationCounts.MF ?? 0} FW:${formationCounts.FW ?? 0}`;
                console.log(c.header('\n  Current Lineup\n'));
                console.log(`  ${c.dim('Formation')} ${formation}\n`);
                formatTable(players
                    .slice()
                    .sort((a, b) => (a.lo ?? 99) - (b.lo ?? 99))
                    .map((p) => {
                    const recent = Array.isArray(p.ph)
                        ? p.ph.filter((e) => e?.hp && typeof e.p === 'number').map((e) => e.p)
                        : [];
                    const recentAvg = recent.length ? (recent.reduce((s, n) => s + n, 0) / recent.length).toFixed(0) : '-';
                    return {
                        slot: p.lo ?? 'B',
                        name: p.n,
                        pos: posLabel(p.pos),
                        avg: p.ap ?? '-',
                        l5: recentAvg,
                        prob: probLabel(p.prob),
                        bench: p.ht ? 'yes' : '',
                    };
                }), [
                    { key: 'slot', label: 'Slot', width: 4 },
                    { key: 'name', label: 'Player', width: 18 },
                    { key: 'pos', label: 'Pos', width: 4 },
                    { key: 'avg', label: 'Avg', width: 5 },
                    { key: 'l5', label: 'L5', width: 4 },
                    { key: 'prob', label: 'Prob', width: 10 },
                    { key: 'bench', label: 'Bench', width: 5 },
                ]);
                console.log('');
            }
            respond('kickbase leagues lineup', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues squad ${lid}`, description: 'View full squad' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('lineup-set [leagueId]')
        .description('Update your lineup')
        .requiredOption('--data <json>', 'Lineup data as JSON')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const body = JSON.parse(opts.data);
            const result = await client.post(`/v4/leagues/${lid}/lineup`, body);
            if (!isAgent)
                console.log('Lineup updated.');
            respond('kickbase leagues lineup-set', result, [
                { command: `kickbase leagues lineup ${lid}`, description: 'View updated lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-set', err.message, 'ACTION_FAILED', 'Check your lineup data JSON format.');
        }
    });
    leagues
        .command('lineup-overview [leagueId]')
        .description('Get rich lineup overview with matchday info and player details')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/lineup/overview`);
            if (!isAgent) {
                console.log(`Matchday: ${result.mdln ?? '?'} | Deadline: ${fmtDate(result.lis)} | Formation: ${result.t ?? '?'}`);
                if (result.lp) {
                    formatTable(result.lp.map((p) => ({
                        name: p.n,
                        pos: posLabel(p.pos),
                        avgPts: p.ap,
                        value: ((p.mv ?? 0) / 1_000_000).toFixed(1) + 'M',
                        prob: probLabel(p.prob),
                        status: statusLabel(p.st),
                    })), [
                        { key: 'name', label: 'Player', width: 16 },
                        { key: 'pos', label: 'Pos', width: 4 },
                        { key: 'avgPts', label: 'Avg', width: 5 },
                        { key: 'value', label: 'Value', width: 8 },
                        { key: 'prob', label: 'Prob', width: 10 },
                        { key: 'status', label: 'Status', width: 6 },
                    ]);
                }
            }
            respond('kickbase leagues lineup-overview', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues lineup-selection ${lid}`, description: 'Browse available players' },
                { command: `kickbase leagues lineup-teams ${lid}`, description: 'View teams' },
                { command: `kickbase leagues lineup-fill ${lid}`, description: 'Autofill lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-overview', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('lineup-selection [leagueId]')
        .description('Browse available players for lineup selection')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/lineup/selection`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues lineup-selection', result, [
                { command: `kickbase leagues lineup-overview ${lid}`, description: 'View lineup overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-selection', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('lineup-teams [leagueId]')
        .description('List teams for lineup filtering')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/lineup/teams`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues lineup-teams', result, [
                { command: `kickbase leagues lineup-overview ${lid}`, description: 'View lineup overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-teams', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('lineup-fill [leagueId]')
        .description('Autofill your league lineup')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/lineup/fill`);
            if (!isAgent)
                console.log('Lineup autofilled.');
            respond('kickbase leagues lineup-fill', result, [
                { command: `kickbase leagues lineup-overview ${lid}`, description: 'View updated lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-fill', err.message, 'ACTION_FAILED', 'Autofill may not be available.');
        }
    });
    leagues
        .command('lineup-clear [leagueId]')
        .description('Clear your league lineup')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/lineup/clear`);
            if (!isAgent)
                console.log('Lineup cleared.');
            respond('kickbase leagues lineup-clear', result, [
                { command: `kickbase leagues lineup-overview ${lid}`, description: 'View lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues lineup-clear', err.message, 'ACTION_FAILED', 'Clear may not be available.');
        }
    });
    leagues
        .command('myeleven [leagueId]')
        .description('Get your best eleven')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/teamcenter/myeleven`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues myeleven', result, [
                { command: `kickbase leagues squad ${lid}`, description: 'View full squad' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues myeleven', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    // --- Transfer Market ---
    leagues
        .command('market [leagueId]')
        .description('View players on the transfer market')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/market`);
            if (!isAgent && result.it) {
                formatTable(result.it.map((p) => ({
                    id: p.i,
                    name: p.n,
                    pos: posLabel(p.pos),
                    status: statusLabel(p.st),
                    prob: probLabel(p.prob),
                    price: fmtMoney(p.prc ?? p.p ?? p.mv),
                    mv: fmtMoney(p.mv),
                    avg: p.ap ?? '-',
                    owner: p.u?.n ?? 'KB',
                    fresh: p.isn ? 'NEW' : '',
                })), [
                    { key: 'id', label: 'ID', width: 6 },
                    { key: 'name', label: 'Name', width: 18 },
                    { key: 'pos', label: 'Pos', width: 4 },
                    { key: 'status', label: 'St', width: 4 },
                    { key: 'prob', label: 'Prob', width: 10 },
                    { key: 'avg', label: 'Avg', width: 5 },
                    { key: 'price', label: 'Price', width: 9 },
                    { key: 'owner', label: 'Seller', width: 10 },
                    { key: 'fresh', label: 'New', width: 3 },
                ]);
                if (result.dt || result.nps != null) {
                    console.log(`\nMarket deadline: ${fmtDate(result.dt)} | Slots left: ${result.nps ?? '?'} | Team value: ${fmtMoney(result.tv)}`);
                }
            }
            respond('kickbase leagues market', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues budget ${lid}`, description: 'Check your budget' },
                { command: `kickbase transfer-check ${lid}`, description: 'Read-only market analysis' },
                ...(result.it ?? []).slice(0, 3).map((p) => ({
                    command: `kickbase leagues market-offer ${lid} ${p.i} --amount <price>`,
                    description: `Place offer for ${p.n ?? p.i}`,
                })),
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('market-list [leagueId]')
        .description('Put a player on the transfer market')
        .requiredOption('--data <json>', 'Transfer listing data as JSON')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const body = JSON.parse(opts.data);
            const result = await client.post(`/v4/leagues/${lid}/market`, body);
            if (!isAgent)
                console.log('Player listed on transfer market.');
            respond('kickbase leagues market-list', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-list', err.message, 'ACTION_FAILED', 'Check your transfer listing data format.');
        }
    });
    leagues
        .command('market-remove [leagueId] <playerId>')
        .description('Remove player from transfer market')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.delete(`/v4/leagues/${lid}/market/${playerId}`);
            if (!isAgent)
                console.log(`Player ${playerId} removed from market.`);
            respond('kickbase leagues market-remove', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-remove', err.message, 'ACTION_FAILED', 'Check that player ID is valid and you own this player.');
        }
    });
    leagues
        .command('market-offer [leagueId] <playerId>')
        .description('Place an offer on a player')
        .requiredOption('--amount <n>', 'Offer amount')
        .action(async (leagueId, playerId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/market/${playerId}/offers`, { price: parseInt(opts.amount, 10) });
            if (!isAgent)
                console.log(`Offer placed: ${opts.amount}`);
            respond('kickbase leagues market-offer', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View market' },
                { command: `kickbase leagues budget ${lid}`, description: 'Check remaining budget' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-offer', err.message, 'ACTION_FAILED', 'Check your budget and that the player is on the market.');
        }
    });
    leagues
        .command('market-withdraw [leagueId] <playerId> <offerId>')
        .description('Withdraw an offer')
        .action(async (leagueId, playerId, offerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.delete(`/v4/leagues/${lid}/market/${playerId}/offers/${offerId}`);
            if (!isAgent)
                console.log('Offer withdrawn.');
            respond('kickbase leagues market-withdraw', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-withdraw', err.message, 'ACTION_FAILED', 'Check that the offer ID is valid.');
        }
    });
    leagues
        .command('market-accept [leagueId] <playerId> <offerId>')
        .description('Accept an offer on your player')
        .action(async (leagueId, playerId, offerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/market/${playerId}/offers/${offerId}/accept`);
            if (!isAgent)
                console.log('Offer accepted.');
            respond('kickbase leagues market-accept', result, [
                { command: `kickbase leagues squad ${lid}`, description: 'View updated squad' },
                { command: `kickbase leagues budget ${lid}`, description: 'Check budget' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-accept', err.message, 'ACTION_FAILED', 'Check that the offer is still valid.');
        }
    });
    leagues
        .command('market-decline [leagueId] <playerId> <offerId>')
        .description('Decline an offer on your player')
        .action(async (leagueId, playerId, offerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/market/${playerId}/offers/${offerId}/decline`);
            if (!isAgent)
                console.log('Offer declined.');
            respond('kickbase leagues market-decline', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-decline', err.message, 'ACTION_FAILED', 'Check that the offer is still valid.');
        }
    });
    leagues
        .command('market-sell [leagueId] <playerId>')
        .description('Accept Kickbase offer for a player')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/market/${playerId}/sell`);
            if (!isAgent)
                console.log(`Player ${playerId} sold to Kickbase.`);
            respond('kickbase leagues market-sell', result, [
                { command: `kickbase leagues squad ${lid}`, description: 'View updated squad' },
                { command: `kickbase leagues budget ${lid}`, description: 'Check budget' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues market-sell', err.message, 'ACTION_FAILED', 'Check that the player is listed and a Kickbase offer exists.');
        }
    });
    // --- Player Details ---
    leagues
        .command('player [leagueId] <playerId>')
        .description('Get player details')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const [result, perf, ranking] = await Promise.all([
                client.get(`/v4/leagues/${lid}/players/${playerId}`),
                client.get(`/v4/leagues/${lid}/players/${playerId}/performance`).catch(() => null),
                client.get(`/v4/leagues/${lid}/ranking`).catch(() => null),
            ]);
            if (!isAgent) {
                const pos = POSITION[result.pos] ?? result.pos;
                const prob = PROB[result.prob] ?? `${result.prob}`;
                const status = STATUS[result.st] ?? `${result.st}`;
                const ownerUser = result.oui !== '0' && ranking?.us
                    ? ranking.us.find((u) => u.i === result.oui)
                    : null;
                const owner = result.oui === '0' ? 'Kickbase' : ownerUser ? ownerUser.n : result.oui ? `Manager ${result.oui}` : '?';
                console.log(c.header(`\n  ${result.fn} ${result.ln} #${result.shn ?? '?'}\n`));
                formatKeyValue({
                    team: result.tn,
                    position: pos,
                    status: result.stxt ? `${status} — ${result.stxt}` : status,
                    availability: prob,
                    owner,
                    value: c.money(result.mv ?? 0),
                    sellValue: c.money(result.cv ?? result.mv ?? 0),
                    trend: c.trendMoney(result.mvt ?? 0),
                    avgPts: result.ap,
                    totalPts: result.tp,
                    timePlayed: result.sec ? formatSeconds(result.sec) : '?',
                    goals: result.g,
                    assists: result.a,
                    yellowCards: result.y,
                    redCards: result.r,
                    listed: result.sl ? 'Yes' : 'No',
                }, [
                    { key: 'team', label: 'Team' },
                    { key: 'position', label: 'Position' },
                    { key: 'status', label: 'Status' },
                    { key: 'availability', label: 'Next Match' },
                    { key: 'owner', label: 'Owner' },
                    { key: 'value', label: 'Value' },
                    { key: 'sellValue', label: 'Sell Value' },
                    { key: 'trend', label: 'Trend' },
                    { key: 'avgPts', label: 'Avg Points' },
                    { key: 'totalPts', label: 'Total Points' },
                    { key: 'timePlayed', label: 'Time Played' },
                    { key: 'goals', label: 'Goals' },
                    { key: 'assists', label: 'Assists' },
                    { key: 'yellowCards', label: 'Yellow Cards' },
                    { key: 'redCards', label: 'Red Cards' },
                    { key: 'listed', label: 'On Market' },
                ]);
                // Upcoming matches
                if (result.mdsum?.length > 0) {
                    console.log(c.header('\n  Upcoming Matches\n'));
                    for (const m of result.mdsum) {
                        const score = m.mdst === 2 ? ` (${m.t1g}-${m.t2g})` : '';
                        const marker = m.cur ? ' ←' : '';
                        console.log(`  MD ${m.day}: ${m.t1} vs ${m.t2}${score}${marker}`);
                    }
                }
                // Recent performance (current season)
                if (perf?.it) {
                    const current = perf.it.find((s) => s.ti === '2025/2026') ?? perf.it[perf.it.length - 1];
                    if (current?.ph) {
                        const played = current.ph.filter((m) => m.p != null).slice(-10);
                        if (played.length > 0) {
                            console.log(c.header('\n  Recent Performance\n'));
                            formatTable(played.map((m) => ({
                                day: `MD ${m.day}`,
                                pts: m.p,
                                min: m.mp,
                                status: STATUS_SHORT[m.st] ?? m.st,
                                events: decodeEvents(m.k ?? []),
                            })), [
                                { key: 'day', label: 'Day', width: 6 },
                                { key: 'pts', label: 'Pts', width: 5 },
                                { key: 'min', label: 'Min', width: 5 },
                                { key: 'status', label: 'St', width: 4 },
                                { key: 'events', label: 'Events', width: 16 },
                            ]);
                        }
                    }
                }
                console.log('');
            }
            // Enrich result for agent mode
            respond('kickbase leagues player', {
                ...result,
                _printed: !isAgent,
                _decoded: {
                    position: POSITION[result.pos],
                    status: STATUS[result.st],
                    availability: PROB[result.prob],
                    owner: result.oui === '0' ? 'kickbase' : result.oui,
                },
            }, [
                { command: `kb leagues player-performance ${lid} ${playerId}`, description: 'View performance' },
                { command: `kb leagues player-transfers ${lid} ${playerId}`, description: 'View transfer history' },
                { command: `kb leagues player-marketvalue ${lid} ${playerId}`, description: 'View market value chart' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues player', err.message, 'FETCH_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('player-performance [leagueId] <playerId>')
        .description('Get player performance history')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/players/${playerId}/performance`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues player-performance', result, [
                { command: `kickbase leagues player ${lid} ${playerId}`, description: 'View player details' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues player-performance', err.message, 'FETCH_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('player-transfers [leagueId] <playerId>')
        .description('Get player transfer history')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/players/${playerId}/transfers`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues player-transfers', result, [
                { command: `kickbase leagues player ${lid} ${playerId}`, description: 'View player details' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues player-transfers', err.message, 'FETCH_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('player-transfer-history [leagueId] <playerId>')
        .description('Get detailed player transfer history')
        .option('--start <n>', 'Offset', '0')
        .action(async (leagueId, playerId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const query = `?start=${opts.start}`;
            const result = await client.get(`/v4/leagues/${lid}/players/${playerId}/transferHistory${query}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues player-transfer-history', result, [
                { command: `kickbase leagues player ${lid} ${playerId}`, description: 'View player details' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues player-transfer-history', err.message, 'FETCH_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('player-marketvalue [leagueId] <playerId>')
        .description('Get player market value chart')
        .option('--timeframe <days>', 'Timeframe in days (92 or 365)', '365')
        .action(async (leagueId, playerId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/players/${playerId}/marketvalue/${opts.timeframe}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues player-marketvalue', result, [
                { command: `kickbase leagues player ${lid} ${playerId}`, description: 'View player details' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues player-marketvalue', err.message, 'FETCH_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    // --- Scouted Players ---
    leagues
        .command('scouted [leagueId]')
        .description('List scouted players')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/scoutedplayers`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 14 },
                    { key: 'n', label: 'Name', width: 25 },
                    { key: 'pos', label: 'Pos', width: 5 },
                    { key: 'mv', label: 'Value', width: 12 },
                ]);
            }
            respond('kickbase leagues scouted', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues scouted', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('scout-add [leagueId] <playerId>')
        .description('Add player to scouted list')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/scoutedplayers/${playerId}`);
            if (!isAgent)
                console.log(`Player ${playerId} added to scouted list.`);
            respond('kickbase leagues scout-add', result, [
                { command: `kickbase leagues scouted ${lid}`, description: 'View scouted players' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues scout-add', err.message, 'ACTION_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('scout-remove [leagueId] <playerId>')
        .description('Remove player from scouted list')
        .action(async (leagueId, playerId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.delete(`/v4/leagues/${lid}/scoutedplayers/${playerId}`);
            if (!isAgent)
                console.log(`Player ${playerId} removed from scouted list.`);
            respond('kickbase leagues scout-remove', result, [
                { command: `kickbase leagues scouted ${lid}`, description: 'View scouted players' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues scout-remove', err.message, 'ACTION_FAILED', 'Check that league and player IDs are valid.');
        }
    });
    leagues
        .command('scout-clear [leagueId]')
        .description('Clear entire scouted players list')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.delete(`/v4/leagues/${lid}/scoutedplayers`);
            if (!isAgent)
                console.log('Scouted list cleared.');
            respond('kickbase leagues scout-clear', result, [
                { command: `kickbase leagues market ${lid}`, description: 'View transfer market' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues scout-clear', err.message, 'ACTION_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    // --- Manager Profiles ---
    leagues
        .command('manager [leagueId] <userId>')
        .description('Get manager dashboard')
        .action(async (leagueId, userId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/managers/${userId}/dashboard`);
            if (!isAgent) {
                const chalk = (await import('chalk')).default;
                console.log();
                console.log(chalk.bold(`  ${result.unm || 'Manager'}`));
                console.log(chalk.dim(`  League: ${result.lnm || lid}  |  ID: ${result.u}`));
                console.log();
                const fmtMoney = (v) => v != null ? `${(v / 1_000_000).toFixed(1)}M` : '?';
                const lines = [
                    ['Rank', result.pl != null ? `#${result.pl}` : '?'],
                    ['Total Points', result.tp?.toLocaleString('de-DE') ?? '?'],
                    ['Avg Points', result.ap?.toLocaleString('de-DE') ?? '?'],
                    ['Team Value', result.tv != null ? `${fmtMoney(result.tv)} (${result.tv?.toLocaleString('de-DE')})` : '?'],
                    ['Profit', result.prft != null ? c.trendMoney(result.prft) : '?'],
                    ['Transfers', String(result.t ?? '?')],
                    ['Matchday Wins', String(result.mdw ?? 0)],
                    ['Admin', result.adm ? 'Yes' : 'No'],
                ];
                if (result.ph?.length) {
                    lines.push(['Season Points', result.ph.map((p) => p != null ? String(p) : '-').join(' → ')]);
                }
                for (const [label, value] of lines) {
                    console.log(`  ${chalk.dim(label.padEnd(16))} ${value}`);
                }
                console.log();
                console.log(chalk.dim('  Related:'));
                console.log(`  ${chalk.cyan(`kb leagues manager-squad ${lid} ${userId}`)}     Squad`);
                console.log(`  ${chalk.cyan(`kb leagues manager-performance ${lid} ${userId}`)} Performance`);
                console.log(`  ${chalk.cyan(`kb leagues manager-transfers ${lid} ${userId}`)}  Transfers`);
                console.log();
            }
            respond('kickbase leagues manager', { ...result, _printed: !isAgent }, [
                { command: `kickbase leagues manager-performance ${lid} ${userId}`, description: 'View performance' },
                { command: `kickbase leagues manager-squad ${lid} ${userId}`, description: 'View squad' },
                { command: `kickbase leagues manager-transfers ${lid} ${userId}`, description: 'View transfers' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues manager', err.message, 'FETCH_FAILED', 'Check that league and user IDs are valid.');
        }
    });
    leagues
        .command('manager-performance [leagueId] <userId>')
        .description('Get manager performance')
        .action(async (leagueId, userId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/managers/${userId}/performance`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues manager-performance', result, [
                { command: `kickbase leagues manager ${lid} ${userId}`, description: 'View dashboard' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues manager-performance', err.message, 'FETCH_FAILED', 'Check that league and user IDs are valid.');
        }
    });
    leagues
        .command('manager-squad [leagueId] <userId>')
        .description('Get manager squad')
        .action(async (leagueId, userId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/managers/${userId}/squad`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 14 },
                    { key: 'n', label: 'Name', width: 25 },
                    { key: 'pos', label: 'Pos', width: 5 },
                    { key: 'mv', label: 'Value', width: 12 },
                ]);
            }
            respond('kickbase leagues manager-squad', result, [
                { command: `kickbase leagues manager ${lid} ${userId}`, description: 'View dashboard' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues manager-squad', err.message, 'FETCH_FAILED', 'Check that league and user IDs are valid.');
        }
    });
    leagues
        .command('manager-transfers [leagueId] <userId>')
        .description('Get manager transfer history')
        .option('--start <n>', 'Offset', '0')
        .action(async (leagueId, userId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const query = `?start=${opts.start}`;
            const result = await client.get(`/v4/leagues/${lid}/managers/${userId}/transfer${query}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues manager-transfers', result, [
                { command: `kickbase leagues manager ${lid} ${userId}`, description: 'View dashboard' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues manager-transfers', err.message, 'FETCH_FAILED', 'Check that league and user IDs are valid.');
        }
    });
    leagues
        .command('manager-teamcenter [leagueId] <userId>')
        .description('Get manager team center')
        .option('--day <dayNumber>', 'Matchday number')
        .action(async (leagueId, userId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const query = opts.day ? `?dayNumber=${opts.day}` : '';
            const result = await client.get(`/v4/leagues/${lid}/users/${userId}/teamcenter${query}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues manager-teamcenter', result, [
                { command: `kickbase leagues manager ${lid} ${userId}`, description: 'View dashboard' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues manager-teamcenter', err.message, 'FETCH_FAILED', 'Check that league and user IDs are valid.');
        }
    });
    // --- Teams ---
    leagues
        .command('team [leagueId] <teamId>')
        .description('Get team players')
        .action(async (leagueId, teamId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/teams/${teamId}/teamprofile/`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 14 },
                    { key: 'n', label: 'Name', width: 25 },
                    { key: 'pos', label: 'Pos', width: 5 },
                    { key: 'mv', label: 'Value', width: 12 },
                ]);
            }
            respond('kickbase leagues team', result, []);
        }
        catch (err) {
            respondError('kickbase leagues team', err.message, 'FETCH_FAILED', 'Check that league and team IDs are valid.');
        }
    });
    // --- Activity Feed ---
    leagues
        .command('feed [leagueId]')
        .description('View activity feed')
        .option('--start <n>', 'Offset', '0')
        .option('--max <n>', 'Max results', '25')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const params = new URLSearchParams({ start: opts.start, max: opts.max });
            const result = await client.get(`/v4/leagues/${lid}/activitiesFeed?${params}`);
            if (!isAgent && result.it) {
                for (const item of result.it.slice(0, 20)) {
                    console.log(`[${item.dt ?? ''}] ${item.txt ?? item.t ?? JSON.stringify(item)}`);
                }
                if (result.it.length > 20)
                    console.log(`... and ${result.it.length - 20} more`);
            }
            respond('kickbase leagues feed', result, [
                { command: `kickbase leagues feed ${lid} --start ${parseInt(opts.start) + parseInt(opts.max)}`, description: 'Next page' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues feed', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('feed-item [leagueId] <activityId>')
        .description('Get activity feed item details')
        .action(async (leagueId, activityId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/activitiesFeed/${activityId}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues feed-item', result, [
                { command: `kickbase leagues feed-comments ${lid} ${activityId}`, description: 'View comments' },
                { command: `kickbase leagues feed-comment ${lid} ${activityId} --text "..."`, description: 'Add comment' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues feed-item', err.message, 'FETCH_FAILED', 'Check that league and activity IDs are valid.');
        }
    });
    leagues
        .command('feed-comment [leagueId] <activityId>')
        .description('Comment on an activity')
        .requiredOption('--text <text>', 'Comment text')
        .action(async (leagueId, activityId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/activitiesFeed/${activityId}`, {
                txt: opts.text,
            });
            if (!isAgent)
                console.log('Comment posted.');
            respond('kickbase leagues feed-comment', result, [
                { command: `kickbase leagues feed-comments ${lid} ${activityId}`, description: 'View comments' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues feed-comment', err.message, 'ACTION_FAILED', 'Check that league and activity IDs are valid.');
        }
    });
    leagues
        .command('feed-comments [leagueId] <activityId>')
        .description('View comments on an activity')
        .option('--start <n>', 'Offset', '0')
        .option('--max <n>', 'Max results', '25')
        .action(async (leagueId, activityId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const params = new URLSearchParams({ start: opts.start, max: opts.max });
            const result = await client.get(`/v4/leagues/${lid}/activitiesFeed/${activityId}/comments?${params}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues feed-comments', result, [
                { command: `kickbase leagues feed-comment ${lid} ${activityId} --text "..."`, description: 'Add comment' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues feed-comments', err.message, 'FETCH_FAILED', 'Check that league and activity IDs are valid.');
        }
    });
    // --- Achievements & Battles ---
    leagues
        .command('achievements [leagueId]')
        .description('View all achievements')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/user/achievements`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues achievements', result, []);
        }
        catch (err) {
            respondError('kickbase leagues achievements', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('achievement [leagueId] <type>')
        .description('View achievement details by type')
        .action(async (leagueId, type) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/user/achievements/${type}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues achievement', result, [
                { command: `kickbase leagues achievements ${lid}`, description: 'View all achievements' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues achievement', err.message, 'FETCH_FAILED', 'Check that league ID and achievement type are valid.');
        }
    });
    leagues
        .command('battle [leagueId] <type>')
        .description('View battle ranking by type (1=Matchday Master, 2=Transfer King, 3=Overall, 4=Shot Stopper, 5=Defensive Dynamo, 6=Midfield Maestro, 7=Star Striker, 8=Points Prodigy)')
        .action(async (leagueId, type) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/leagues/${lid}/battles/${type}/users`);
            if (!isAgent) {
                if (result.n)
                    console.log(`${result.n}${result.d ? ` — ${result.d}` : ''}\n`);
                if (result.us) {
                    formatTable(result.us.map((u) => ({
                        place: u.pl,
                        name: u.u?.n ?? u.u?.unm ?? u.u?.i,
                        value: u.v ?? '',
                    })), [
                        { key: 'place', label: '#', width: 4 },
                        { key: 'name', label: 'Manager', width: 20 },
                        { key: 'value', label: 'Value', width: 12 },
                    ]);
                }
            }
            respond('kickbase leagues battle', result, [
                { command: `kickbase leagues achievements ${lid}`, description: 'View achievements' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues battle', err.message, 'FETCH_FAILED', 'Check that league ID and battle type are valid. Types: 1-8.');
        }
    });
    leagues
        .command('battles [leagueId]')
        .description('View all 8 battle categories at once')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const battles = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(t => client.get(`/v4/leagues/${lid}/battles/${t}/users`).catch(() => null)));
            const summary = battles.filter(Boolean).map((b, i) => ({
                type: i + 1,
                name: b.n ?? `Battle ${i + 1}`,
                description: b.d ?? '',
                leader: b.us?.[0]?.u?.n ?? b.us?.[0]?.u?.unm ?? '—',
                leaderValue: b.us?.[0]?.v ?? '',
            }));
            if (!isAgent) {
                formatTable(summary, [
                    { key: 'type', label: '#', width: 3 },
                    { key: 'name', label: 'Battle', width: 20 },
                    { key: 'leader', label: 'Leader', width: 16 },
                    { key: 'leaderValue', label: 'Value', width: 8 },
                ]);
            }
            respond('kickbase leagues battles', { battles: summary }, [
                ...summary.map(b => ({
                    command: `kickbase leagues battle ${lid} ${b.type}`,
                    description: `View ${b.name} details`,
                })),
            ]);
        }
        catch (err) {
            respondError('kickbase leagues battles', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    // --- League Discovery & Management ---
    leagues
        .command('all')
        .description('Get leagues root info')
        .action(async () => {
        try {
            const result = await client.get('/v4/leagues');
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues all', result, [
                { command: 'kickbase leagues list', description: 'View your leagues' },
                { command: 'kickbase leagues recommended', description: 'View recommended leagues' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues all', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    leagues
        .command('browse')
        .description('List public leagues to join')
        .action(async () => {
        try {
            const result = await client.get('/v4/leagues/list');
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'li', label: 'ID', width: 14 },
                    { key: 'lnm', label: 'Name', width: 25 },
                    { key: 'mgc', label: 'Members', width: 8 },
                    { key: 'mgm', label: 'Max', width: 5 },
                ]);
            }
            respond('kickbase leagues browse', result, [
                { command: 'kickbase leagues recommended', description: 'View recommended leagues' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues browse', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    leagues
        .command('recommended')
        .description('Get recommended leagues to join')
        .action(async () => {
        try {
            const result = await client.get('/v4/leagues/recommended');
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 14 },
                    { key: 'lnm', label: 'Name', width: 25 },
                    { key: 'cpn', label: 'Competition', width: 15 },
                    { key: 'mgc', label: 'Members', width: 8 },
                ]);
            }
            respond('kickbase leagues recommended', result, [
                { command: 'kickbase leagues browse', description: 'Browse all public leagues' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues recommended', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    leagues
        .command('create')
        .description('Create a new league')
        .requiredOption('--data <json>', 'League creation data as JSON')
        .action(async (opts) => {
        try {
            const body = JSON.parse(opts.data);
            const result = await client.post('/v4/leagues', body);
            if (!isAgent)
                console.log(`League created! ID: ${result.i ?? JSON.stringify(result)}`);
            respond('kickbase leagues create', result, [
                { command: 'kickbase leagues list', description: 'View your leagues' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues create', err.message, 'ACTION_FAILED', 'Check your league creation data format.');
        }
    });
    leagues
        .command('join <leagueId>')
        .description('Join a league')
        .option('--code <code>', 'Invitation code')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const path = opts.code
                ? `/v4/leagues/${lid}/join/${opts.code}`
                : `/v4/leagues/${lid}/join`;
            const result = await client.post(path);
            if (!isAgent)
                console.log(`Joined league ${lid}.`);
            respond('kickbase leagues join', result, [
                { command: `kickbase leagues overview ${lid}`, description: 'View league overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues join', err.message, 'ACTION_FAILED', 'Check that the league ID and invitation code are valid.');
        }
    });
    leagues
        .command('invite-code [leagueId]')
        .description('Get the invitation code for a league')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.get(`/v4/invitations/${lid}/code`);
            if (!isAgent)
                console.log(`Invitation code: ${result.cd ?? result.code ?? JSON.stringify(result)}`);
            respond('kickbase leagues invite-code', result, []);
        }
        catch (err) {
            respondError('kickbase leagues invite-code', err.message, 'FETCH_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    leagues
        .command('invite-validate <code>')
        .description('Validate a league invitation code')
        .action(async (code) => {
        try {
            const result = await client.get(`/v4/invitations/${code}/validate`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase leagues invite-validate', result, []);
        }
        catch (err) {
            respondError('kickbase leagues invite-validate', err.message, 'FETCH_FAILED', `Check that invitation code "${code}" is valid.`);
        }
    });
    leagues
        .command('image [leagueId]')
        .description('Upload a league image')
        .requiredOption('--data <json>', 'Image data as JSON')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const body = JSON.parse(opts.data);
            const result = await client.post(`/v4/leagues/${lid}/image`, body);
            if (!isAgent)
                console.log('League image updated.');
            respond('kickbase leagues image', result, []);
        }
        catch (err) {
            respondError('kickbase leagues image', err.message, 'ACTION_FAILED', 'Check your image data format.');
        }
    });
    leagues
        .command('setteamseen [leagueId]')
        .description('Mark teams as seen')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/setteamseen`);
            if (!isAgent)
                console.log('Teams marked as seen.');
            respond('kickbase leagues setteamseen', result, []);
        }
        catch (err) {
            respondError('kickbase leagues setteamseen', err.message, 'ACTION_FAILED', `Check that league ID "${leagueId ?? '(default)'}" is valid.`);
        }
    });
    // --- Admin ---
    leagues
        .command('admin-reset [leagueId]')
        .description('Reset league (admin only)')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/reset`);
            if (!isAgent)
                console.log('League reset.');
            respond('kickbase leagues admin-reset', result, []);
        }
        catch (err) {
            respondError('kickbase leagues admin-reset', err.message, 'ACTION_FAILED', 'You may not have admin access to this league.');
        }
    });
    leagues
        .command('admin-resetteams [leagueId]')
        .description('Reset teams in league (admin only)')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/resetteams`);
            if (!isAgent)
                console.log('Teams reset.');
            respond('kickbase leagues admin-resetteams', result, []);
        }
        catch (err) {
            respondError('kickbase leagues admin-resetteams', err.message, 'ACTION_FAILED', 'You may not have admin access to this league.');
        }
    });
    leagues
        .command('admin-settings-update [leagueId]')
        .description('Update league settings (admin only)')
        .requiredOption('--data <json>', 'Settings data as JSON')
        .action(async (leagueId, opts) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const body = JSON.parse(opts.data);
            const result = await client.post(`/v4/leagues/${lid}/settings`, body);
            if (!isAgent)
                console.log('League settings updated.');
            respond('kickbase leagues admin-settings-update', result, []);
        }
        catch (err) {
            respondError('kickbase leagues admin-settings-update', err.message, 'ACTION_FAILED', 'You may not have admin access to this league.');
        }
    });
    leagues
        .command('admin-unlock [leagueId] <userId>')
        .description('Unlock a user in the league (admin only)')
        .action(async (leagueId, userId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.post(`/v4/leagues/${lid}/users/${userId}/unlock`);
            if (!isAgent)
                console.log(`User ${userId} unlocked.`);
            respond('kickbase leagues admin-unlock', result, []);
        }
        catch (err) {
            respondError('kickbase leagues admin-unlock', err.message, 'ACTION_FAILED', 'You may not have admin access to this league.');
        }
    });
    leagues
        .command('kick [leagueId] <userId>')
        .description('Remove a user from the league')
        .action(async (leagueId, userId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const result = await client.delete(`/v4/leagues/${lid}/users/${userId}`);
            if (!isAgent)
                console.log(`User ${userId} removed from league.`);
            respond('kickbase leagues kick', result, [
                { command: `kickbase leagues settings-managers ${lid}`, description: 'View members' },
            ]);
        }
        catch (err) {
            respondError('kickbase leagues kick', err.message, 'ACTION_FAILED', 'You may not have permission to remove this user.');
        }
    });
}
