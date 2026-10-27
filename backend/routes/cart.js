const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { calculateCustomOrderPrice } = require('../config/pricing');

const productsFilePath = path.join(__dirname, '../data/products.json');

function getProducts() {
    try {
        return JSON.parse(fs.readFileSync(productsFilePath, 'utf-8'));
    } catch {
        return [];
    }
}

/**
 * POST /api/cart/validate
 * Validates and sanitizes client cart items against server database.
 * Completely overrides any price tampering performed on client/localStorage.
 */
router.post('/validate', (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'Expected items array' });
        }

        const products = getProducts();
        let wasTampered = false;
        let tamperedCount = 0;
        let sanitizedItems = [];
        let subtotal = 0;

        items.forEach((item, index) => {
            const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
            const isCustom = item.meta && item.meta.type === 'custom';

            if (isCustom) {
                // Custom 3D print line item: recalculate using secure backend pricing rules
                const m = item.meta;
                const rec = calculateCustomOrderPrice({
                    material: m.material,
                    infill: m.infill?.includes('Solid') ? 'solid' : (m.infill?.includes('Sturdy') ? 'sturdy' : 'standard'),
                    urgency: m.urgency?.toLowerCase() === 'rush' ? 'rush' : 'standard',
                    postProcessing: m.postProcessing || [],
                    quantity: qty,
                });

                const clientPrice = Number(item.price);
                if (Math.abs(clientPrice - rec.unitPrice) > 0.01) {
                    wasTampered = true;
                    tamperedCount++;
                }

                const itemTotal = rec.unitPrice * qty;
                subtotal += itemTotal;

                sanitizedItems.push({
                    ...item,
                    price: rec.unitPrice,
                    quantity: qty,
                    meta: {
                        ...item.meta,
                        estimatedUnitPrice: rec.unitPrice,
                        estimatedTotal: itemTotal,
                        verifiedByServer: true,
                    },
                });
            } else {
                // Standard catalog item: look up in authoritative products.json
                const catalogProduct = products.find(p => p.id === item.id);
        // Validate selected color against product's available colors
        let selectedColor = item.color || (catalogProduct.colors && catalogProduct.colors[0]) || 'Standard';
        if (catalogProduct.colors && !catalogProduct.colors.includes(selectedColor)) {
            // Color not valid – revert to first available and flag tampering
            wasTampered = true;
            tamperedCount++;
            selectedColor = catalogProduct.colors[0] || 'Standard';
        }
                if (!catalogProduct) {
                    // Item doesn't exist in catalog
                    wasTampered = true;
                    tamperedCount++;
                    return; // drop invalid items
                }

                const clientPrice = Number(item.price);
                if (Math.abs(clientPrice - catalogProduct.price) > 0.01) {
                    wasTampered = true;
                    tamperedCount++;
                }

                const realPrice = catalogProduct.price;
                subtotal += realPrice * qty;

                sanitizedItems.push({
                    id: catalogProduct.id,
                    name: catalogProduct.name,
                    price: realPrice,
                    color: selectedColor,

                    image: catalogProduct.image || null,
                    quantity: qty,
                    verifiedByServer: true,
                });
            }
        });

        subtotal = Number(subtotal.toFixed(2));
        const totalItems = sanitizedItems.reduce((sum, item) => sum + item.quantity, 0);

        res.json({
            success: true,
            tampered: wasTampered,
            tamperedCount,
            items: sanitizedItems,
            subtotal,
            totalItems,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
