import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getCached, setCache } from './cache.js';
import { isVerboseMode } from './runtime.js';
const TOKEN_DIR = join(homedir(), '.config', 'kickbase-cli');
const TOKEN_FILE = join(TOKEN_DIR, 'token.json');
export class ApiError extends Error {
    status;
    body;
    constructor(status, body) {
        super(`API Error ${status}: ${body}`);
        this.status = status;
        this.body = body;
        this.name = 'ApiError';
    }
}
export class KickbaseClient {
    baseUrl;
    token = null;
    timeout;
    constructor(baseUrl, timeout) {
        this.baseUrl = (baseUrl ?? process.env.KICKBASE_BASE_URL ?? 'https://api.kickbase.com').replace(/\/$/, '');
        this.timeout = timeout ?? 30000;
        this.loadToken();
    }
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }
    loadToken() {
        if (!existsSync(TOKEN_FILE))
            return;
        try {
            const data = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
            if (new Date(data.expires) > new Date()) {
                this.token = data.token;
            }
        }
        catch {
            // Ignore corrupt token file
        }
    }
    saveToken(token, expires) {
        if (!existsSync(TOKEN_DIR)) {
            mkdirSync(TOKEN_DIR, { recursive: true });
        }
        writeFileSync(TOKEN_FILE, JSON.stringify({ token, expires }));
    }
    async login(email, password) {
        const em = email ?? process.env.KICKBASE_EMAIL;
        const pass = password ?? process.env.KICKBASE_PASSWORD;
        if (!em || !pass) {
            throw new Error('Email and password required. Set KICKBASE_EMAIL and KICKBASE_PASSWORD or pass --email and --password.');
        }
        const result = await this.doRequest('POST', '/v4/user/login', {
            em,
            pass,
            loy: false,
            rep: {},
        });
        this.token = result.tkn;
        this.saveToken(result.tkn, result.tknex);
        return result;
    }
    async ensureAuth() {
        if (this.token)
            return;
        await this.login();
    }
    // Raw HTTP call — no auth check, no 401 handling
    async doRequest(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (isVerboseMode()) {
            console.error(`[kb] ${method} ${url}`);
        }
        const response = await withRetry(async () => {
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(this.timeout),
            });
            if (!res.ok) {
                const errorBody = await res.text();
                if (isVerboseMode()) {
                    console.error(`[kb] ${res.status} ${method} ${url}`);
                }
                throw new ApiError(res.status, errorBody);
            }
            if (isVerboseMode()) {
                console.error(`[kb] ${res.status} ${method} ${url}`);
            }
            const contentType = res.headers.get('content-type') ?? '';
            if (contentType.includes('application/json')) {
                return res.json();
            }
            return res.text();
        });
        return response;
    }
    // Auth-aware request with automatic 401 refresh/re-login
    async request(method, path, body, skipAuth = false) {
        if (!skipAuth)
            await this.ensureAuth();
        try {
            return await this.doRequest(method, path, body);
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 401 && !skipAuth) {
                // Try token refresh first
                try {
                    await this.refreshToken();
                    return await this.doRequest(method, path, body);
                }
                catch {
                    // Refresh failed — full re-login
                    this.token = null;
                    await this.login();
                    return await this.doRequest(method, path, body);
                }
            }
            throw err;
        }
    }
    async refreshToken() {
        const result = await this.doRequest('POST', '/v4/user/refreshtokens');
        if (result.tkn) {
            this.token = result.tkn;
            this.saveToken(result.tkn, result.tknex);
        }
        else {
            throw new Error('Refresh did not return a token');
        }
    }
    async get(path) {
        return this.request('GET', path);
    }
    async cachedGet(path, ttl) {
        const cached = getCached(path);
        if (cached !== null)
            return cached;
        const result = await this.get(path);
        setCache(path, result, ttl);
        return result;
    }
    async post(path, body) {
        return this.request('POST', path, body);
    }
    async put(path, body) {
        return this.request('PUT', path, body);
    }
    async delete(path) {
        return this.request('DELETE', path);
    }
    isAuthenticated() {
        return this.token !== null;
    }
}
async function withRetry(fn, maxRetries = 3, backoff = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            // Don't retry on client errors (except 401 which is handled upstream)
            if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
                throw err;
            }
            if (attempt < maxRetries) {
                const delay = backoff * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}
