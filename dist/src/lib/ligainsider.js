import { parse } from 'node-html-parser';
const BASE_URL = 'https://www.ligainsider.de';
// All 18 Bundesliga teams with their LigaInsider slugs and IDs
export const TEAMS = {
    'bayern': { slug: 'fc-bayern-muenchen', id: 1, short: 'FCB' },
    'dortmund': { slug: 'borussia-dortmund', id: 14, short: 'BVB' },
    'leverkusen': { slug: 'bayer-04-leverkusen', id: 4, short: 'B04' },
    'leipzig': { slug: 'rb-leipzig', id: 1311, short: 'RBL' },
    'stuttgart': { slug: 'vfb-stuttgart', id: 12, short: 'VFB' },
    'frankfurt': { slug: 'eintracht-frankfurt', id: 6, short: 'SGE' },
    'freiburg': { slug: 'sc-freiburg', id: 15, short: 'SCF' },
    'wolfsburg': { slug: 'vfl-wolfsburg', id: 11, short: 'WOB' },
    'gladbach': { slug: 'borussia-moenchengladbach', id: 3, short: 'BMG' },
    'mainz': { slug: '1-fsv-mainz-05', id: 16, short: 'M05' },
    'hoffenheim': { slug: 'tsg-hoffenheim', id: 10, short: 'TSG' },
    'augsburg': { slug: 'fc-augsburg', id: 17, short: 'FCA' },
    'union': { slug: '1-fc-union-berlin', id: 1325, short: 'FCU' },
    'bochum': { slug: 'vfl-bochum', id: 13, short: 'BOC' },
    'pauli': { slug: 'fc-st-pauli', id: 7, short: 'STP' },
    'bremen': { slug: 'sv-werder-bremen', id: 8, short: 'SVW' },
    'heidenheim': { slug: '1-fc-heidenheim', id: 1543, short: 'FCH' },
    'kiel': { slug: 'holstein-kiel', id: 1362, short: 'KSV' },
};
async function fetchPage(path) {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
        throw new Error(`LigaInsider returned ${res.status} for ${path}`);
    const html = await res.text();
    return parse(html);
}
export async function fetchNews(page = 1) {
    const path = page === 1 ? '/' : `/startpage/uebersicht/${page}/`;
    const doc = await fetchPage(path);
    const items = [];
    // Each article has multiple <a> tags with the same href (image, player name, title).
    // Group by href, then extract player name (short text) and title (longer text).
    const links = doc.querySelectorAll('a');
    const articleGroups = new Map();
    for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        // Match article pattern: /player-slug_id/article-slug-123456/ or /team-slug/id/article-123456/
        if (!href.match(/\d{5,}\/?$/))
            continue;
        if (href.includes('#'))
            continue;
        const text = link.textContent?.trim() ?? '';
        if (!articleGroups.has(href)) {
            articleGroups.set(href, { texts: [], href });
        }
        if (text && text.length > 1) {
            articleGroups.get(href).texts.push(text);
        }
    }
    // Detect status icons near each article — scan all images once
    const imgs = doc.querySelectorAll('img');
    const statusBySlug = new Map();
    for (const img of imgs) {
        const src = img.getAttribute('src') ?? '';
        let status = '';
        if (src.includes('verletzung'))
            status = 'Verletzung';
        else if (src.includes('aufbautraining'))
            status = 'Aufbautraining';
        else if (src.includes('angeschlagen'))
            status = 'Angeschlagen';
        else if (src.includes('gesperrt') || src.includes('rote-karte'))
            status = 'Gesperrt';
        else
            continue;
        // Find the nearest article link in this image's parent chain
        let parent = img.parentNode;
        for (let depth = 0; depth < 5 && parent; depth++) {
            const nearbyLink = parent.querySelector?.('a');
            if (nearbyLink) {
                const href = nearbyLink.getAttribute('href') ?? '';
                if (href.match(/\d{5,}\/?$/)) {
                    statusBySlug.set(href, status);
                    break;
                }
            }
            parent = parent.parentNode;
        }
    }
    for (const [href, group] of articleGroups) {
        const texts = group.texts.filter(t => t.length >= 3 && !t.match(/^\d+$/));
        if (texts.length === 0)
            continue;
        // Shortest meaningful text is usually the player name, longest is the title
        texts.sort((a, b) => a.length - b.length);
        const player = texts[0] ?? '';
        const title = texts.length > 1 ? texts[texts.length - 1] : player;
        if (title === player && texts.length === 1)
            continue; // Skip entries with only one text
        const status = statusBySlug.get(href) ?? 'News';
        items.push({
            player,
            team: '',
            title,
            url: href,
            status,
            timestamp: '',
        });
    }
    return items;
}
function resolveTeam(input) {
    const key = input.toLowerCase();
    if (TEAMS[key])
        return TEAMS[key];
    // Try to match by slug or partial name
    for (const [k, v] of Object.entries(TEAMS)) {
        if (v.slug.includes(key) || k.includes(key) || v.short.toLowerCase() === key) {
            return v;
        }
    }
    throw new Error(`Unknown team "${input}". Valid: ${Object.keys(TEAMS).join(', ')}`);
}
export async function fetchTeamPage(teamInput) {
    const team = resolveTeam(teamInput);
    const doc = await fetchPage(`/${team.slug}/${team.id}/`);
    const text = doc.text;
    // Extract next match info
    let nextMatch = '';
    const matchEl = doc.querySelector('.match-info, .next-match, [class*="match"]');
    if (matchEl)
        nextMatch = matchEl.textContent?.trim() ?? '';
    // Extract players from lineup section — they have profile links and ratings
    const players = [];
    const playerLinks = doc.querySelectorAll('a[href*="_"]');
    const seenPlayers = new Set();
    for (const link of playerLinks) {
        const href = link.getAttribute('href') ?? '';
        const profileMatch = href.match(/^\/([^/]+)_(\d+)\/?$/);
        if (!profileMatch)
            continue;
        const playerId = profileMatch[2];
        if (seenPlayers.has(playerId))
            continue;
        const name = link.textContent?.trim() ?? '';
        if (!name || name.length < 2 || name.length > 40)
            continue;
        // Look for rating nearby — German format uses comma (3,5 not 3.5)
        const parent = link.parentNode;
        const container = parent?.parentNode;
        const surroundingText = (container ?? parent)?.textContent ?? '';
        const ratingMatch = surroundingText.match(/(\d)[,.](\d)/);
        const rating = ratingMatch ? parseFloat(`${ratingMatch[1]}.${ratingMatch[2]}`) : 0;
        // Check status from icons
        let status = 'Fit';
        const icons = (container ?? parent)?.querySelectorAll?.('img') ?? [];
        for (const icon of icons) {
            const src = icon.getAttribute('src') ?? '';
            if (src.includes('verletzung'))
                status = 'Verletzt';
            else if (src.includes('aufbautraining'))
                status = 'Aufbautraining';
            else if (src.includes('angeschlagen'))
                status = 'Angeschlagen';
            else if (src.includes('gesperrt') || src.includes('rote-karte'))
                status = 'Gesperrt';
        }
        seenPlayers.add(playerId);
        players.push({
            name,
            position: '',
            rating,
            status,
            playerId,
        });
    }
    // Extract injuries from the injury table
    const injuries = [];
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2)
                continue;
            const firstCell = cells[0];
            const injIcon = firstCell.querySelector('img[src*="verletzung"], img[src*="rote-karte"], img[src*="gesperrt"]');
            if (!injIcon)
                continue;
            const playerLink = firstCell.querySelector('a[href*="_"]');
            const playerName = playerLink?.textContent?.trim() ?? firstCell.textContent?.trim() ?? '';
            const href = playerLink?.getAttribute('href') ?? '';
            const idMatch = href.match(/_(\d+)/);
            const reason = cells[1]?.textContent?.trim() ?? '';
            const duration = cells[cells.length - 1]?.textContent?.trim() ?? '';
            injuries.push({
                player: playerName,
                reason,
                duration,
                playerId: idMatch?.[1] ?? '',
            });
        }
    }
    // Extract news headlines
    const news = [];
    const newsLinks = doc.querySelectorAll('a[href*="-"]');
    for (const link of newsLinks) {
        const href = link.getAttribute('href') ?? '';
        if (href.match(/\d{5,}\/?$/)) {
            const title = link.textContent?.trim() ?? '';
            if (title && title.length > 10 && title.length < 200) {
                news.push(title);
            }
        }
    }
    return {
        team: team.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        nextMatch,
        formation: '',
        players,
        injuries,
        news: [...new Set(news)].slice(0, 10),
    };
}
export async function fetchAllInjuries() {
    const doc = await fetchPage('/bundesliga/verletzte-und-gesperrte-spieler/');
    const teams = [];
    // Structure: div.personal_table contains h2 (team name) + div.small_table_row entries
    // Each row has: .small_table_column1 (player), .small_table_column2 (reason),
    //               .small_table_column3 (article), .small_table_column4 (duration)
    const personalTables = doc.querySelectorAll('.personal_table');
    for (const pt of personalTables) {
        const h2 = pt.querySelector('h2');
        const teamName = h2?.textContent?.trim() ?? '';
        if (!teamName)
            continue;
        const players = [];
        const rows = pt.querySelectorAll('.small_table_row');
        for (const row of rows) {
            const col1 = row.querySelector('.small_table_column1');
            const col2 = row.querySelector('.small_table_column2');
            const col4 = row.querySelector('.small_table_column4');
            const name = col1?.querySelector('strong')?.textContent?.trim() ??
                col1?.textContent?.trim() ?? '';
            const reason = col2?.textContent?.trim() ?? '';
            const duration = col4?.textContent?.trim() ?? '';
            const playerLink = col1?.querySelector('a[href*="_"]');
            const href = playerLink?.getAttribute('href') ?? '';
            const idMatch = href.match(/_(\d+)/);
            if (name && name.length >= 2) {
                players.push({
                    player: name,
                    reason,
                    duration,
                    playerId: idMatch?.[1] ?? '',
                });
            }
        }
        if (players.length > 0) {
            teams.push({ team: teamName, players });
        }
    }
    return teams;
}
export async function fetchTable() {
    const doc = await fetchPage('/bundesliga/tabelle/');
    const entries = [];
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6)
                continue;
            const texts = Array.from(cells).map(c => c.textContent?.trim() ?? '');
            const pos = parseInt(texts[0]);
            if (isNaN(pos))
                continue;
            // Find team name — usually in a link
            const teamLink = row.querySelector('a');
            const teamName = teamLink?.textContent?.trim() ?? texts[1] ?? '';
            entries.push({
                position: pos,
                team: teamName,
                matches: parseInt(texts[2]) || 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goals: texts[texts.length - 3] ?? '',
                diff: texts[texts.length - 2] ?? '',
                points: parseInt(texts[texts.length - 1]) || 0,
            });
        }
    }
    return entries;
}
export async function fetchPlayer(slug) {
    const doc = await fetchPage(`/${slug}/`);
    const text = doc.text;
    const name = doc.querySelector('h1')?.textContent?.trim() ?? slug;
    // Extract stats from text patterns
    const ratingMatch = text.match(/(\d\.\d+)\s*(?:Ø|Schnitt|Note)/i);
    const goalsMatch = text.match(/(\d+)\s*Tore/);
    const assistsMatch = text.match(/(\d+)\s*Assists?/i) ?? text.match(/(\d+)\s*Vorlagen/);
    const appsMatch = text.match(/(\d+)\s*(?:Einsätze|Spiele)/i);
    const pointsMatch = text.match(/([\d.,]+)\s*Punkte/);
    return {
        name,
        team: '',
        position: '',
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
        appearances: appsMatch ? parseInt(appsMatch[1]) : 0,
        goals: goalsMatch ? parseInt(goalsMatch[1]) : 0,
        assists: assistsMatch ? parseInt(assistsMatch[1]) : 0,
        points: pointsMatch ? parseInt(pointsMatch[1].replace(/[.,]/g, '')) : 0,
        injuries: [],
    };
}
export { resolveTeam };
