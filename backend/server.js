const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const productRoutes = require('./routes/products');
const customOrderRoutes = require('./routes/customOrder');
const cartRoutes = require('./routes/cart');
const checkoutRoutes = require('./routes/checkout');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for client requests from all origins (localhost, 127.0.0.1, file://, etc.)
app.use(cors({
    origin: true,
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
