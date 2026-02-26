import { writeFileSync } from 'fs';
import chalk from 'chalk';
import { isJsonMode } from './runtime.js';
export let isAgent = isJsonMode();
export function syncEnvelopeRuntimeFlags() {
    isAgent = isJsonMode();
}
export function respond(command, result, nextActions = []) {
    if (isAgent) {
        console.log(JSON.stringify({ ok: true, command, result, next_actions: nextActions }));
    }
    else {
        // Human mode — caller handles formatting before calling respond,
        // but we print the result if it hasn't been printed yet
        if (result._printed)
            return;
        console.log(JSON.stringify(result, null, 2));
    }
}
export function respondError(command, message, code, fix, nextActions = []) {
    if (isAgent) {
        console.log(JSON.stringify({ ok: false, command, error: { message, code }, fix, next_actions: nextActions }));
    }
    else {
        console.error(chalk.red(`Error: ${message}`));
        console.error(chalk.yellow(`Fix: ${fix}`));
    }
    process.exit(1);
}
export function truncateResult(items, maxItems = 50) {
    if (items.length <= maxItems) {
        return { items, count: items.length, truncated: false };
    }
    const tmpPath = `/tmp/kickbase-results-${Date.now()}.json`;
    writeFileSync(tmpPath, JSON.stringify(items, null, 2));
    return {
        items: items.slice(0, maxItems),
        count: items.length,
        showing: maxItems,
        truncated: true,
        full_results: tmpPath,
    };
}
// Strip ANSI escape codes to get visible character count
function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*m/g, '');
}
function padEndVisible(s, width) {
    const visible = stripAnsi(s).length;
    if (visible >= width)
        return s;
    return s + ' '.repeat(width - visible);
}
function sliceVisible(s, width) {
    const visible = stripAnsi(s);
    if (visible.length <= width)
        return padEndVisible(s, width);
    // Need to truncate — walk through keeping ANSI codes, counting visible chars
    let result = '';
    let count = 0;
    let i = 0;
    while (i < s.length && count < width) {
        if (s[i] === '\x1b') {
            const end = s.indexOf('m', i);
            if (end !== -1) {
                result += s.slice(i, end + 1);
                i = end + 1;
                continue;
            }
        }
        result += s[i];
        count++;
        i++;
    }
    // Close any open ANSI sequences
    if (/\x1b\[[0-9;]*m/.test(result))
        result += '\x1b[0m';
    return result;
}
export function formatTable(rows, columns) {
    if (isAgent)
        return; // Agent mode uses JSON
    const widths = columns.map(col => {
        const maxData = Math.max(...rows.map(r => stripAnsi(String(r[col.key] ?? '')).length));
        return col.width ?? Math.max(col.label.length, Math.min(maxData, 40));
    });
    const header = columns.map((col, i) => chalk.bold(col.label.padEnd(widths[i]))).join('  ');
    console.log(header);
    console.log(chalk.dim(columns.map((_, i) => '─'.repeat(widths[i])).join('  ')));
    for (const row of rows) {
        const line = columns.map((col, i) => sliceVisible(String(row[col.key] ?? ''), widths[i])).join('  ');
        console.log(line);
    }
}
export function formatKeyValue(data, keys) {
    if (isAgent)
        return;
    const maxLabel = Math.max(...keys.map(k => k.label.length));
    for (const { key, label } of keys) {
        const val = data[key];
        if (val !== undefined && val !== null) {
            console.log(`  ${chalk.bold(label.padEnd(maxLabel))}  ${val}`);
        }
    }
}
