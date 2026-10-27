const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { calculateCustomOrderPrice, PRICING_CONFIG } = require('../config/pricing');

// Configure multer storage for 3D model files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, uniqueSuffix + '-' + cleanName);
    },
});

const ALLOWED_EXTS = ['.stl', '.step', '.stp', '.obj', '.3mf', '.zip', '.rar', '.7z', '.png', '.jpg', '.jpeg', '.pdf', '.blend', '.dxf', '.svg', '.txt'];

const fileFilter = (req, file, cb) => {
    // Accept all customer design, 3D model, and blueprint reference files
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// GET pricing configuration reference
router.get('/pricing-rules', (req, res) => {
    res.json({
        success: true,
        pricing: PRICING_CONFIG,
    });
});

// POST calculate estimate securely on server
router.post('/estimate', (req, res) => {
    try {
        const { material, infill, urgency, postProcessing, quantity } = req.body;
        const estimate = calculateCustomOrderPrice({
            material,
            infill,
            urgency,
            postProcessing,
            quantity,
        });

        res.json({
            success: true,
            estimate,
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message,
        });
    }
});

// POST submit custom order with file upload and generate verified cart item
router.post('/quote', upload.array('modelFiles', 5), (req, res) => {
    try {
        const {
            material = 'PLA+',
            infill = 'standard',
            urgency = 'standard',
            color = 'Any',
            postProcessing: rawPostProcessing,
            quantity = 1,
            instructions = '',
        } = req.body;

        let postProcessing = [];
        if (typeof rawPostProcessing === 'string') {
            try {
                postProcessing = JSON.parse(rawPostProcessing);
            } catch {
                postProcessing = [rawPostProcessing];
            }
        } else if (Array.isArray(rawPostProcessing)) {
            postProcessing = rawPostProcessing;
        }

        const estimate = calculateCustomOrderPrice({
            material,
            infill,
            urgency,
            postProcessing,
            quantity,
        });

        const fileNames = req.files && req.files.length > 0
            ? req.files.map(f => f.originalname).join(', ')
            : 'No file attached';

        const uploadedFilePaths = req.files ? req.files.map(f => f.filename) : [];

        const infillLabels = {
            standard: 'Standard (15–20%)',
            sturdy: 'Sturdy (30–40%)',
            solid: 'Solid (80–100%)',
        };

        const uniqueId = `custom_${Date.now()}`;
        const itemName = `Custom Print — ${material} / ${color || 'Any'}`;

        const verifiedCartItem = {
            id: uniqueId,
            name: itemName,
            price: estimate.unitPrice,
            image: null,
            color: color || 'Any',
            quantity: estimate.quantity,
            meta: {
                type: 'custom',
                fileName: fileNames,
                storedFiles: uploadedFilePaths,
                material,
                color: color || 'Any',
                infill: infillLabels[infill] || infill,
                urgency: urgency === 'rush' ? 'Rush' : 'Standard',
                postProcessing: postProcessing.length > 0 ? postProcessing : ['Raw Print'],
                estimatedUnitPrice: estimate.unitPrice,
                estimatedTotal: estimate.totalPrice,
                instructions,
                verifiedByServer: true,
            },
        };

        res.json({
            success: true,
            cartItem: verifiedCartItem,
            breakdown: estimate,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
        });
    }
});

module.exports = router;
