/**
 * Bolivar Prints - Admin Routes
 * Protected admin-only API endpoints for managing the store.
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const usersFilePath = path.join(__dirname, '../data/users.json');
const productsFilePath = path.join(__dirname, '../data/products.json');
const ordersFilePath = path.join(__dirname, '../data/orders.json');
const settingsFilePath = path.join(__dirname, '../data/settings.json');

// ─── Admin credentials (hardcoded for simplicity) ────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'bolivar';

// ─── Helper: read JSON data files ────────────────────────────────────────────

function readJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return [];
    }
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Admin token generation & verification ───────────────────────────────────

function generateAdminToken() {
    const payload = `ADMIN:${ADMIN_USERNAME}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    return Buffer.from(payload).toString('base64');
}

function verifyAdminToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        return decoded.startsWith('ADMIN:');
    } catch {
        return false;
    }
}

// ─── Middleware: require admin auth ──────────────────────────────────────────

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !verifyAdminToken(token)) {
        return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    next();
}

// ─── POST /api/admin/login ───────────────────────────────────────────────────

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if ((username === ADMIN_USERNAME || username === 'admin@bolivarprints.com') && password === ADMIN_PASSWORD) {
        const token = generateAdminToken();
        return res.json({
            success: true,
            message: 'Admin login successful',
            token,
            admin: {
                id: 'admin_root',
                username: ADMIN_USERNAME,
                name: 'Store Administrator',
                email: 'admin@bolivarprints.com',
                role: 'admin',
                isAdmin: true,
            },
        });
    }

    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
});

// ─── GET /api/admin/verify ───────────────────────────────────────────────────

router.get('/verify', requireAdmin, (req, res) => {
    res.json({
        success: true,
        message: 'Admin token valid',
        admin: {
            id: 'admin_root',
            username: ADMIN_USERNAME,
            name: 'Store Administrator',
            email: 'admin@bolivarprints.com',
            role: 'admin',
            isAdmin: true,
        },
    });
});

// ─── GET /api/admin/site-settings (Public: for storefront customer announcement)
router.get('/site-settings', (req, res) => {
    const settings = readJSON(settingsFilePath);
    res.json({ success: true, settings });
});

// ─── GET /api/admin/settings (Protected) ──────────────────────────────────────
router.get('/settings', requireAdmin, (req, res) => {
    const settings = readJSON(settingsFilePath);
    res.json({ success: true, settings });
});

// ─── PUT /api/admin/settings (Protected) ──────────────────────────────────────
router.put('/settings', requireAdmin, (req, res) => {
    const updates = req.body || {};
    const existing = readJSON(settingsFilePath);
    const updated = {
        ...existing,
        ...updates,
        announcement: {
            ...(existing.announcement || {}),
            ...(updates.announcement || {}),
        },
        updatedAt: new Date().toISOString(),
    };
    writeJSON(settingsFilePath, updated);
    res.json({ success: true, message: 'Site settings updated', settings: updated });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', requireAdmin, (req, res) => {
    const products = readJSON(productsFilePath);
    const orders = readJSON(ordersFilePath);
    const users = readJSON(usersFilePath);

    const totalRevenue = orders.reduce((sum, o) => {
        const total = o.pricingSummary?.total || 0;
        return sum + total;
    }, 0);

    res.json({
        success: true,
        stats: {
            totalProducts: products.length,
            totalOrders: orders.length,
            totalUsers: users.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
        },
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET all products (admin view — full data)
router.get('/products', requireAdmin, (req, res) => {
    const products = readJSON(productsFilePath);
    res.json({ success: true, count: products.length, products });
});

// PUT update product
router.put('/products/:id', requireAdmin, (req, res) => {
    const products = readJSON(productsFilePath);
    const index = products.findIndex(p => p.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const updates = req.body;
    const existing = products[index];

    if (updates.name !== undefined) existing.name = updates.name.trim();
    if (updates.price !== undefined) existing.price = Number(parseFloat(updates.price).toFixed(2));
    if (updates.category !== undefined) existing.category = updates.category.trim().toLowerCase();
    if (updates.tag !== undefined) existing.tag = updates.tag.trim();
    if (updates.icon !== undefined) existing.icon = updates.icon.trim();
    if (updates.description !== undefined) existing.description = updates.description.trim();
    if (updates.inStock !== undefined) existing.inStock = updates.inStock === true || updates.inStock === 'true';
    if (updates.colors !== undefined) {
        existing.colors = Array.isArray(updates.colors)
            ? updates.colors
            : updates.colors.split(',').map(c => c.trim()).filter(Boolean);
    }
    if (updates.image !== undefined) existing.image = updates.image;

    existing.updatedAt = new Date().toISOString();
    products[index] = existing;
    writeJSON(productsFilePath, products);

    res.json({ success: true, message: 'Product updated', product: existing });
});

// DELETE product
router.delete('/products/:id', requireAdmin, (req, res) => {
    let products = readJSON(productsFilePath);
    const initialLen = products.length;
    products = products.filter(p => p.id !== req.params.id);

    if (products.length === initialLen) {
        return res.status(404).json({ success: false, error: 'Product not found' });
    }

    writeJSON(productsFilePath, products);
    res.json({ success: true, message: 'Product deleted' });
});

// POST create product
router.post('/products', requireAdmin, (req, res) => {
    const products = readJSON(productsFilePath);
    const { name, price, category, tag, icon, description, colors, image } = req.body;

    if (!name || !price) {
        return res.status(400).json({ success: false, error: 'Product name and price are required' });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `product-${Date.now()}`;

    if (products.some(p => p.id === id)) {
        return res.status(400).json({ success: false, error: 'A product with this name/ID already exists' });
    }

    const parsedColors = colors
        ? (Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim()).filter(Boolean))
        : ['Standard'];

    const newProduct = {
        id,
        name: name.trim(),
        price: Number(parseFloat(price).toFixed(2)),
        category: (category || 'decor').trim().toLowerCase(),
        tag: (tag || 'Precision Print').trim(),
        icon: (icon || 'fa-cube').trim(),
        description: (description || '').trim(),
        colors: parsedColors,
        image: image || null,
        inStock: true,
        createdAt: new Date().toISOString(),
    };

    products.push(newProduct);
    writeJSON(productsFilePath, products);

    res.status(201).json({ success: true, message: 'Product created', product: newProduct });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET all orders
router.get('/orders', requireAdmin, (req, res) => {
    const orders = readJSON(ordersFilePath);
    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, count: orders.length, orders });
});

// PUT update order status
router.put('/orders/:orderId', requireAdmin, (req, res) => {
    const orders = readJSON(ordersFilePath);
    const index = orders.findIndex(o => o.orderId === req.params.orderId);

    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const { status } = req.body;
    if (status) {
        orders[index].status = status;
        orders[index].updatedAt = new Date().toISOString();
    }

    writeJSON(ordersFilePath, orders);
    res.json({ success: true, message: 'Order updated', order: orders[index] });
});

// DELETE order
router.delete('/orders/:orderId', requireAdmin, (req, res) => {
    let orders = readJSON(ordersFilePath);
    const initialLen = orders.length;
    orders = orders.filter(o => o.orderId !== req.params.orderId);

    if (orders.length === initialLen) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }

    writeJSON(ordersFilePath, orders);
    res.json({ success: true, message: 'Order deleted' });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET all users (sanitized — no passwords)
router.get('/users', requireAdmin, (req, res) => {
    const users = readJSON(usersFilePath);
    const sanitized = users.map(u => {
        const { passwordHash, salt, ...safe } = u;
        return safe;
    });
    res.json({ success: true, count: sanitized.length, users: sanitized });
});

// DELETE user
router.delete('/users/:id', requireAdmin, (req, res) => {
    let users = readJSON(usersFilePath);
    const initialLen = users.length;
    users = users.filter(u => u.id !== req.params.id);

    if (users.length === initialLen) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    writeJSON(usersFilePath, users);
    res.json({ success: true, message: 'User deleted' });
});

module.exports = router;
