import { respond, respondError, isAgent, formatTable, formatKeyValue } from '../lib/envelope.js';
import { resolveLeagueId } from '../lib/config.js';
import { c } from '../lib/colors.js';
export function registerSmartCommands(program, client) {
    // --- Briefing: quick league overview ---
    program
        .command('briefing [leagueId]')
        .description('Morning briefing: your league status, ranking, lineup, and news at a glance')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const [overview, ranking, lineupOv, squad, meData] = await Promise.all([
                client.get(`/v4/leagues/${lid}/overview`).catch(() => null),
                client.get(`/v4/leagues/${lid}/ranking`).catch(() => null),
                client.get(`/v4/leagues/${lid}/lineup/overview`).catch(() => null),
                client.get(`/v4/leagues/${lid}/squad`).catch(() => null),
                client.get(`/v4/leagues/${lid}/me`).catch(() => null),
            ]);
            const users = ranking?.us ?? [];
            const players = squad?.it ?? [];
            const lineupPlayers = lineupOv?.lp ?? [];
            // Find ourselves: match squad player IDs against ranking user lineups
            const myPlayerIds = new Set(players.map((p) => p.i));
            const me = users.find((u) => u.lp && u.lp.some((pid) => myPlayerIds.has(String(pid)))) ?? null;
            const briefing = {
                league: ranking?.ti ?? overview?.n ?? overview?.lnm ?? lid,
                matchday: ranking?.day ?? lineupOv?.mdln ?? '?',
                deadline: lineupOv?.lis ?? null,
                season: ranking?.sn ?? '?',
                myName: me?.n ?? '?',
                myRank: me ? `#${me.spl} of ${users.length}` : '?',
                myPoints: me?.sp ?? '?',
                myMatchdayPts: me?.mdp ?? '?',
                myTeamValue: me?.tv ? c.money(me.tv) : '?',
                budget: meData?.b != null ? c.money(meData.b) : '?',
                squadSize: players.length,
                lineupSet: lineupPlayers.length > 0,
                lineupCount: lineupPlayers.length,
            };
            if (!isAgent) {
                console.log(c.header(`\n  Briefing: ${briefing.league}\n`));
                formatKeyValue(briefing, [
                    { key: 'season', label: 'Season' },
                    { key: 'matchday', label: 'Matchday' },
                    { key: 'deadline', label: 'Deadline' },
                    { key: 'myName', label: 'Manager' },
                    { key: 'myRank', label: 'Rank' },
                    { key: 'myPoints', label: 'Points' },
                    { key: 'myMatchdayPts', label: 'Matchday Pts' },
                    { key: 'myTeamValue', label: 'Team Value' },
                    { key: 'budget', label: 'Budget' },
                    { key: 'squadSize', label: 'Squad Size' },
                    { key: 'lineupCount', label: 'Lineup' },
                ]);
                if (players.length > 0) {
                    const posMap = { 1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW' };
                    const topPlayers = [...players].sort((a, b) => (b.ap ?? 0) - (a.ap ?? 0)).slice(0, 5);
                    console.log(c.header('\n  Top Players by Avg Points\n'));
                    formatTable(topPlayers.map((p) => ({
                        name: p.n,
                        pos: posMap[p.pos] ?? p.pos,
                        avg: p.ap,
                        value: c.money(p.mv),
                        trend: c.trendMoney(p.mvgl ?? 0),
                    })), [
                        { key: 'name', label: 'Player', width: 18 },
                        { key: 'pos', label: 'Pos', width: 4 },
                        { key: 'avg', label: 'Avg', width: 6 },
                        { key: 'value', label: 'Value', width: 8 },
                        { key: 'trend', label: 'Trend', width: 12 },
                    ]);
                }
                console.log('');
            }
            respond('kb briefing', {
                ...briefing,
                _printed: !isAgent,
                topPlayers: players.sort((a, b) => (b.ap ?? 0) - (a.ap ?? 0)).slice(0, 5).map((p) => ({
                    name: p.n, pos: p.pos, avgPts: p.ap, value: p.mv, trend: p.mvgl ?? 0,
                })),
            }, [
                { command: `kb leagues ranking ${lid}`, description: 'Full ranking' },
                { command: `kb leagues squad ${lid} --details`, description: 'Full squad details' },
                { command: `kb transfer-check ${lid}`, description: 'Transfer opportunities' },
                { command: `kb squad-report ${lid}`, description: 'Squad analysis' },
            ]);
        }
        catch (err) {
            respondError('kb briefing', err.message, 'FETCH_FAILED', 'Ensure you are logged in and league ID is valid.');
        }
    });
    // --- Transfer Check: market opportunities ---
    program
        .command('transfer-check [leagueId]')
        .description('Analyze transfer market: affordable players ranked by avg points')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const [meData, market, squad] = await Promise.all([
                client.get(`/v4/leagues/${lid}/me`).catch(() => null),
                client.get(`/v4/leagues/${lid}/market`).catch(() => null),
                client.get(`/v4/leagues/${lid}/squad`).catch(() => null),
            ]);
            const budget = meData?.b ?? meData?.budget ?? 0;
            const marketPlayers = (market?.it ?? []).map((p) => ({
                id: p.i,
                name: p.n,
                pos: p.pos,
                value: p.mv ?? 0,
                price: p.p ?? p.mv ?? 0,
                avgPts: p.ap ?? 0,
                affordable: (p.p ?? p.mv ?? 0) <= budget,
                trend: p.mvgl ?? 0,
            }));
            // Sort by avg points descending
            marketPlayers.sort((a, b) => b.avgPts - a.avgPts);
            const posMap = { 1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW' };
            const myPositions = (squad?.it ?? []).reduce((acc, p) => {
                const pos = posMap[p.pos] ?? '?';
                acc[pos] = (acc[pos] ?? 0) + 1;
                return acc;
            }, {});
            if (!isAgent) {
                console.log(c.header('\n  Transfer Market Analysis\n'));
                console.log(`  Budget: ${c.money(budget)}`);
                console.log(`  Squad: ${Object.entries(myPositions).map(([k, v]) => `${k}:${v}`).join(' | ')}\n`);
                formatTable(marketPlayers.map((p) => ({
                    name: p.name,
                    pos: posMap[p.pos] ?? p.pos,
                    price: c.money(p.price),
                    avg: p.avgPts,
                    trend: c.trendMoney(p.trend),
                    ok: p.affordable ? c.positive('YES') : c.negative('no'),
                })), [
                    { key: 'name', label: 'Player', width: 18 },
                    { key: 'pos', label: 'Pos', width: 4 },
                    { key: 'price', label: 'Price', width: 8 },
                    { key: 'avg', label: 'Avg', width: 6 },
                    { key: 'trend', label: 'Trend', width: 12 },
                    { key: 'ok', label: 'Afford', width: 6 },
                ]);
                console.log('');
            }
            respond('kb transfer-check', {
                budget,
                _printed: !isAgent,
                squadPositions: myPositions,
                marketPlayers,
                affordableCount: marketPlayers.filter((p) => p.affordable).length,
                totalOnMarket: marketPlayers.length,
            }, [
                { command: `kb leagues budget ${lid}`, description: 'Check budget' },
                ...marketPlayers.filter((p) => p.affordable).slice(0, 3).map((p) => ({
                    command: `kb leagues market-offer ${lid} ${p.id} --amount ${p.price}`,
                    description: `Offer for ${p.name}`,
                })),
            ]);
        }
        catch (err) {
            respondError('kb transfer-check', err.message, 'FETCH_FAILED', 'Ensure you are logged in and league ID is valid.');
        }
    });
    // --- Squad Report: player-by-player analysis ---
    program
        .command('squad-report [leagueId]')
        .description('Deep squad analysis with sell/hold/watch recommendations')
        .action(async (leagueId) => {
        try {
            const lid = resolveLeagueId(leagueId);
            const squad = await client.get(`/v4/leagues/${lid}/squad`);
            const players = squad?.it ?? [];
            if (players.length === 0) {
                if (!isAgent)
                    console.log('No players in squad.');
                respond('kb squad-report', { players: [], count: 0 }, []);
                return;
            }
            // Fetch detailed stats for each player in parallel
            const details = await Promise.all(players.map((p) => client.get(`/v4/leagues/${lid}/players/${p.i}`).catch(() => null)));
            const posMap = { 1: 'GK', 2: 'DEF', 3: 'MF', 4: 'FW' };
            const report = players.map((p, idx) => {
                const d = details[idx];
                const avgPts = p.ap ?? d?.ap ?? 0;
                const value = p.mv ?? 0;
                const sellValue = d?.cv ?? value;
                const trend = p.mvgl ?? 0;
                const trendPct = value > 0 ? (trend / value) * 100 : 0;
                // Recommendation logic
                let rec = 'HOLD';
                if (avgPts < 4 && trendPct < -3)
                    rec = 'SELL';
                else if (avgPts < 6 && trendPct < -5)
                    rec = 'SELL';
                else if (trendPct < -10)
                    rec = 'SELL';
                else if (avgPts > 10 && trendPct > 2)
                    rec = 'HOLD'; // strong performer
                else if (trendPct > 5 && avgPts < 6)
                    rec = 'WATCH'; // rising but low output
                else if (avgPts < 3)
                    rec = 'SELL';
                return {
                    id: p.i,
                    name: p.n,
                    pos: posMap[p.pos] ?? p.pos,
                    team: d?.tn ?? '',
                    value,
                    sellValue,
                    avgPts,
                    goals: d?.g ?? 0,
                    assists: d?.a ?? 0,
                    trend,
                    trendPct: Math.round(trendPct * 10) / 10,
                    recommendation: rec,
                };
            });
            // Sort: SELL first, then by avgPts desc
            const recOrder = { SELL: 0, WATCH: 1, HOLD: 2 };
            report.sort((a, b) => (recOrder[a.recommendation] ?? 2) - (recOrder[b.recommendation] ?? 2) || b.avgPts - a.avgPts);
            if (!isAgent) {
                console.log(c.header('\n  Squad Report\n'));
                const totalValue = report.reduce((s, p) => s + p.value, 0);
                console.log(`  Total Value: ${c.money(totalValue)}  |  Players: ${report.length}\n`);
                formatTable(report.map((p) => ({
                    name: p.name,
                    pos: p.pos,
                    team: p.team,
                    value: c.money(p.value),
                    sell: c.money(p.sellValue),
                    avg: p.avgPts,
                    trend: c.trendMoney(p.trend),
                    rec: p.recommendation === 'SELL' ? c.negative(p.recommendation)
                        : p.recommendation === 'WATCH' ? c.warn(p.recommendation)
                            : c.positive(p.recommendation),
                })), [
                    { key: 'name', label: 'Player', width: 16 },
                    { key: 'pos', label: 'Pos', width: 4 },
                    { key: 'team', label: 'Team', width: 14 },
                    { key: 'value', label: 'Value', width: 8 },
                    { key: 'sell', label: 'Sell @', width: 8 },
                    { key: 'avg', label: 'Avg', width: 5 },
                    { key: 'trend', label: 'Trend', width: 12 },
                    { key: 'rec', label: 'Action', width: 6 },
                ]);
                console.log('');
            }
            respond('kb squad-report', {
                players: report,
                _printed: !isAgent,
                count: report.length,
                totalValue: report.reduce((s, p) => s + p.value, 0),
                sellCandidates: report.filter((p) => p.recommendation === 'SELL').length,
                watchList: report.filter((p) => p.recommendation === 'WATCH').length,
            }, [
                { command: `kb transfer-check ${lid}`, description: 'Check transfer market' },
                ...report.filter((p) => p.recommendation === 'SELL').slice(0, 3).map((p) => ({
                    command: `kb leagues market-list ${lid} --data '{"pid":"${p.id}"}'`,
                    description: `List ${p.name} for sale`,
                })),
            ]);
        }
        catch (err) {
            respondError('kb squad-report', err.message, 'FETCH_FAILED', 'Ensure you are logged in and league ID is valid.');
        }
    });
}
