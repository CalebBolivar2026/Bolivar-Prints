const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const productsFilePath = path.join(__dirname, '../data/products.json');
const uploadsProductsDir = path.join(__dirname, '../uploads/products');

// Ensure upload directory exists
if (!fs.existsSync(uploadsProductsDir)) {
    fs.mkdirSync(uploadsProductsDir, { recursive: true });
}

function getProducts() {
    try {
        const raw = fs.readFileSync(productsFilePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('Failed reading products file:', err);
        return [];
    }
}

function saveProducts(products) {
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), 'utf-8');
}

// Multer storage for product pictures
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsProductsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `prod-${Date.now()}-${cleanName}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max for photos
    fileFilter: (req, file, cb) => {
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExts.includes(ext) || file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPG, PNG, WebP, GIF, SVG) are allowed'));
        }
    },
});

// GET all products (with optional ?category= filter)
router.get('/', (req, res) => {
    let products = getProducts();
    const { category } = req.query;
    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }
    res.json({
        success: true,
        count: products.length,
        products,
    });
});

// GET single product by ID
router.get('/:id', (req, res) => {
    const products = getProducts();
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
        return res.status(404).json({
            success: false,
            error: 'Product not found',
        });
    }
    res.json({
        success: true,
        product,
    });
});

/**
 * POST /api/products/:id/image
 * Uploads or updates an image for an existing product.
 * Supports multipart file upload (field: "image") OR json body ({ "imageUrl": "..." }).
 */
router.post('/:id/image', upload.single('image'), (req, res) => {
    try {
        const products = getProducts();
        const index = products.findIndex(p => p.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        let newImageUrl = '';

        if (req.file) {
            // File was uploaded
            newImageUrl = `/uploads/products/${req.file.filename}`;
        } else if (req.body && req.body.imageUrl) {
            // URL or base64 was provided
            newImageUrl = req.body.imageUrl.trim();
        } else {
            return res.status(400).json({ success: false, error: 'No image file or imageUrl provided' });
        }

        products[index].image = newImageUrl;
        saveProducts(products);

        res.json({
            success: true,
            message: 'Product image updated successfully',
            product: products[index],
            imageUrl: newImageUrl,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/products
 * Creates a new product with optional image file upload.
 */
router.post('/', upload.single('image'), (req, res) => {
    try {
        const products = getProducts();
        const {
            name,
            price,
            category = 'decor',
            tag = 'Precision Print',
            icon = 'fa-cube',
            description = '',
            colors = 'Silk Gold, Matte Black',
            imageUrl = '',
        } = req.body;

        if (!name || !price) {
            return res.status(400).json({ success: false, error: 'Product name and price are required' });
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `product-${Date.now()}`;

        // Check if ID already exists
        if (products.some(p => p.id === id)) {
            return res.status(400).json({ success: false, error: 'A product with this name already exists' });
        }

        let finalImage = null;
        if (req.file) {
            finalImage = `/uploads/products/${req.file.filename}`;
        } else if (imageUrl && imageUrl.trim()) {
            finalImage = imageUrl.trim();
        }

        const parsedColors = Array.isArray(colors)
            ? colors
            : colors.split(',').map(c => c.trim()).filter(Boolean);

        const newProduct = {
            id,
            name: name.trim(),
            price: Number(parseFloat(price).toFixed(2)),
            category: category.trim().toLowerCase(),
            tag: tag.trim(),
            icon: icon.trim() || 'fa-cube',
            description: description.trim(),
            colors: parsedColors.length ? parsedColors : ['Standard'],
            image: finalImage,
            inStock: true,
            createdAt: new Date().toISOString(),
        };

        products.push(newProduct);
        saveProducts(products);

        res.json({
            success: true,
            message: 'Product created successfully',
            product: newProduct,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * PUT /api/products/:id
 * Updates product details or image.
 */
router.put('/:id', upload.single('image'), (req, res) => {
    try {
        const products = getProducts();
        const index = products.findIndex(p => p.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const existing = products[index];
        const { name, price, category, tag, description, colors, imageUrl, icon } = req.body;

        if (name) existing.name = name.trim();
        if (price !== undefined) existing.price = Number(parseFloat(price).toFixed(2));
        if (category) existing.category = category.trim().toLowerCase();
        if (tag) existing.tag = tag.trim();
        if (icon) existing.icon = icon.trim();
        if (description !== undefined) existing.description = description.trim();
        if (colors) {
            existing.colors = Array.isArray(colors) ? colors : colors.split(',').map(c => c.trim()).filter(Boolean);
        }

        if (req.file) {
            existing.image = `/uploads/products/${req.file.filename}`;
        } else if (imageUrl !== undefined) {
            existing.image = imageUrl ? imageUrl.trim() : null;
        }

        products[index] = existing;
        saveProducts(products);

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: existing,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/products/:id
 * Removes a product from the catalog.
 */
router.delete('/:id', (req, res) => {
    try {
        let products = getProducts();
        const initialLength = products.length;
        products = products.filter(p => p.id !== req.params.id);

        if (products.length === initialLength) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        saveProducts(products);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
