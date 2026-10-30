/**
 * Bolivar Prints - Cart Routes
 *
 * The cart lives in the client's localStorage — it is inherently isolated
 * per browser session. This route validates and sanitizes cart items
 * server-side to prevent price tampering.
 *
 * optionalAuth is applied so that:
 *   - Unauthenticated (guest) shoppers can still validate carts.
 *   - Authenticated users get req.user populated, enabling future
 *     server-side cart persistence keyed to their user ID.
 */

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');

const { optionalAuth } = require('../middleware/auth');
const { calculateCustomOrderPrice } = require('../config/pricing');

const productsFilePath = path.join(__dirname, '../data/products.json');

function getProducts() {
    try { return JSON.parse(fs.readFileSync(productsFilePath, 'utf-8')); }
    catch { return []; }
}

/**
 * POST /api/cart/validate
 *
 * Validates and sanitizes client cart items against the server catalog.
 * Completely overrides any price tampering performed on the client.
 *
 * Accepts an optional Authorization header — if valid, req.user is set
 * (enables future server-side cart persistence tied to that user_id).
 * Guest shoppers without a token are handled identically.
 */
router.post('/validate', optionalAuth, (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'Expected items array' });
        }

        const products       = getProducts();
        let wasTampered      = false;
        let tamperedCount    = 0;
        let sanitizedItems   = [];
        let subtotal         = 0;

        items.forEach((item) => {
            const qty      = Math.max(1, parseInt(item.quantity, 10) || 1);
            const isCustom = item.meta && item.meta.type === 'custom';

            if (isCustom) {
                // Custom 3D print: recalculate using secure backend pricing rules
                const m   = item.meta;
                const rec = calculateCustomOrderPrice({
                    material:       m.material,
                    infill:         m.infill?.includes('Solid') ? 'solid' : (m.infill?.includes('Sturdy') ? 'sturdy' : 'standard'),
                    urgency:        m.urgency?.toLowerCase() === 'rush' ? 'rush' : 'standard',
                    postProcessing: m.postProcessing || [],
                    quantity:       qty,
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
                    price:    rec.unitPrice,
                    quantity: qty,
                    meta: {
                        ...item.meta,
                        estimatedUnitPrice: rec.unitPrice,
                        estimatedTotal:     itemTotal,
                        verifiedByServer:   true,
                    },
                });

            } else {
                // Standard catalog item: validate against authoritative products.json
                const catalogProduct = products.find(p => p.id === item.id);

                if (!catalogProduct) {
                    wasTampered = true;
                    tamperedCount++;
                    return; // drop invalid items
                }

                // Validate selected color against product's available colors
                let selectedColor = item.color || (catalogProduct.colors && catalogProduct.colors[0]) || 'Standard';
                if (catalogProduct.colors && !catalogProduct.colors.includes(selectedColor)) {
                    wasTampered = true;
                    tamperedCount++;
                    selectedColor = catalogProduct.colors[0] || 'Standard';
                }

                const clientPrice = Number(item.price);
                if (Math.abs(clientPrice - catalogProduct.price) > 0.01) {
                    wasTampered = true;
                    tamperedCount++;
                }

                const realPrice = catalogProduct.price;
                subtotal += realPrice * qty;

                sanitizedItems.push({
                    id:               catalogProduct.id,
                    name:             catalogProduct.name,
                    price:            realPrice,
                    color:            selectedColor,
                    image:            catalogProduct.image || null,
                    quantity:         qty,
                    verifiedByServer: true,
                });
            }
        });

        subtotal     = Number(subtotal.toFixed(2));
        const totalItems = sanitizedItems.reduce((sum, item) => sum + item.quantity, 0);

        res.json({
            success:       true,
            tampered:      wasTampered,
            tamperedCount,
            items:         sanitizedItems,
            subtotal,
            totalItems,
            // Return user identity if authenticated, so the client can confirm
            // whose session the validated cart belongs to.
            userId: req.user ? req.user.id : null,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
