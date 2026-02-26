import { respond, respondError, isAgent } from '../lib/envelope.js';
export function registerBonusCommands(program, client) {
    const bonus = program.command('bonus').description('Bonus system');
    bonus
        .command('collect')
        .description('Collect daily bonus')
        .action(async () => {
        try {
            const result = await client.get('/v4/bonus/collect');
            if (!isAgent) {
                console.log('Bonus collected!');
                if (result.it)
                    console.log(JSON.stringify(result.it, null, 2));
            }
            respond('kickbase bonus collect', result, [
                { command: 'kickbase leagues list', description: 'View your leagues' },
            ]);
        }
        catch (err) {
            respondError('kickbase bonus collect', err.message, 'BONUS_FAILED', 'Bonus may already be collected today. Try again tomorrow.');
        }
    });
}
