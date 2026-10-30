/**
 * Bolivar Prints - Auth Routes
 *
 * Handles user registration, login, profile management, and order history.
 * Tokens are HMAC-SHA256 signed — not forgeable by clients.
 */

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const {
    generateUserToken,
    generateAdminToken,
    requireAuth,
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
    ADMIN_EMAIL,
} = require('../middleware/auth');

const usersFilePath  = path.join(__dirname, '../data/users.json');
const ordersFilePath = path.join(__dirname, '../data/orders.json');

// Ensure data files exist
if (!fs.existsSync(usersFilePath))  fs.writeFileSync(usersFilePath,  '[]', 'utf-8');
if (!fs.existsSync(ordersFilePath)) fs.writeFileSync(ordersFilePath, '[]', 'utf-8');

// ─── Data helpers ──────────────────────────────────────────────────────────────

function getUsers() {
    try { return JSON.parse(fs.readFileSync(usersFilePath, 'utf-8')); }
    catch { return []; }
}

function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
}

function getOrders() {
    try { return JSON.parse(fs.readFileSync(ordersFilePath, 'utf-8')); }
    catch { return []; }
}

// ─── Password utilities ────────────────────────────────────────────────────────

// PBKDF2 with 100,000 iterations (NIST recommendation for SHA-512).
// NOTE: Existing accounts hashed with 1,000 iterations will need to re-login
// to transparently upgrade their hash (handled below).
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_LEGACY_ITERATIONS = 1_000; // original iteration count

function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
    return crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
}

function verifyPassword(password, user) {
    // Detect legacy hash (1,000 iterations) by checking stored iteration count.
    // New users have `pbkdf2Iterations` set; old records don't → treat as legacy.
    const iterations = user.pbkdf2Iterations || PBKDF2_LEGACY_ITERATIONS;
    const hash = hashPassword(password, user.salt, iterations);
    return hash === user.passwordHash;
}

function sanitizeUser(user) {
    const { passwordHash, salt, pbkdf2Iterations, ...safeUser } = user;
    return safeUser;
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post('/register', (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Full name is required' });
        }
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'A valid email address is required' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
        }

        const users = getUsers();
        const normalizedEmail = email.trim().toLowerCase();

        if (users.some(u => u.email.toLowerCase() === normalizedEmail)) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists' });
        }

        const salt         = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt, PBKDF2_ITERATIONS);
        const userId       = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        const newUser = {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            phone: phone ? phone.trim() : '',
            passwordHash,
            salt,
            pbkdf2Iterations: PBKDF2_ITERATIONS,
            shippingAddress: {
                street: '', apt: '', city: '', state: 'FL', zip: '', country: 'United States',
            },
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        saveUsers(users);

        const token    = generateUserToken(newUser);
        const safeUser = sanitizeUser(newUser);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: safeUser,
            token,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ── Admin login ───────────────────────────────────────────────────────
        const isAdminEmail    = normalizedEmail === ADMIN_USERNAME || normalizedEmail === ADMIN_EMAIL;
        const isAdminPassword = password === ADMIN_PASSWORD;

        if (isAdminEmail && isAdminPassword) {
            const adminUser = {
                id: 'admin_root',
                name: 'Store Administrator',
                email: ADMIN_EMAIL,
                role: 'admin',
                isAdmin: true,
            };
            return res.json({
                success: true,
                message: 'Admin login successful',
                user: adminUser,
                token: generateAdminToken(),
                isAdmin: true,
            });
        }

        // ── Regular user login ────────────────────────────────────────────────
        const users = getUsers(); // ← was missing in original, caused ReferenceError
        const user  = users.find(u => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
            // Constant-time response to prevent user enumeration
            hashPassword('dummy', crypto.randomBytes(16).toString('hex'));
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        if (!verifyPassword(password, user)) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Transparently upgrade legacy low-iteration hashes on successful login
        if (!user.pbkdf2Iterations || user.pbkdf2Iterations < PBKDF2_ITERATIONS) {
            const idx = users.findIndex(u => u.id === user.id);
            users[idx].salt             = crypto.randomBytes(16).toString('hex');
            users[idx].passwordHash     = hashPassword(password, users[idx].salt, PBKDF2_ITERATIONS);
            users[idx].pbkdf2Iterations = PBKDF2_ITERATIONS;
            saveUsers(users);
        }

        const token    = generateUserToken(user);
        const safeUser = sanitizeUser(user);

        res.json({
            success: true,
            message: 'Login successful',
            user: safeUser,
            token,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: sanitizeUser(req.user),
    });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────

router.put('/profile', requireAuth, (req, res) => {
    try {
        const users = getUsers();
        const index = users.findIndex(u => u.id === req.user.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { name, phone, shippingAddress, currentPassword, newPassword } = req.body;
        const user = users[index];

        if (name && name.trim()) user.name = name.trim();
        if (phone !== undefined)  user.phone = phone.trim();

        if (shippingAddress && typeof shippingAddress === 'object') {
            user.shippingAddress = {
                street:  shippingAddress.street  !== undefined ? shippingAddress.street.trim()  : (user.shippingAddress?.street  || ''),
                apt:     shippingAddress.apt     !== undefined ? shippingAddress.apt.trim()     : (user.shippingAddress?.apt     || ''),
                city:    shippingAddress.city    !== undefined ? shippingAddress.city.trim()    : (user.shippingAddress?.city    || ''),
                state:   shippingAddress.state   !== undefined ? shippingAddress.state.trim()   : (user.shippingAddress?.state   || 'FL'),
                zip:     shippingAddress.zip     !== undefined ? shippingAddress.zip.trim()     : (user.shippingAddress?.zip     || ''),
                country: shippingAddress.country !== undefined ? shippingAddress.country.trim() : (user.shippingAddress?.country || 'United States'),
            };
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, error: 'Current password is required to set a new password' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
            }
            if (!verifyPassword(currentPassword, user)) {
                return res.status(400).json({ success: false, error: 'Incorrect current password' });
            }

            user.salt             = crypto.randomBytes(16).toString('hex');
            user.passwordHash     = hashPassword(newPassword, user.salt, PBKDF2_ITERATIONS);
            user.pbkdf2Iterations = PBKDF2_ITERATIONS;
        }

        user.updatedAt = new Date().toISOString();
        users[index]   = user;
        saveUsers(users);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: sanitizeUser(user),
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/auth/orders ─────────────────────────────────────────────────────
// Returns only orders that belong to the authenticated user.
// Isolation is enforced server-side: the user ID comes from the verified token,
// not from any client-supplied parameter.

router.get('/orders', requireAuth, (req, res) => {
    try {
        const allOrders   = getOrders();
        const userEmail   = req.user.email.toLowerCase();
        const userId      = req.user.id;

        const userOrders = allOrders
            .filter(o => {
                const matchEmail = o.customer?.email?.toLowerCase() === userEmail;
                const matchId    = o.userId === userId;
                return matchEmail || matchId;
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            count:  userOrders.length,
            orders: userOrders,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
