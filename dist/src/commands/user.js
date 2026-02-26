import { respond, respondError, isAgent } from '../lib/envelope.js';
export function registerUserCommands(program, client) {
    const user = program.command('user').description('Authentication & user management');
    user
        .command('login')
        .description('Login to Kickbase')
        .option('--email <email>', 'Kickbase email')
        .option('--password <password>', 'Kickbase password')
        .action(async (opts) => {
        try {
            const result = await client.login(opts.email, opts.password);
            if (!isAgent) {
                console.log(`Logged in as ${result.u?.n ?? result.u?.unm ?? 'unknown'}`);
                console.log(`Token expires: ${result.tknex}`);
            }
            respond('kickbase user login', {
                user: result.u,
                tokenExpires: result.tknex,
            }, [
                { command: 'kickbase leagues list', description: 'List your leagues' },
                { command: 'kickbase user settings', description: 'View account settings' },
            ]);
        }
        catch (err) {
            respondError('kickbase user login', err.message, 'AUTH_FAILED', 'Check your email and password. Set KICKBASE_EMAIL and KICKBASE_PASSWORD env vars or use --email and --password.');
        }
    });
    user
        .command('me')
        .description('Get current user profile')
        .action(async () => {
        try {
            const result = await client.get('/v4/user/me');
            if (!isAgent) {
                const u = result.u ?? result;
                console.log(`Name: ${u.name ?? u.unm ?? 'unknown'}`);
                console.log(`Email: ${u.email ?? u.em ?? 'N/A'}`);
                console.log(`ID: ${u.id ?? u.i ?? 'N/A'}`);
                if (u.proExpiry)
                    console.log(`Pro until: ${u.proExpiry}`);
            }
            respond('kickbase user me', result, [
                { command: 'kickbase user settings', description: 'View settings' },
                { command: 'kickbase user subscription', description: 'Check subscription' },
            ]);
        }
        catch (err) {
            respondError('kickbase user me', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    user
        .command('settings')
        .description('View account settings')
        .action(async () => {
        try {
            const result = await client.get('/v4/user/settings');
            if (!isAgent) {
                console.log(`Email: ${result.em}`);
                console.log(`Username: ${result.unm}`);
                console.log(`ID: ${result.i}`);
            }
            respond('kickbase user settings', result, [
                { command: 'kickbase leagues list', description: 'List your leagues' },
                { command: 'kickbase user settings-update --data \'{"unm":"newname"}\'', description: 'Update settings' },
            ]);
        }
        catch (err) {
            respondError('kickbase user settings', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    user
        .command('settings-update')
        .description('Update account settings')
        .requiredOption('--data <json>', 'Settings data as JSON')
        .action(async (opts) => {
        try {
            const body = JSON.parse(opts.data);
            const result = await client.put('/v4/user/settings', body);
            if (!isAgent)
                console.log('Settings updated.');
            respond('kickbase user settings-update', result, [
                { command: 'kickbase user settings', description: 'View updated settings' },
            ]);
        }
        catch (err) {
            respondError('kickbase user settings-update', err.message, 'ACTION_FAILED', 'Check your settings data format.');
        }
    });
    user
        .command('subscription')
        .description('Check subscription/pro status')
        .action(async () => {
        try {
            const result = await client.get('/v4/settings/subscriptionStatus');
            if (!isAgent) {
                console.log(`Permission level: ${result.prms ?? 'N/A'}`);
                console.log(`Expires: ${result.exd ?? 'N/A'}`);
            }
            respond('kickbase user subscription', result, [
                { command: 'kickbase user me', description: 'View profile' },
            ]);
        }
        catch (err) {
            respondError('kickbase user subscription', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    user
        .command('support')
        .description('Get support contact info')
        .action(async () => {
        try {
            const result = await client.get('/v4/support/contactinfo');
            if (!isAgent)
                console.log(`Support: ${result.sm ?? JSON.stringify(result)}`);
            respond('kickbase user support', result, []);
        }
        catch (err) {
            respondError('kickbase user support', err.message, 'FETCH_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    user
        .command('register')
        .description('Register a new account')
        .requiredOption('--email <email>', 'Email address')
        .requiredOption('--password <password>', 'Password')
        .action(async (opts) => {
        try {
            const result = await client.post('/v4/user/register', {
                em: opts.email,
                pass: opts.password,
            });
            if (!isAgent)
                console.log('Account registered. Check your email for verification.');
            respond('kickbase user register', result, [
                { command: 'kickbase user login', description: 'Login with new account' },
            ]);
        }
        catch (err) {
            respondError('kickbase user register', err.message, 'ACTION_FAILED', 'Registration may have failed. Check email format and password requirements.');
        }
    });
    user
        .command('change-password')
        .description('Change your password')
        .requiredOption('--data <json>', 'Password change data as JSON')
        .action(async (opts) => {
        try {
            const body = JSON.parse(opts.data);
            const result = await client.post('/v4/user/password', body);
            if (!isAgent)
                console.log('Password changed.');
            respond('kickbase user change-password', result, []);
        }
        catch (err) {
            respondError('kickbase user change-password', err.message, 'ACTION_FAILED', 'Check your password data format.');
        }
    });
    user
        .command('forgot-password')
        .description('Request a password reset')
        .requiredOption('--email <email>', 'Email address')
        .action(async (opts) => {
        try {
            const result = await client.post('/v4/user/forgotpassword', { em: opts.email });
            if (!isAgent)
                console.log('Password reset email sent.');
            respond('kickbase user forgot-password', result, []);
        }
        catch (err) {
            respondError('kickbase user forgot-password', err.message, 'ACTION_FAILED', 'Check your email address.');
        }
    });
    user
        .command('refresh-tokens')
        .description('Refresh authentication tokens')
        .action(async () => {
        try {
            const result = await client.post('/v4/user/refreshtokens');
            if (!isAgent)
                console.log('Tokens refreshed.');
            respond('kickbase user refresh-tokens', result, []);
        }
        catch (err) {
            respondError('kickbase user refresh-tokens', err.message, 'ACTION_FAILED', 'Ensure you are logged in. Run: kickbase user login');
        }
    });
    user
        .command('targets')
        .description('Set notification targets')
        .requiredOption('--data <json>', 'Targets data as JSON')
        .action(async (opts) => {
        try {
            const body = JSON.parse(opts.data);
            const result = await client.post('/v4/user/targets', body);
            if (!isAgent)
                console.log('Targets updated.');
            respond('kickbase user targets', result, []);
        }
        catch (err) {
            respondError('kickbase user targets', err.message, 'ACTION_FAILED', 'Check your targets data format.');
        }
    });
    user
        .command('targets-remove <connection>')
        .description('Remove a notification target')
        .action(async (connection) => {
        try {
            const result = await client.delete(`/v4/user/targets/${connection}`);
            if (!isAgent)
                console.log(`Target ${connection} removed.`);
            respond('kickbase user targets-remove', result, []);
        }
        catch (err) {
            respondError('kickbase user targets-remove', err.message, 'ACTION_FAILED', `Check that target "${connection}" exists.`);
        }
    });
    user
        .command('delete-account')
        .description('Delete your account (IRREVERSIBLE)')
        .action(async () => {
        try {
            const result = await client.delete('/v4/user');
            if (!isAgent)
                console.log('Account deleted.');
            respond('kickbase user delete-account', result, []);
        }
        catch (err) {
            respondError('kickbase user delete-account', err.message, 'ACTION_FAILED', 'Account deletion failed.');
        }
    });
}
