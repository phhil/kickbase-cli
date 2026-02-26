import { respond, respondError, isAgent } from '../lib/envelope.js';
function eventLabel(e) {
    const code = Number(e.ke);
    if (code === 1)
        return 'Goal';
    if (code === 3)
        return 'Assist';
    if (code === 4)
        return 'Card';
    if (code === 8)
        return 'Sub on';
    if (code === 9)
        return 'Sub off';
    if (code === 10)
        return 'Kickoff';
    if (code === 11)
        return 'Halftime';
    if (code === 12)
        return '2nd half';
    if (code === 13)
        return 'Full time';
    return `Event ${e.ke ?? '?'}`;
}
export function registerMatchCommands(program, client) {
    const matches = program.command('matches').description('Match information');
    matches
        .command('details <matchId>')
        .description('Get match details with lineup and events')
        .action(async (matchId) => {
        try {
            const result = await client.get(`/v4/matches/${matchId}/details`);
            if (!isAgent) {
                const t1 = result.t1n ?? result.t1 ?? 'Home';
                const t2 = result.t2n ?? result.t2 ?? 'Away';
                console.log(`${t1} ${result.t1g ?? 0} - ${result.t2g ?? 0} ${t2}`);
                if (result.md)
                    console.log(`Date: ${result.md}`);
                if (result.events) {
                    console.log(`\nEvents (${result.events.length}):`);
                    for (const e of result.events.slice(0, 20)) {
                        const minute = e.mt ?? '?';
                        const actor = e.pn ? ` - ${e.pn}` : '';
                        const team = e.tid === result.t1 ? ` (${result.t1sy ?? 'H'})`
                            : e.tid === result.t2 ? ` (${result.t2sy ?? 'A'})`
                                : '';
                        console.log(`  ${minute}' ${eventLabel(e)}${team}${actor}`);
                        if (e.rev?.pn) {
                            console.log(`     ↳ ${eventLabel(e.rev)} - ${e.rev.pn}`);
                        }
                    }
                    if (result.events.length > 20) {
                        console.log(`  ... ${result.events.length - 20} more`);
                    }
                }
                const homeStarters = Array.isArray(result.t1lp) ? result.t1lp.length : 0;
                const awayStarters = Array.isArray(result.t2lp) ? result.t2lp.length : 0;
                const homeBench = Array.isArray(result.t1nlp) ? result.t1nlp.length : 0;
                const awayBench = Array.isArray(result.t2nlp) ? result.t2nlp.length : 0;
                console.log(`\nLineups: ${homeStarters}+${homeBench} vs ${awayStarters}+${awayBench}`);
                result._printed = true;
            }
            respond('kickbase matches details', result, [
                { command: `kickbase matches betlink ${matchId}`, description: 'Get betting link' },
                { command: 'kickbase live eventtypes', description: 'View event type codes' },
            ]);
        }
        catch (err) {
            respondError('kickbase matches details', err.message, 'FETCH_FAILED', `Check that match ID "${matchId}" is valid.`);
        }
    });
    matches
        .command('betlink <matchId>')
        .description('Get betting link for a match')
        .action(async (matchId) => {
        try {
            const result = await client.get(`/v4/matches/${matchId}/betlink`);
            if (!isAgent) {
                console.log(result.url ?? result.u ?? JSON.stringify(result, null, 2));
                result._printed = true;
            }
            respond('kickbase matches betlink', result, [
                { command: `kickbase matches details ${matchId}`, description: 'View match details' },
            ]);
        }
        catch (err) {
            respondError('kickbase matches betlink', err.message, 'FETCH_FAILED', `Check that match ID "${matchId}" is valid.`);
        }
    });
}
