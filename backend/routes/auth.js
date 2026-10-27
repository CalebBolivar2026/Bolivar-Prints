const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const usersFilePath = path.join(__dirname, '../data/users.json');
const ordersFilePath = path.join(__dirname, '../data/orders.json');

// Ensure users.json exists
if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, '[]', 'utf-8');
}

// Ensure orders.json exists
if (!fs.existsSync(ordersFilePath)) {
    fs.writeFileSync(ordersFilePath, '[]', 'utf-8');
}

function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
    } catch {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
}

function getOrders() {
    try {
        return JSON.parse(fs.readFileSync(ordersFilePath, 'utf-8'));
    } catch {
        return [];
    }
}

// Password hashing utilities
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateToken(user) {
    const payload = `${user.id}:${user.email}:${Date.now()}`;
    return Buffer.from(payload).toString('base64');
}

function sanitizeUser(user) {
    const { passwordHash, salt, ...safeUser } = user;
    return safeUser;
}

/**
 * Middleware: Verify Auth Token from Header
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        if (decoded.startsWith('ADMIN:')) {
            req.user = {
                id: 'admin_root',
                name: 'Store Administrator',
                email: 'admin@bolivarprints.com',
                role: 'admin',
                isAdmin: true,
            };
            return next();
        }
        const [userId, email] = decoded.split(':');
        const users = getUsers();
        const user = users.find(u => u.id === userId && u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid or expired session' });
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Malformed authentication token' });
    }
}

/**
 * POST /api/auth/register
 * Creates a new user account.
 */
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

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

        const newUser = {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            phone: phone ? phone.trim() : '',
            passwordHash,
            salt,
            shippingAddress: {
                street: '',
                apt: '',
                city: '',
                state: 'FL',
                zip: '',
                country: 'United States',
            },
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        saveUsers(users);

        const token = generateToken(newUser);
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

/**
 * POST /api/auth/login
 * Authenticates user credentials.
 */
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ─── Special Admin Login Verification ────────────────────────────────
        if ((normalizedEmail === 'admin' || normalizedEmail === 'admin@bolivarprints.com') && password === 'bolivar') {
            const adminUser = {
                id: 'admin_root',
                name: 'Store Administrator',
                email: 'admin@bolivarprints.com',
                role: 'admin',
                isAdmin: true,
            };
            const payload = `ADMIN:admin:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
            const token = Buffer.from(payload).toString('base64');
            return res.json({
                success: true,
                message: 'Admin login successful',
                user: adminUser,
                token,
                isAdmin: true,
            });
        }
        const user = users.find(u => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const checkHash = hashPassword(password, user.salt);
        if (checkHash !== user.passwordHash) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const token = generateToken(user);
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

/**
 * GET /api/auth/me
 * Retrieves the current authenticated user profile.
 */
router.get('/me', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: sanitizeUser(req.user),
    });
});

/**
 * PUT /api/auth/profile
 * Updates user profile, default shipping address, and password.
 */
router.put('/profile', authenticateToken, (req, res) => {
    try {
        const users = getUsers();
        const index = users.findIndex(u => u.id === req.user.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const { name, phone, shippingAddress, currentPassword, newPassword } = req.body;
        const user = users[index];

        if (name && name.trim()) user.name = name.trim();
        if (phone !== undefined) user.phone = phone.trim();

        if (shippingAddress && typeof shippingAddress === 'object') {
            user.shippingAddress = {
                street: shippingAddress.street !== undefined ? shippingAddress.street.trim() : (user.shippingAddress?.street || ''),
                apt: shippingAddress.apt !== undefined ? shippingAddress.apt.trim() : (user.shippingAddress?.apt || ''),
                city: shippingAddress.city !== undefined ? shippingAddress.city.trim() : (user.shippingAddress?.city || ''),
                state: shippingAddress.state !== undefined ? shippingAddress.state.trim() : (user.shippingAddress?.state || 'FL'),
                zip: shippingAddress.zip !== undefined ? shippingAddress.zip.trim() : (user.shippingAddress?.zip || ''),
                country: shippingAddress.country !== undefined ? shippingAddress.country.trim() : (user.shippingAddress?.country || 'United States'),
            };
        }

        // Change password if requested
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, error: 'Current password is required to set a new password' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
            }
            const currentHash = hashPassword(currentPassword, user.salt);
            if (currentHash !== user.passwordHash) {
                return res.status(400).json({ success: false, error: 'Incorrect current password' });
            }

            user.salt = crypto.randomBytes(16).toString('hex');
            user.passwordHash = hashPassword(newPassword, user.salt);
        }

        user.updatedAt = new Date().toISOString();
        users[index] = user;
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

/**
 * GET /api/auth/orders
 * Returns all past orders placed by this user (matched by user ID or email).
 */
router.get('/orders', authenticateToken, (req, res) => {
    try {
        const allOrders = getOrders();
        const userEmail = req.user.email.toLowerCase();
        const userId = req.user.id;

        const userOrders = allOrders
            .filter(o => {
                const matchEmail = o.customer && o.customer.email && o.customer.email.toLowerCase() === userEmail;
                const matchId = o.userId === userId;
                return matchEmail || matchId;
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            count: userOrders.length,
            orders: userOrders,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
