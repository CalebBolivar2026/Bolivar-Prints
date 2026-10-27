/**
 * Bolivar Prints - Secure Pricing Engine
 * Authoritative pricing configuration running strictly on the backend.
 * Prevents client-side price manipulation.
 */

const PRICING_CONFIG = {
    // Base unit price by material
    materials: {
        'PLA+':     12.00,
        'PETG':     15.00,
        'Silk PLA': 18.00,
        'ABS':      16.00,
        'TPU':      20.00,
        'Carbon Fiber': 28.00,
        'Not Sure': 12.00,
    },
    // Infill density multipliers
    infill: {
        'standard': 1.0,   // 15–20%
        'sturdy':   1.25,  // 30–40%
        'solid':    1.55,  // 80–100%
    },
    // Turnaround urgency multipliers
    urgency: {
        'standard': 1.0,
        'rush':     1.30,
    },
    // Post-processing flat add-on per unit
    postProcessing: {
        'Raw Print': 0.00,
        'Support Removal': 3.00,
        'Sanding & Polish': 6.00,
        'Sanding & Smoothing': 6.00,
    },
};

/**
 * Server-authoritative custom order price calculation
 */
function calculateCustomOrderPrice({
    material = 'PLA+',
    infill = 'standard',
    urgency = 'standard',
    postProcessing = [],
    quantity = 1,
}) {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const basePrice = PRICING_CONFIG.materials[material] ?? PRICING_CONFIG.materials['PLA+'];
    const infillMult = PRICING_CONFIG.infill[infill] ?? 1.0;
    const urgencyMult = PRICING_CONFIG.urgency[urgency] ?? 1.0;

    let ppCost = 0;
    if (Array.isArray(postProcessing)) {
        postProcessing.forEach(pp => {
            if (PRICING_CONFIG.postProcessing[pp] !== undefined) {
                ppCost += PRICING_CONFIG.postProcessing[pp];
            }
        });
    }

    const unitPrice = Number(((basePrice * infillMult * urgencyMult) + ppCost).toFixed(2));
    const totalPrice = Number((unitPrice * qty).toFixed(2));

    return {
        basePrice,
        infillMult,
        urgencyMult,
        ppCost,
        unitPrice,
        totalPrice,
        quantity: qty,
    };
}

module.exports = {
    PRICING_CONFIG,
    calculateCustomOrderPrice,
};
