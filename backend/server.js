const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const productRoutes     = require('./routes/products');
const customOrderRoutes = require('./routes/customOrder');
const cartRoutes        = require('./routes/cart');
const checkoutRoutes    = require('./routes/checkout');
const authRoutes        = require('./routes/auth');
const adminRoutes       = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Restrict to known origins. In production set ALLOWED_ORIGINS in the environment.
// During local development the server also serves the static site on the same
// origin, so same-origin requests need no CORS header at all.
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., same-origin, Postman, curl)
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS policy: origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies and URL-encoded forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/custom-order', customOrderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', require('./routes/contact'));

// Public site settings for store announcement banner
app.get('/api/site-settings', (req, res) => {
    const settingsPath = path.join(__dirname, 'data/settings.json');
    try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        res.json({ success: true, settings: JSON.parse(raw) });
    } catch {
        res.json({ success: true, settings: {} });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Bolivar Prints Backend API',
        timestamp: new Date().toISOString(),
    });
});

// Serve uploaded files (product pictures, 3D attachments)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve website static assets from root directory
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

// Fallback to index.html for root navigation
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Bolivar Prints Backend Server is running!`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log(`API Health: http://localhost:${PORT}/api/health`);
    console.log(`Website served from: ${publicPath}`);
    console.log(`=========================================`);
});
