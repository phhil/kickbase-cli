import { respond, respondError, isAgent, formatTable } from '../lib/envelope.js';
import { fetchNews, fetchTeamPage, fetchAllInjuries, fetchTable, TEAMS, } from '../lib/ligainsider.js';
export function registerLigaInsiderCommands(program, client) {
    const li = program.command('li').description('LigaInsider.de data (news, lineups, injuries)');
    // --- News Feed ---
    li
        .command('news')
        .description('Latest LigaInsider news feed (injuries, transfers, lineup info)')
        .option('--page <n>', 'Page number', '1')
        .option('--limit <n>', 'Max items to show', '20')
        .action(async (opts) => {
        try {
            const items = await fetchNews(parseInt(opts.page));
            const limited = items.slice(0, parseInt(opts.limit));
            if (!isAgent) {
                const statusColors = {
                    'Verletzung': '🔴',
                    'Verletzt': '🔴',
                    'Gesperrt': '🟡',
                    'Angeschlagen': '🟠',
                    'Aufbautraining': '🔵',
                    'Fit': '🟢',
                    'News': '⚪',
                };
                for (const item of limited) {
                    const icon = statusColors[item.status] ?? '⚪';
                    console.log(`  ${icon} ${item.status.padEnd(15)} ${item.player.padEnd(25)} ${item.title}`);
                }
                console.log(`\n  ${limited.length} of ${items.length} items (page ${opts.page})`);
            }
            const result = { items: limited, total: items.length, page: parseInt(opts.page) };
            result._printed = !isAgent;
            respond('kickbase li news', result, [
                { command: `kickbase li news --page ${parseInt(opts.page) + 1}`, description: 'Next page' },
                { command: 'kickbase li injuries', description: 'View all injuries' },
            ]);
        }
        catch (err) {
            respondError('kickbase li news', err.message, 'SCRAPE_FAILED', 'Check your internet connection. LigaInsider.de may be temporarily unavailable.');
        }
    });
    // --- Team Page ---
    li
        .command('team <team>')
        .description('Team lineup prediction, injuries, and news')
        .action(async (teamInput) => {
        try {
            const data = await fetchTeamPage(teamInput);
            if (!isAgent) {
                console.log(`\n  === ${data.team} ===`);
                if (data.nextMatch)
                    console.log(`  Next: ${data.nextMatch}`);
                console.log();
                // Lineup
                if (data.players.length > 0) {
                    console.log('  Predicted Lineup:');
                    for (const p of data.players) {
                        const statusIcon = p.status === 'Fit' ? '🟢' :
                            p.status === 'Verletzt' ? '🔴' :
                                p.status === 'Angeschlagen' ? '🟠' :
                                    p.status === 'Aufbautraining' ? '🔵' :
                                        p.status === 'Gesperrt' ? '🟡' : '⚪';
                        const rating = p.rating ? `(${p.rating})` : '';
                        console.log(`    ${statusIcon} ${p.name.padEnd(25)} ${rating.padEnd(6)} ${p.status !== 'Fit' ? p.status : ''}`);
                    }
                    console.log();
                }
                // Injuries
                if (data.injuries.length > 0) {
                    console.log('  Injuries & Suspensions:');
                    for (const inj of data.injuries) {
                        console.log(`    🔴 ${inj.player.padEnd(25)} ${inj.reason.padEnd(30)} ${inj.duration}`);
                    }
                    console.log();
                }
                // News
                if (data.news.length > 0) {
                    console.log('  Recent News:');
                    for (const headline of data.news.slice(0, 5)) {
                        console.log(`    • ${headline}`);
                    }
                }
            }
            const result = { ...data };
            result._printed = !isAgent;
            respond('kickbase li team', result, [
                { command: 'kickbase li injuries', description: 'View all injuries' },
                { command: 'kickbase li teams', description: 'List all teams' },
            ]);
        }
        catch (err) {
            respondError('kickbase li team', err.message, 'SCRAPE_FAILED', `Valid teams: ${Object.keys(TEAMS).join(', ')}`);
        }
    });
    // --- All Teams ---
    li
        .command('teams')
        .description('List all Bundesliga teams with their shortcuts')
        .action(async () => {
        const rows = Object.entries(TEAMS).map(([key, t]) => ({
            key,
            short: t.short,
            name: t.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }));
        if (!isAgent) {
            formatTable(rows, [
                { key: 'key', label: 'Key', width: 12 },
                { key: 'short', label: 'Short', width: 6 },
                { key: 'name', label: 'Team', width: 30 },
            ]);
        }
        const result = { teams: rows };
        result._printed = !isAgent;
        respond('kickbase li teams', result, [
            { command: 'kickbase li team bayern', description: 'View Bayern lineup' },
        ]);
    });
    // --- Injuries ---
    li
        .command('injuries')
        .description('All injured and suspended Bundesliga players')
        .option('--team <team>', 'Filter by team name')
        .action(async (opts) => {
        try {
            let teams = await fetchAllInjuries();
            if (opts.team) {
                const filter = opts.team.toLowerCase();
                teams = teams.filter(t => t.team.toLowerCase().includes(filter));
            }
            if (!isAgent) {
                let total = 0;
                for (const team of teams) {
                    console.log(`\n  ${team.team}`);
                    for (const p of team.players) {
                        console.log(`    🔴 ${p.player.padEnd(25)} ${p.reason.padEnd(30)} ${p.duration}`);
                        total++;
                    }
                }
                console.log(`\n  Total: ${total} players injured/suspended across ${teams.length} teams`);
            }
            const result = { teams, total: teams.reduce((s, t) => s + t.players.length, 0) };
            result._printed = !isAgent;
            respond('kickbase li injuries', result, [
                { command: 'kickbase li news', description: 'View latest news' },
            ]);
        }
        catch (err) {
            respondError('kickbase li injuries', err.message, 'SCRAPE_FAILED', 'Check your internet connection.');
        }
    });
    // --- League Table ---
    li
        .command('table')
        .description('Current Bundesliga league table')
        .action(async () => {
        try {
            const entries = await fetchTable();
            if (!isAgent && entries.length > 0) {
                formatTable(entries, [
                    { key: 'position', label: '#', width: 3 },
                    { key: 'team', label: 'Team', width: 28 },
                    { key: 'matches', label: 'Sp', width: 4 },
                    { key: 'goals', label: 'Tore', width: 8 },
                    { key: 'diff', label: 'Diff', width: 5 },
                    { key: 'points', label: 'Pkt', width: 4 },
                ]);
            }
            const result = { entries };
            result._printed = !isAgent;
            respond('kickbase li table', result, []);
        }
        catch (err) {
            respondError('kickbase li table', err.message, 'SCRAPE_FAILED', 'Check your internet connection.');
        }
    });
    // --- Alpha: Cross-reference with Kickbase squad ---
    li
        .command('alpha')
        .description('Cross-reference your Kickbase squad with LigaInsider injury/lineup data')
        .option('--league <leagueId>', 'Kickbase league ID')
        .action(async (opts) => {
        try {
            const leagueId = opts.league ?? process.env.KICKBASE_LEAGUE_ID;
            if (!leagueId) {
                respondError('kickbase li alpha', 'No league ID provided', 'MISSING_LEAGUE', 'Pass --league <id> or set KICKBASE_LEAGUE_ID. Find your league ID with: kickbase leagues list');
            }
            // Fetch Kickbase squad and LigaInsider injuries in parallel
            const [squad, allInjuries] = await Promise.all([
                client.get(`/v4/leagues/${leagueId}/squad`),
                fetchAllInjuries(),
            ]);
            // Build a flat set of injured player names (lowercase) for matching
            const injuredMap = new Map();
            for (const team of allInjuries) {
                for (const p of team.players) {
                    injuredMap.set(p.player.toLowerCase(), {
                        reason: p.reason,
                        duration: p.duration,
                        team: team.team,
                    });
                }
            }
            // Cross-reference squad players
            const squadPlayers = squad.it ?? [];
            const alerts = [];
            const safe = [];
            for (const player of squadPlayers) {
                const name = `${player.fn ?? ''} ${player.ln ?? player.n ?? ''}`.trim();
                const lastName = (player.ln ?? player.n ?? '').toLowerCase();
                const fullName = name.toLowerCase();
                // Try matching by last name or full name
                let injury = injuredMap.get(fullName) ?? injuredMap.get(lastName);
                if (!injury) {
                    // Fuzzy: check if any injured player name contains this player's last name
                    for (const [injName, injData] of injuredMap) {
                        if (lastName.length > 3 && injName.includes(lastName)) {
                            injury = injData;
                            break;
                        }
                    }
                }
                if (injury) {
                    alerts.push({
                        name,
                        kickbaseId: player.i,
                        mv: player.mv,
                        status: '🔴 INJURED/SUSPENDED',
                        reason: injury.reason,
                        duration: injury.duration,
                        realTeam: injury.team,
                    });
                }
                else {
                    safe.push({ name, kickbaseId: player.i, mv: player.mv });
                }
            }
            if (!isAgent) {
                console.log(`\n  === Squad Alpha Check ===`);
                console.log(`  ${squadPlayers.length} players in your squad\n`);
                if (alerts.length > 0) {
                    console.log('  ⚠️  ALERTS — These squad players are injured/suspended:');
                    for (const a of alerts) {
                        const val = typeof a.mv === 'number' ? `${(a.mv / 1_000_000).toFixed(1)}M` : '';
                        console.log(`    🔴 ${a.name.padEnd(25)} ${val.padEnd(8)} ${a.reason.padEnd(25)} ${a.duration}`);
                    }
                    console.log();
                }
                else {
                    console.log('  ✅ No injury alerts for your squad!\n');
                }
                console.log(`  🟢 ${safe.length} players appear fit`);
                console.log(`  🔴 ${alerts.length} players have injury/suspension alerts`);
            }
            const result = { alerts, safe: safe.length, total: squadPlayers.length };
            result._printed = !isAgent;
            respond('kickbase li alpha', result, [
                { command: 'kickbase li injuries', description: 'View all injuries' },
                { command: `kickbase leagues squad ${leagueId}`, description: 'View full squad' },
            ]);
        }
        catch (err) {
            respondError('kickbase li alpha', err.message, 'ALPHA_FAILED', 'Ensure you are logged in and league ID is correct.');
        }
    });
    // --- Scan all teams for lineup predictions ---
    li
        .command('scan')
        .description('Scan all 18 teams for lineup predictions and injuries (slow)')
        .action(async () => {
        try {
            const teamKeys = Object.keys(TEAMS);
            if (!isAgent)
                console.log(`\n  Scanning ${teamKeys.length} teams...\n`);
            // Fetch in batches of 3 to be respectful
            const results = [];
            for (let i = 0; i < teamKeys.length; i += 3) {
                const batch = teamKeys.slice(i, i + 3);
                const batchResults = await Promise.all(batch.map(async (key) => {
                    try {
                        const data = await fetchTeamPage(key);
                        return { key, ...data };
                    }
                    catch {
                        return { key, team: TEAMS[key].slug, players: [], injuries: [], news: [], error: true };
                    }
                }));
                results.push(...batchResults);
                if (!isAgent && i + 3 < teamKeys.length) {
                    process.stdout.write(`  ${results.length}/${teamKeys.length} teams scanned...\r`);
                }
            }
            if (!isAgent) {
                console.log(`  ${results.length}/${teamKeys.length} teams scanned.   \n`);
                for (const team of results) {
                    const injCount = team.injuries?.length ?? 0;
                    const playerCount = team.players?.length ?? 0;
                    const status = team.error ? '❌' : '✅';
                    console.log(`  ${status} ${(team.team ?? team.key).padEnd(30)} ${playerCount} players  ${injCount} injuries`);
                }
            }
            const result = { teams: results };
            result._printed = !isAgent;
            respond('kickbase li scan', result, [
                { command: 'kickbase li team bayern', description: 'View specific team' },
            ]);
        }
        catch (err) {
            respondError('kickbase li scan', err.message, 'SCAN_FAILED', 'Check your internet connection.');
        }
    });
}
