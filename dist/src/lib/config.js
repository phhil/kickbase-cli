import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
const CONFIG_DIR = join(homedir(), '.config', 'kickbase-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export function getConfig() {
    if (!existsSync(CONFIG_FILE))
        return {};
    try {
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    }
    catch {
        return {};
    }
}
export function setConfig(updates) {
    if (!existsSync(CONFIG_DIR))
        mkdirSync(CONFIG_DIR, { recursive: true });
    const current = getConfig();
    writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...updates }, null, 2));
}
export function getDefaultLeagueId() {
    return getConfig().defaultLeagueId;
}
export function resolveLeagueId(provided) {
    const id = provided ?? getDefaultLeagueId();
    if (!id) {
        throw new Error('No league ID provided and no default league set. Run: kb config set-league <leagueId>');
    }
    return id;
}
