import { respond, respondError, isAgent, formatTable } from '../lib/envelope.js';
export function registerChallengeCommands(program, client) {
    const challenges = program.command('challenges').description('Challenge management');
    // --- Listings ---
    challenges
        .command('overview')
        .description('List all current challenges')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/overview');
            if (!isAgent && result.it) {
                formatTable(result.it.map((c) => ({
                    id: c.ch ?? c.i,
                    competition: c.cpi ?? '?',
                    deadline: c.lis ? c.lis.slice(0, 16).replace('T', ' ') : '?',
                    type: c.t ?? '?',
                })), [
                    { key: 'id', label: 'ID', width: 8 },
                    { key: 'competition', label: 'Comp', width: 4 },
                    { key: 'deadline', label: 'Deadline (UTC)', width: 16 },
                    { key: 'type', label: 'Type', width: 4 },
                ]);
                result._printed = true;
            }
            respond('kickbase challenges overview', result, [
                { command: 'kickbase challenges archive', description: 'View past challenges' },
                { command: 'kickbase challenges recommended', description: 'View recommended challenges' },
                ...(result.it ?? []).slice(0, 3).map((c) => ({
                    command: `kickbase challenges profile ${c.ch ?? c.i}`,
                    description: `View challenge "${c.ch ?? c.i}"`,
                })),
            ]);
        }
        catch (err) {
            respondError('kickbase challenges overview', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    challenges
        .command('archive')
        .description('List past challenges')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/archive');
            if (!isAgent && result.it) {
                formatTable(result.it.map((c) => ({
                    id: c.ch ?? c.i,
                    name: c.chn ?? c.n ?? '',
                    place: c.pl ?? c.p ?? '',
                    points: c.sp ?? '',
                })), [
                    { key: 'id', label: 'ID', width: 10 },
                    { key: 'name', label: 'Name', width: 30 },
                    { key: 'place', label: 'Place', width: 8 },
                    { key: 'points', label: 'Pts', width: 8 },
                ]);
                result._printed = true;
            }
            respond('kickbase challenges archive', result, [
                { command: 'kickbase challenges overview', description: 'View current challenges' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges archive', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    challenges
        .command('recommended')
        .description('List recommended challenges')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/recommended');
            if (!isAgent && Array.isArray(result.it)) {
                formatTable(result.it.map((c) => ({
                    id: c.ch ?? '',
                    deadline: c.lis ? c.lis.slice(0, 16).replace('T', ' ') : '',
                })), [
                    { key: 'id', label: 'ID', width: 10 },
                    { key: 'deadline', label: 'Deadline (UTC)', width: 16 },
                ]);
                result._printed = true;
            }
            respond('kickbase challenges recommended', result, [
                { command: 'kickbase challenges overview', description: 'View all current challenges' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges recommended', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    challenges
        .command('selection')
        .description('Get challenge selection')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/selection');
            if (!isAgent) {
                console.log(`Selectable challenges: ${(result.it ?? []).length}`);
                result._printed = true;
            }
            respond('kickbase challenges selection', result, []);
        }
        catch (err) {
            respondError('kickbase challenges selection', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    // --- Profile & Details ---
    challenges
        .command('profile <challengeId>')
        .description('Get challenge description, rules, and prize info')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/profile`);
            if (!isAgent) {
                console.log(result.n ?? `Challenge ${challengeId}`);
                if (result.d)
                    console.log(result.d);
                if (result.ruls?.b)
                    console.log(`Budget: ${result.ruls.b}`);
                if (result.ruls?.mpst)
                    console.log(`Max per club: ${result.ruls.mpst}`);
                if (Array.isArray(result.mds))
                    console.log(`Matchdays: ${result.mds.join(', ')}`);
                result._printed = true;
            }
            respond('kickbase challenges profile', result, [
                { command: `kickbase challenges ranking ${challengeId}`, description: 'View ranking' },
                { command: `kickbase challenges top10 ${challengeId}`, description: 'View top 10' },
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges profile', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('ranking <challengeId>')
        .description('Get challenge ranking by day')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/ranking`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges ranking', result, [
                { command: `kickbase challenges top10 ${challengeId}`, description: 'View top 10' },
                { command: `kickbase challenges profile ${challengeId}`, description: 'View challenge profile' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges ranking', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('performance <challengeId>')
        .description('Get challenge performance data')
        .option('--day <dayNumber>', 'Day number')
        .action(async (challengeId, opts) => {
        try {
            const query = opts.day ? `?dayNumber=${opts.day}` : '';
            const result = await client.get(`/v4/challenges/${challengeId}/performance${query}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges performance', result, [
                { command: `kickbase challenges ranking ${challengeId}`, description: 'View ranking' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges performance', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('top10 <challengeId>')
        .description('Get top 10 managers in a challenge')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/top10`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'n', label: 'Name', width: 20 },
                    { key: 'sp', label: 'Points', width: 10 },
                    { key: 'p', label: 'Place', width: 8 },
                ]);
            }
            respond('kickbase challenges top10', result, [
                { command: `kickbase challenges ranking ${challengeId}`, description: 'View full ranking' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges top10', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    // --- Lineup ---
    const lineup = challenges.command('lineup').description('Challenge lineup management');
    lineup
        .command('overview <challengeId>')
        .description('View current lineup for a challenge')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/lineup/overview`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges lineup overview', result, [
                { command: `kickbase challenges lineup selection ${challengeId}`, description: 'Browse available players' },
                { command: `kickbase challenges lineup fill ${challengeId}`, description: 'Autofill lineup' },
                { command: `kickbase challenges lineup livepitch ${challengeId}`, description: 'View live scores' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lineup overview', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    lineup
        .command('selection <challengeId>')
        .description('Browse available players for lineup')
        .option('--position <pos>', 'Filter by position (1-4)')
        .option('--sorting <sort>', 'Sort field')
        .option('--query <q>', 'Search by name')
        .option('--start <n>', 'Offset', '0')
        .option('--max <n>', 'Max results', '25')
        .action(async (challengeId, opts) => {
        try {
            const params = new URLSearchParams();
            if (opts.position)
                params.set('position', opts.position);
            if (opts.sorting)
                params.set('sorting', opts.sorting);
            if (opts.query)
                params.set('query', opts.query);
            params.set('start', opts.start);
            params.set('max', opts.max);
            const result = await client.get(`/v4/challenges/${challengeId}/lineup/selection?${params}`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 12 },
                    { key: 'n', label: 'Name', width: 25 },
                    { key: 'pos', label: 'Pos', width: 5 },
                    { key: 'mv', label: 'Value', width: 12 },
                ]);
            }
            respond('kickbase challenges lineup selection', result, [
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View current lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lineup selection', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    lineup
        .command('teams <challengeId>')
        .description('List clubs available for lineup')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/lineup/teams`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 12 },
                    { key: 'n', label: 'Team', width: 30 },
                ]);
            }
            respond('kickbase challenges lineup teams', result, []);
        }
        catch (err) {
            respondError('kickbase challenges lineup teams', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    lineup
        .command('livepitch <challengeId>')
        .description('View live pitch scores')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/lineup/livepitch`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges lineup livepitch', result, [
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lineup livepitch', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    lineup
        .command('fill <challengeId>')
        .description('Autofill challenge lineup')
        .action(async (challengeId) => {
        try {
            const result = await client.post(`/v4/challenges/${challengeId}/lineup/fill`);
            if (!isAgent)
                console.log('Lineup autofilled successfully.');
            respond('kickbase challenges lineup fill', result, [
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View updated lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lineup fill', err.message, 'ACTION_FAILED', 'Autofill may not be available for this challenge.');
        }
    });
    lineup
        .command('clear <challengeId>')
        .description('Reset challenge lineup')
        .action(async (challengeId) => {
        try {
            const result = await client.post(`/v4/challenges/${challengeId}/lineup/clear`);
            if (!isAgent)
                console.log('Lineup cleared.');
            respond('kickbase challenges lineup clear', result, [
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View lineup' },
                { command: `kickbase challenges lineup fill ${challengeId}`, description: 'Autofill lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lineup clear', err.message, 'ACTION_FAILED', 'Clear may not be available for this challenge.');
        }
    });
    // --- Table ---
    challenges
        .command('table <challengeId>')
        .description('Get manager ranking table')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/table`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'n', label: 'Manager', width: 20 },
                    { key: 'sp', label: 'Points', width: 10 },
                ]);
            }
            respond('kickbase challenges table', result, [
                { command: `kickbase challenges top10 ${challengeId}`, description: 'View top 10' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges table', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('table-user <challengeId> <userId>')
        .description('Get manager detail in challenge table')
        .action(async (challengeId, userId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/table/${userId}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges table-user', result, [
                { command: `kickbase challenges table ${challengeId}`, description: 'View full table' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges table-user', err.message, 'FETCH_FAILED', 'Check that challenge and user IDs are valid.');
        }
    });
    // --- Favorites ---
    challenges
        .command('favorites <challengeId>')
        .description('List favorite managers in a challenge')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/favorites`);
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'i', label: 'ID', width: 12 },
                    { key: 'n', label: 'Name', width: 25 },
                ]);
            }
            respond('kickbase challenges favorites', result, [
                { command: `kickbase challenges favorites-search ${challengeId} --query "name"`, description: 'Search for a manager' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges favorites', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('favorites-search <challengeId>')
        .description('Search favorite managers')
        .option('--query <q>', 'Search query')
        .option('--start <n>', 'Offset', '0')
        .option('--max <n>', 'Max results', '25')
        .action(async (challengeId, opts) => {
        try {
            const params = new URLSearchParams();
            if (opts.query)
                params.set('query', opts.query);
            params.set('start', opts.start);
            params.set('max', opts.max);
            const result = await client.get(`/v4/challenges/${challengeId}/favorites/search?${params}`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges favorites-search', result, []);
        }
        catch (err) {
            respondError('kickbase challenges favorites-search', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    challenges
        .command('favorites-add <userId>')
        .description('Add a manager to favorites')
        .action(async (userId) => {
        try {
            const result = await client.post('/v4/challenges/favorites', { ui: userId });
            if (!isAgent)
                console.log(`Manager ${userId} added to favorites.`);
            respond('kickbase challenges favorites-add', result, []);
        }
        catch (err) {
            respondError('kickbase challenges favorites-add', err.message, 'ACTION_FAILED', `Check that user ID "${userId}" is valid.`);
        }
    });
    challenges
        .command('favorites-remove <userId>')
        .description('Remove a manager from favorites')
        .action(async (userId) => {
        try {
            const result = await client.delete(`/v4/challenges/favorites/${userId}`);
            if (!isAgent)
                console.log(`Manager ${userId} removed from favorites.`);
            respond('kickbase challenges favorites-remove', result, []);
        }
        catch (err) {
            respondError('kickbase challenges favorites-remove', err.message, 'ACTION_FAILED', `Check that user ID "${userId}" is valid.`);
        }
    });
    // --- Perfect Lineup ---
    challenges
        .command('perfectlineup <challengeId>')
        .description('Get the perfect lineup for a challenge')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/${challengeId}/perfectlineup`);
            if (!isAgent)
                console.log(JSON.stringify(result, null, 2));
            respond('kickbase challenges perfectlineup', result, [
                { command: `kickbase challenges lineup overview ${challengeId}`, description: 'View your lineup' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges perfectlineup', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    // --- Join ---
    challenges
        .command('join [challengeId]')
        .description('Join a challenge')
        .action(async (challengeId) => {
        try {
            const path = challengeId
                ? `/v4/challenges/${challengeId}/join`
                : '/v4/challenges/join';
            const result = await client.post(path);
            if (!isAgent)
                console.log('Joined challenge.');
            respond('kickbase challenges join', result, [
                { command: 'kickbase challenges overview', description: 'View your challenges' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges join', err.message, 'ACTION_FAILED', 'Check that the challenge ID is valid and you meet join requirements.');
        }
    });
    // --- Lobby ---
    const lobby = challenges.command('lobby').description('Challenge lobby, divisions, and skill points');
    lobby
        .command('overview')
        .description('Get lobby overview (your division, current challenges)')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/overview');
            if (!isAgent) {
                const dv = result.stg?.dv;
                if (dv)
                    console.log(`Division: ${dv.dvn ?? dv.dvi} (${dv.prl ?? 0} points)`);
                if (Array.isArray(result.my) && result.my.length) {
                    console.log(`\nMy challenges: ${result.my.length}`);
                    for (const c of result.my.slice(0, 5)) {
                        console.log(`  ${c.chn ?? c.ch ?? 'Challenge'} — ${c.st ?? ''}`);
                    }
                }
                if (Array.isArray(result.exp)) {
                    console.log(`Explore picks: ${result.exp.length}`);
                }
                result._printed = true;
            }
            respond('kickbase challenges lobby overview', result, [
                { command: 'kickbase challenges lobby explore', description: 'Browse available challenges' },
                { command: 'kickbase challenges lobby divisions', description: 'View division ladder' },
                { command: 'kickbase challenges lobby profile', description: 'View your lobby profile' },
                { command: 'kickbase challenges lobby skillpoints', description: 'View skill points summary' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby overview', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('live')
        .description('Get live lobby challenges')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/overview/live');
            if (!isAgent) {
                console.log(`Live lobby entries: ${(result.it ?? result.my ?? []).length}`);
                result._printed = true;
            }
            respond('kickbase challenges lobby live', result, [
                { command: 'kickbase challenges lobby overview', description: 'View lobby overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby live', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('explore')
        .description('Browse available challenges across all competitions')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/explore');
            if (!isAgent && result.cps) {
                for (const cp of result.cps) {
                    console.log(`\n${cp.n} (ID: ${cp.i})`);
                    if (cp.chs) {
                        for (const ch of cp.chs.slice(0, 5)) {
                            console.log(`  ${ch.chn ?? ch.ch ?? 'Challenge'}`);
                        }
                    }
                }
                result._printed = true;
            }
            respond('kickbase challenges lobby explore', result, [
                { command: 'kickbase challenges lobby overview', description: 'View lobby overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby explore', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('explore-challenge <challengeId>')
        .description('Get details for a specific lobby challenge')
        .action(async (challengeId) => {
        try {
            const result = await client.get(`/v4/challenges/lobby/explore/${challengeId}`);
            if (!isAgent) {
                console.log(result.chn ?? result.n ?? `Challenge ${challengeId}`);
                if (result.lis)
                    console.log(`Deadline: ${result.lis}`);
                result._printed = true;
            }
            respond('kickbase challenges lobby explore-challenge', result, [
                { command: `kickbase challenges join ${challengeId}`, description: 'Join this challenge' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby explore-challenge', err.message, 'FETCH_FAILED', `Check that challenge ID "${challengeId}" is valid.`);
        }
    });
    lobby
        .command('divisions')
        .description('View division ladder')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/divisionLadder');
            if (!isAgent && result.dvs) {
                formatTable(result.dvs, [
                    { key: 'dvi', label: '#', width: 4 },
                    { key: 'dvn', label: 'Division', width: 20 },
                    { key: 'bod', label: 'Min Points', width: 12 },
                    { key: 'uc', label: 'Users', width: 8 },
                ]);
                result._printed = true;
            }
            respond('kickbase challenges lobby divisions', result, [
                { command: 'kickbase challenges lobby profile', description: 'View your profile' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby divisions', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('profile')
        .description('View your lobby profile and division')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/profile');
            if (!isAgent) {
                const u = result.u;
                const dv = result.dv;
                if (u)
                    console.log(`${u.unm ?? 'You'}`);
                if (dv)
                    console.log(`Division: ${dv.dvn ?? dv.dvi}`);
                console.log(`Season: ${result.sd?.slice(0, 10) ?? '?'} -> ${result.ed?.slice(0, 10) ?? '?'}`);
                console.log(`Skill points: ${result.skp ?? 0} (available: ${result.avskp ?? 0})`);
                console.log(`Challenges joined: ${result.chc ?? 0}`);
                result._printed = true;
            }
            respond('kickbase challenges lobby profile', result, [
                { command: 'kickbase challenges lobby divisions', description: 'View division ladder' },
                { command: 'kickbase challenges lobby skillpoints', description: 'View skill points' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby profile', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('skillpoints')
        .description('View skill points summary')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/skillPoints/summary');
            if (!isAgent) {
                console.log(`Skill points: ${result.skp ?? 0} / total ${result.skpt ?? 0}`);
                console.log(`Division: ${result.dvi ?? '?'}`);
                console.log(`Current challenges: ${result.cn ?? 0}`);
                console.log(`Collectable now: ${(result.cps ?? []).length}`);
                console.log(`Past collectable: ${(result.pcps ?? []).length}`);
                result._printed = true;
            }
            respond('kickbase challenges lobby skillpoints', result, [
                { command: 'kickbase challenges lobby skillpoints-collect', description: 'Collect skill points' },
                { command: 'kickbase challenges lobby profile', description: 'View profile' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby skillpoints', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    lobby
        .command('skillpoints-collect')
        .description('Collect available skill points')
        .action(async () => {
        try {
            const result = await client.post('/v4/challenges/lobby/skillPoints/collect');
            if (!isAgent)
                console.log('Skill points collected!');
            respond('kickbase challenges lobby skillpoints-collect', result, [
                { command: 'kickbase challenges lobby skillpoints', description: 'View updated skill points' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby skillpoints-collect', err.message, 'ACTION_FAILED', 'No skill points available to collect.');
        }
    });
    lobby
        .command('archive')
        .description('View lobby challenge archive with past results')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/lobby/archive');
            if (!isAgent) {
                console.log(`Lobby archive entries: ${(result.it ?? result.chs ?? []).length}`);
                result._printed = true;
            }
            respond('kickbase challenges lobby archive', result, [
                { command: 'kickbase challenges lobby overview', description: 'View lobby overview' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges lobby archive', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    // --- Social Hub ---
    const social = challenges.command('social').description('Social hub — follow managers, see results');
    social
        .command('overview')
        .description('View your social hub')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/socialhub');
            if (!isAgent) {
                if (result.shme)
                    console.log(`You: ${result.shme.unm ?? 'unknown'} (${result.shme.skp ?? 0} skill points)`);
                if (result.shfl && result.shfl.length > 0) {
                    console.log(`\nFollowing (${result.shfl.length}):`);
                    for (const f of result.shfl) {
                        console.log(`  ${f.unm ?? f.ui} — ${f.skp ?? 0} skill points`);
                    }
                }
                else {
                    console.log('\nNot following anyone yet.');
                }
                result._printed = true;
            }
            respond('kickbase challenges social overview', result, [
                { command: 'kickbase challenges social search', description: 'Find managers to follow' },
                { command: 'kickbase challenges social invitations', description: 'View invitations' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges social overview', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    social
        .command('search')
        .description('Search for managers to follow')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/socialhub/search');
            if (!isAgent && result.it) {
                formatTable(result.it, [
                    { key: 'unm', label: 'Manager', width: 20 },
                    { key: 'ui', label: 'ID', width: 14 },
                    { key: 'skp', label: 'Skill Pts', width: 10 },
                ]);
                result._printed = true;
            }
            respond('kickbase challenges social search', result, []);
        }
        catch (err) {
            respondError('kickbase challenges social search', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    social
        .command('invitations')
        .description('View social hub invitations')
        .action(async () => {
        try {
            const result = await client.get('/v4/challenges/socialhub/invitation');
            if (!isAgent) {
                const invites = Array.isArray(result.it) ? result.it : [];
                console.log(`Invitations: ${invites.length}`);
                result._printed = true;
            }
            respond('kickbase challenges social invitations', result, []);
        }
        catch (err) {
            respondError('kickbase challenges social invitations', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    social
        .command('follow <userId>')
        .description('Follow a manager in the social hub')
        .action(async (userId) => {
        try {
            const result = await client.post('/v4/challenges/socialhub', { ui: userId });
            if (!isAgent)
                console.log(`Now following ${userId}.`);
            respond('kickbase challenges social follow', result, [
                { command: 'kickbase challenges social overview', description: 'View social hub' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges social follow', err.message, 'ACTION_FAILED', `Check that user ID "${userId}" is valid.`);
        }
    });
    social
        .command('unfollow <userId>')
        .description('Unfollow a manager')
        .action(async (userId) => {
        try {
            const result = await client.delete(`/v4/challenges/socialhub/${userId}`);
            if (!isAgent)
                console.log(`Unfollowed ${userId}.`);
            respond('kickbase challenges social unfollow', result, [
                { command: 'kickbase challenges social overview', description: 'View social hub' },
            ]);
        }
        catch (err) {
            respondError('kickbase challenges social unfollow', err.message, 'ACTION_FAILED', `Check that user ID "${userId}" is valid.`);
        }
    });
}
