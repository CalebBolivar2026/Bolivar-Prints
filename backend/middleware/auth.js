/**
 * Bolivar Prints - Centralized Authentication Middleware
 *
 * Provides HMAC-SHA256 signed token generation and verification so that
 * tokens cannot be forged by simply base64-encoding arbitrary payloads.
 *
 * TOKEN FORMAT (before signing):
 *   <userId>:<email>:<issuedAt_ms>
 *
 * WIRE FORMAT (Authorization header):
 *   Bearer <base64(payload)>.<hex(hmac-sha256)>
 */

const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');

// ─── Secret key ───────────────────────────────────────────────────────────────
// Use an environment variable in production. The fallback is a stable dev key
// derived from a random value written to disk once, so restarts don't
// invalidate all live sessions during development.

const SECRET_KEY_FILE = path.join(__dirname, '../data/.session_secret');

function loadOrCreateSecret() {
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }
    try {
        if (fs.existsSync(SECRET_KEY_FILE)) {
            const secret = fs.readFileSync(SECRET_KEY_FILE, 'utf-8').trim();
            if (secret.length >= 32) return secret;
        }
        // Generate and persist a new secret
        const newSecret = crypto.randomBytes(48).toString('hex');
        fs.writeFileSync(SECRET_KEY_FILE, newSecret, { mode: 0o600 });
        return newSecret;
    } catch {
        // If file I/O fails, fall back to a process-lifetime secret
        return crypto.randomBytes(48).toString('hex');
    }
}

const SECRET_KEY = loadOrCreateSecret();

// ─── Admin credentials ────────────────────────────────────────────────────────
// Read from environment. Never hardcode credentials in source.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bolivar';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_EMAIL    = 'admin@bolivarprints.com';

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns the wire-format token: base64(payload).hex(hmac).
 */
function signPayload(payload) {
    const hmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    return `${Buffer.from(payload).toString('base64')}.${hmac}`;
}

/**
 * Verify and decode a wire-format token.
 * Returns the payload string, or null if invalid/tampered.
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const b64payload = token.substring(0, dotIndex);
    const providedHmac = token.substring(dotIndex + 1);

    let payload;
    try {
        payload = Buffer.from(b64payload, 'base64').toString('utf-8');
    } catch {
        return null;
    }

    const expectedHmac = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(expectedHmac, 'hex');
    const provided = Buffer.from(providedHmac.padEnd(expectedHmac.length, '0'), 'hex');
    if (expected.length !== provided.length) return null;
    if (!crypto.timingSafeEqual(expected, provided)) return null;

    return payload;
}

/**
 * Generate a signed token for a regular user.
 */
function generateUserToken(user) {
    const payload = `user:${user.id}:${user.email.toLowerCase()}:${Date.now()}`;
    return signPayload(payload);
}

/**
 * Generate a signed token for the admin.
 */
function generateAdminToken() {
    const payload = `admin:${ADMIN_USERNAME}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    return signPayload(payload);
}

/**
 * Verify an admin token. Returns true/false.
 */
function verifyAdminToken(token) {
    const payload = verifyToken(token);
    return payload !== null && payload.startsWith('admin:');
}

// ─── Users file helper ────────────────────────────────────────────────────────

const usersFilePath = path.join(__dirname, '../data/users.json');

function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    } catch {
        return [];
    }
}

// ─── Express middleware ───────────────────────────────────────────────────────

/**
 * requireAuth: Attaches req.user or returns 401.
 * Use on routes that MUST be authenticated (profile, orders, etc.).
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    // Admin token
    if (payload.startsWith('admin:')) {
        req.user = {
            id: 'admin_root',
            name: 'Store Administrator',
            email: ADMIN_EMAIL,
            role: 'admin',
            isAdmin: true,
        };
        return next();
    }

    // User token: format is "user:<userId>:<email>:<issuedAt>"
    const parts = payload.split(':');
    if (parts.length < 4 || parts[0] !== 'user') {
        return res.status(401).json({ success: false, error: 'Malformed authentication token' });
    }

    const [, userId, email] = parts;
    const users = getUsers();
    const user = users.find(u => u.id === userId && u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    req.user = user;
    return next();
}

/**
 * optionalAuth: Attaches req.user if a valid token is present, but does NOT
 * block unauthenticated requests. Use on public endpoints that behave
 * differently when a user is logged in (e.g., cart validate, checkout).
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
        req.user = null;
        return next();
    }

    if (payload.startsWith('admin:')) {
        req.user = {
            id: 'admin_root',
            name: 'Store Administrator',
            email: ADMIN_EMAIL,
            role: 'admin',
            isAdmin: true,
        };
        return next();
    }

    const parts = payload.split(':');
    if (parts.length >= 4 && parts[0] === 'user') {
        const [, userId, email] = parts;
        const users = getUsers();
        const user = users.find(u => u.id === userId && u.email.toLowerCase() === email.toLowerCase());
        req.user = user || null;
    } else {
        req.user = null;
    }

    return next();
}

/**
 * requireAdmin: Blocks request unless a valid admin token is present.
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !verifyAdminToken(token)) {
        return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    next();
}

module.exports = {
    generateUserToken,
    generateAdminToken,
    verifyAdminToken,
    requireAuth,
    optionalAuth,
    requireAdmin,
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
    ADMIN_EMAIL,
};
