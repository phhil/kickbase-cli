import chalk from 'chalk';
import { isJsonMode } from './runtime.js';
const isAgent = () => isJsonMode();
export const c = {
    positive: (s) => isAgent() ? s : chalk.green(s),
    negative: (s) => isAgent() ? s : chalk.red(s),
    bold: (s) => isAgent() ? s : chalk.bold(s),
    dim: (s) => isAgent() ? s : chalk.dim(s),
    warn: (s) => isAgent() ? s : chalk.yellow(s),
    header: (s) => isAgent() ? s : chalk.bold.underline(s),
    value: (n, s) => {
        if (isAgent())
            return s;
        return n > 0 ? chalk.green(s) : n < 0 ? chalk.red(s) : s;
    },
    money: (val) => {
        const m = `${(val / 1_000_000).toFixed(1)}M`;
        return isAgent() ? m : (val >= 0 ? chalk.green(m) : chalk.red(m));
    },
    trend: (val) => {
        if (isAgent())
            return val > 0 ? `+${val}` : `${val}`;
        if (val > 0)
            return chalk.green(`▲ +${val}`);
        if (val < 0)
            return chalk.red(`▼ ${val}`);
        return chalk.dim('—');
    },
    trendMoney: (val) => {
        const m = (Math.abs(val) / 1_000_000).toFixed(1) + 'M';
        if (isAgent())
            return val > 0 ? `+${m}` : val < 0 ? `-${m}` : '0';
        if (val > 0)
            return chalk.green(`▲ +${m}`);
        if (val < 0)
            return chalk.red(`▼ -${m}`);
        return chalk.dim('—');
    },
    rating: (val) => {
        const s = val.toFixed(1);
        if (isAgent())
            return s;
        if (val <= 2.5)
            return chalk.green(s);
        if (val <= 3.5)
            return chalk.yellow(s);
        return chalk.red(s);
    },
};
