import { respond, respondError, isAgent, formatTable } from '../lib/envelope.js';
export function registerBaseCommands(program, client) {
    const base = program.command('base').description('News, predictions, stage, and items');
    base
        .command('news <competitionId>')
        .description('Get latest news (injuries, suspensions, transfers)')
        .action(async (competitionId) => {
        try {
            const result = await client.get(`/v4/base/news/${competitionId}`);
            if (!isAgent && result.it) {
                for (const item of result.it.slice(0, 15)) {
                    console.log(`[${item.dt?.slice(0, 10) ?? ''}] ${item.ti ?? ''}`);
                    if (item.rl)
                        console.log(`  ${item.rl}`);
                }
                if (result.it.length > 15)
                    console.log(`\n... and ${result.it.length - 15} more`);
                result._printed = true;
            }
            respond('kickbase base news', result, [
                { command: `kickbase base news-permanent ${competitionId}`, description: 'View permanent news' },
                { command: `kickbase base predictions ${competitionId}`, description: 'View predictions' },
            ]);
        }
        catch (err) {
            respondError('kickbase base news', err.message, 'FETCH_FAILED', 'Check competition ID. Use 1 for Bundesliga, 2 for 2. Bundesliga.');
        }
    });
    base
        .command('news-permanent <competitionId>')
        .description('Get permanent/pinned news')
        .action(async (competitionId) => {
        try {
            const result = await client.get(`/v4/base/news/permanent/${competitionId}`);
            if (!isAgent && Array.isArray(result.it)) {
                console.log(`Pinned items: ${result.it.length}`);
                for (const item of result.it.slice(0, 10)) {
                    console.log(`  ${item.i}`);
                }
                result._printed = true;
            }
            respond('kickbase base news-permanent', result, [
                { command: `kickbase base news ${competitionId}`, description: 'View latest news' },
            ]);
        }
        catch (err) {
            respondError('kickbase base news-permanent', err.message, 'FETCH_FAILED', 'Check competition ID. Use 1 for Bundesliga, 2 for 2. Bundesliga.');
        }
    });
    base
        .command('predictions <competitionId>')
        .description('Get team predictions')
        .action(async (competitionId) => {
        try {
            const result = await client.get(`/v4/base/predictions/teams/${competitionId}`);
            if (!isAgent && result.tms) {
                formatTable(result.tms, [
                    { key: 'tn', label: 'Team', width: 20 },
                    { key: 'tid', label: 'ID', width: 6 },
                ]);
                result._printed = true;
            }
            respond('kickbase base predictions', result, [
                { command: `kickbase base news ${competitionId}`, description: 'View latest news' },
            ]);
        }
        catch (err) {
            respondError('kickbase base predictions', err.message, 'FETCH_FAILED', 'Check competition ID. Use 1 for Bundesliga, 2 for 2. Bundesliga.');
        }
    });
    base
        .command('stage')
        .description('Get featured content and articles')
        .action(async () => {
        try {
            const result = await client.get('/v4/base/stage');
            if (!isAgent && result.stg) {
                for (const item of result.stg) {
                    console.log(`[${item.dt?.slice(0, 10) ?? ''}] ${item.ti ?? ''}`);
                }
                if (Array.isArray(result.cps) && result.cps.length) {
                    console.log(`\nCompetitions: ${result.cps.map((c) => c.n).join(', ')}`);
                }
                result._printed = true;
            }
            respond('kickbase base stage', result, [
                { command: 'kickbase base news 1', description: 'View Bundesliga news' },
            ]);
        }
        catch (err) {
            respondError('kickbase base stage', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    base
        .command('item <itemId>')
        .description('Get a specific content item')
        .action(async (itemId) => {
        try {
            const result = await client.get(`/v4/base/items/${itemId}`);
            if (!isAgent) {
                console.log(result.ti ?? itemId);
                if (result.dt)
                    console.log(`Date: ${result.dt}`);
                if (result.rl)
                    console.log(`Teaser: ${result.rl}`);
                if (typeof result.cnt === 'string') {
                    console.log(`Content: HTML (${result.cnt.length} chars)`);
                }
                result._printed = true;
            }
            respond('kickbase base item', result, []);
        }
        catch (err) {
            respondError('kickbase base item', err.message, 'FETCH_FAILED', `Check that item ID "${itemId}" is valid.`);
        }
    });
    base
        .command('item-click <itemId>')
        .description('Track click on a content item')
        .action(async (itemId) => {
        try {
            const result = await client.post(`/v4/base/items/${itemId}/click`);
            if (!isAgent)
                console.log('Click tracked.');
            respond('kickbase base item-click', result, []);
        }
        catch (err) {
            respondError('kickbase base item-click', err.message, 'ACTION_FAILED', `Check that item ID "${itemId}" is valid.`);
        }
    });
}
