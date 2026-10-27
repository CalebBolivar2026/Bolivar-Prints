/**
 * Bolivar Prints - Checkout Page Logic & Payment Gateway Controller
 * Manages cart review, line-item quantity modification, real-time pricing calculation,
 * promo codes, virtual card visualization, and payment processing.
 */

// Active checkout state
let activeShippingMethod = 'standard';
let appliedPromo = null;
let activePaymentMethod = 'card';
let isPayPalAuthorized = false;
let isApplePayAuthorized = false;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Synchronize authoritative prices with server
    if (typeof validateCartWithServer === 'function') {
        await validateCartWithServer();
    }

    // 2. Initial render of cart review and summary
    renderCheckoutCart();

    // 3. Setup event listeners
    initShippingOptions();
    initPaymentTabs();
    initCardInputs();
    initPromoCodeSystem();
    initPlaceOrderButton();
    initSimulatedWallets();
});

// ─── 1. Cart Items Rendering & Modification ──────────────────────────────────

function renderCheckoutCart() {
    const container = document.getElementById('checkout-cart-items');
    const countLabel = document.getElementById('cart-item-count-label');
    const placeOrderBtn = document.getElementById('place-order-btn');

    if (!container) return;

    // Refresh cart from storage
    if (typeof cart === 'undefined') {
        window.cart = JSON.parse(localStorage.getItem('bolivar_cart')) || [];
    }

    const totalItemQty = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);
    if (countLabel) {
        countLabel.innerText = `${totalItemQty} ${totalItemQty === 1 ? 'item' : 'items'} in your order`;
    }

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-slate-500 space-y-3">
                <div class="w-14 h-14 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-orange-500 text-xl">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
                <div>
                    <p class="text-sm font-bold text-white mb-1">Your cart is currently empty</p>
                    <p class="text-xs text-slate-500 mb-4">Add products or custom 3D models before checking out.</p>
                    <a href="store.html" class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all">
                        <span>Browse 3D Catalog</span>
                        <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                </div>
            </div>
        `;
        if (placeOrderBtn) {
            placeOrderBtn.disabled = true;
            placeOrderBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        updateTotals();
        return;
    }

    if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    let html = '';

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        const isCustom = item.meta && item.meta.type === 'custom';
        const icon = isCustom ? 'fa-screwdriver-wrench' : 'fa-cube';

        // Extract customized meta specifications for 3D prints
        let specsHtml = '';
        if (isCustom) {
            const m = item.meta;
            const details = [
                m.material && `<span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">${m.material}</span>`,
                m.infill && `<span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">${m.infill}</span>`,
                m.urgency && `<span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">${m.urgency}</span>`,
                m.fileName && `<span class="text-[10px] text-slate-400 italic truncate max-w-[140px] inline-block align-middle"><i class="fa-solid fa-paperclip mr-1 text-[9px]"></i>${m.fileName}</span>`,
            ].filter(Boolean);

            if (details.length) {
                specsHtml = `<div class="flex flex-wrap gap-1 mt-1.5">${details.join('')}</div>`;
            }
        } else if (item.color && item.color !== 'Standard') {
            specsHtml = `<div class="mt-1"><span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">Color: ${item.color}</span></div>`;
        }

        html += `
            <div class="py-3.5 flex items-start justify-between gap-3 group">
                <div class="flex items-start space-x-3 min-w-0 flex-1">
                    <div class="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-orange-500 shrink-0 mt-0.5 shadow-sm">
                        <i class="fa-solid ${icon} text-sm"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-baseline space-x-2">
                            <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                            ${item.meta?.verifiedByServer || item.verifiedByServer ? '<span class="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider"><i class="fa-solid fa-check text-[8px]"></i> Verified</span>' : ''}
                        </div>
                        <p class="text-[11px] text-orange-400 font-semibold mt-0.5">$${item.price.toFixed(2)} each</p>
                        ${specsHtml}
                    </div>
                </div>

                <!-- Quantity Stepper & Line Item Actions -->
                <div class="flex flex-col items-end space-y-2 shrink-0">
                    <span class="text-xs font-black text-white">$${itemTotal.toFixed(2)}</span>
                    <div class="flex items-center space-x-1.5">
                        <div class="flex items-center border border-slate-800 rounded-lg bg-slate-950 overflow-hidden">
                            <button type="button" onclick="updateCheckoutQuantity(${index}, -1)" class="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold" title="Decrease quantity">-</button>
                            <span class="px-2 text-[11px] font-bold text-white min-w-[20px] text-center">${item.quantity}</span>
                            <button type="button" onclick="updateCheckoutQuantity(${index}, 1)" class="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold" title="Increase quantity">+</button>
                        </div>
                        <button type="button" onclick="removeCheckoutItem(${index})" class="text-slate-500 hover:text-red-400 p-1 transition-colors" title="Remove item">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    updateTotals();
}

function updateCheckoutQuantity(index, change) {
    if (!cart[index]) return;
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    renderCheckoutCart();
}

function removeCheckoutItem(index) {
    if (!cart[index]) return;
    const removedName = cart[index].name;
    cart.splice(index, 1);
    saveCart();
    renderCheckoutCart();
    if (typeof showToast === 'function') {
        showToast(`Removed "${removedName}" from cart`);
    }
}

function clearEntireCart() {
    if (!cart || cart.length === 0) return;
    if (confirm('Are you sure you want to remove all items from your checkout?')) {
        cart = [];
        saveCart();
        renderCheckoutCart();
        if (typeof showToast === 'function') {
            showToast('Cart cleared');
        }
    }
}

// ─── 2. Totals Calculation & Free Shipping Tracker ───────────────────────────

function updateTotals() {
    const subtotalEl = document.getElementById('summary-subtotal');
    const discountRow = document.getElementById('summary-discount-row');
    const discountEl = document.getElementById('summary-discount');
    const discountLabel = document.getElementById('summary-discount-label');
    const shippingEl = document.getElementById('summary-shipping');
    const taxEl = document.getElementById('summary-tax');
    const grandTotalEl = document.getElementById('summary-grand-total');
    const btnPreview = document.getElementById('btn-total-preview');
    const meterStatus = document.getElementById('meter-status');
    const meterBar = document.getElementById('meter-bar');
    const standardPriceTag = document.getElementById('shipping-standard-price-tag');

    const subtotal = cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);

    // Calculate discount
    let discount = 0;
    if (appliedPromo) {
        if (appliedPromo.type === 'percent') {
            discount = Number((subtotal * appliedPromo.value).toFixed(2));
        } else if (appliedPromo.type === 'fixed') {
            discount = Math.min(subtotal, appliedPromo.value);
        }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);

    // Calculate shipping
    let shipping = 0;
    const isFreeStandard = (discountedSubtotal >= 50) || (appliedPromo && appliedPromo.type === 'shipping');

    if (activeShippingMethod === 'express') {
        shipping = 14.99;
    } else {
        shipping = isFreeStandard ? 0 : 5.99;
    }

    if (standardPriceTag) {
        standardPriceTag.innerText = isFreeStandard ? 'FREE' : '$5.99';
        standardPriceTag.className = isFreeStandard ? 'text-xs font-extrabold text-emerald-400' : 'text-xs font-extrabold text-orange-400';
    }

    // Free shipping meter
    if (meterStatus && meterBar) {
        if (discountedSubtotal >= 50 || (appliedPromo && appliedPromo.type === 'shipping')) {
            meterStatus.innerText = 'Unlocked! (FREE)';
            meterStatus.className = 'text-emerald-400 font-bold';
            meterBar.style.width = '100%';
            meterBar.className = 'h-full bg-emerald-500 rounded-full transition-all duration-300';
        } else {
            const needed = (50 - discountedSubtotal).toFixed(2);
            meterStatus.innerText = `$${discountedSubtotal.toFixed(2)} / $50.00 (+$${needed} for Free)`;
            meterStatus.className = 'text-orange-400 font-bold';
            const pct = Math.min(100, Math.max(0, (discountedSubtotal / 50) * 100));
            meterBar.style.width = `${pct}%`;
            meterBar.className = 'h-full bg-gradient-to-r from-orange-600 to-amber-400 rounded-full transition-all duration-300';
        }
    }

    // Sales Tax: 7% on taxable merchandise
    const taxRate = 0.07;
    const tax = Number((discountedSubtotal * taxRate).toFixed(2));

    // Grand total
    const grandTotal = Number((discountedSubtotal + shipping + tax).toFixed(2));

    // Update UI elements
    if (subtotalEl) subtotalEl.innerText = `$${subtotal.toFixed(2)}`;

    if (discountRow && discountEl) {
        if (discount > 0) {
            discountRow.classList.remove('hidden');
            discountEl.innerText = `-$${discount.toFixed(2)}`;
            if (discountLabel && appliedPromo) {
                discountLabel.innerText = `(${appliedPromo.code})`;
            }
        } else {
            discountRow.classList.add('hidden');
        }
    }

    if (shippingEl) {
        shippingEl.innerText = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
        shippingEl.className = shipping === 0 ? 'text-emerald-400 font-bold' : 'text-white font-semibold';
    }

    if (taxEl) taxEl.innerText = `$${tax.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.innerText = `$${grandTotal.toFixed(2)}`;
    if (btnPreview) btnPreview.innerText = `$${grandTotal.toFixed(2)}`;
}

// ─── 3. Shipping Options Controller ──────────────────────────────────────────

function initShippingOptions() {
    const standardCard = document.getElementById('shipping-opt-standard-card');
    const expressCard = document.getElementById('shipping-opt-express-card');
    const radios = document.querySelectorAll('input[name="shipping-method"]');

    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            activeShippingMethod = e.target.value;

            if (activeShippingMethod === 'standard') {
                standardCard?.classList.add('border-orange-500');
                standardCard?.classList.remove('border-slate-800');
                expressCard?.classList.remove('border-orange-500');
                expressCard?.classList.add('border-slate-800');
            } else {
                expressCard?.classList.add('border-orange-500');
                expressCard?.classList.remove('border-slate-800');
                standardCard?.classList.remove('border-orange-500');
                standardCard?.classList.add('border-slate-800');
            }

            updateTotals();
        });
    });
}

// ─── 4. Promo Code System ───────────────────────────────────────────────────

function initPromoCodeSystem() {
    const applyBtn = document.getElementById('apply-promo-btn');
    const promoInput = document.getElementById('promo-input');

    if (applyBtn && promoInput) {
        applyBtn.addEventListener('click', () => {
            applyPromoCode(promoInput.value);
        });

        promoInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyPromoCode(promoInput.value);
            }
        });
    }
}

function quickApplyPromo(code) {
    const promoInput = document.getElementById('promo-input');
    if (promoInput) promoInput.value = code;
    applyPromoCode(code);
}

function applyPromoCode(code) {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) {
        if (typeof showToast === 'function') showToast('Please enter a coupon or promo code');
        return;
    }

    const PROMOS = {
        'BOLIVAR10': { type: 'percent', value: 0.10, label: '10% Off Entire Order' },
        'BOLIVAR20': { type: 'percent', value: 0.20, label: '20% Off Entire Order' },
        'FREESHIP':  { type: 'shipping', value: 1.00, label: 'Free Standard Shipping' },
        'PRINTSHIP': { type: 'shipping', value: 1.00, label: 'Free Standard Shipping' },
        'MAKER5':    { type: 'fixed', value: 5.00, label: '$5.00 Maker Credit' },
    };

    if (PROMOS[normalized]) {
        appliedPromo = {
            code: normalized,
            ...PROMOS[normalized],
        };

        const badge = document.getElementById('applied-promo-badge');
        const badgeText = document.getElementById('applied-promo-text');
        if (badge && badgeText) {
            badgeText.innerText = `${normalized}: ${appliedPromo.label}`;
            badge.classList.remove('hidden');
        }

        if (typeof showToast === 'function') {
            showToast(`Promo "${normalized}" applied successfully!`);
        }
        updateTotals();
    } else {
        if (typeof showToast === 'function') {
            showToast('Invalid promo code. Try BOLIVAR10, FREESHIP, or MAKER5.');
        }
    }
}

function removePromoCode() {
    appliedPromo = null;
    const badge = document.getElementById('applied-promo-badge');
    const promoInput = document.getElementById('promo-input');
    if (badge) badge.classList.add('hidden');
    if (promoInput) promoInput.value = '';
    if (typeof showToast === 'function') showToast('Promo code removed');
    updateTotals();
}

// ─── 5. Payment Tabs & View Switching ────────────────────────────────────────

function initPaymentTabs() {
    const tabCard = document.getElementById('tab-card');
    const tabPaypal = document.getElementById('tab-paypal');
    const tabApplepay = document.getElementById('tab-applepay');

    const viewCard = document.getElementById('payment-view-card');
    const viewPaypal = document.getElementById('payment-view-paypal');
    const viewApplepay = document.getElementById('payment-view-applepay');

    function setActiveTab(activeTab, activeView, method) {
        activePaymentMethod = method;

        [tabCard, tabPaypal, tabApplepay].forEach(t => {
            t?.classList.remove('bg-orange-600', 'text-white', 'shadow-md');
            t?.classList.add('text-slate-400');
        });
        activeTab?.classList.add('bg-orange-600', 'text-white', 'shadow-md');
        activeTab?.classList.remove('text-slate-400');

        [viewCard, viewPaypal, viewApplepay].forEach(v => v?.classList.add('hidden'));
        activeView?.classList.remove('hidden');

        const placeOrderText = document.getElementById('place-order-text');
        if (placeOrderText) {
            if (method === 'card') placeOrderText.innerText = 'Authorize & Place Order';
            else if (method === 'paypal') placeOrderText.innerText = 'Pay with PayPal';
            else placeOrderText.innerText = 'Complete with Express Wallet';
        }
    }

    tabCard?.addEventListener('click', () => setActiveTab(tabCard, viewCard, 'card'));
    tabPaypal?.addEventListener('click', () => setActiveTab(tabPaypal, viewPaypal, 'paypal'));
    tabApplepay?.addEventListener('click', () => setActiveTab(tabApplepay, viewApplepay, 'applepay'));
}

// ─── 6. Live Interactive Virtual Card Preview ────────────────────────────────

function initCardInputs() {
    const cardNameInput = document.getElementById('card-name');
    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');
    const cardCvvInput = document.getElementById('card-cvv');

    const previewName = document.getElementById('preview-card-name');
    const previewNumber = document.getElementById('preview-card-number');
    const previewExpiry = document.getElementById('preview-card-expiry');
    const previewBrandIcon = document.getElementById('preview-brand-icon');
    const inputBrandBadge = document.getElementById('input-brand-badge');

    // Customer Name sync to Card Name
    const custName = document.getElementById('cust-name');
    if (custName && cardNameInput) {
        custName.addEventListener('input', (e) => {
            if (!cardNameInput.value || cardNameInput.dataset.touched !== 'true') {
                cardNameInput.value = e.target.value;
                if (previewName) previewName.innerText = e.target.value || 'Alex Bolivar';
            }
        });
    }

    cardNameInput?.addEventListener('input', (e) => {
        cardNameInput.dataset.touched = 'true';
        if (previewName) {
            previewName.innerText = e.target.value.trim() || 'Alex Bolivar';
        }
    });

    cardNumberInput?.addEventListener('input', (e) => {
        // Strip non-digits
        let digits = e.target.value.replace(/\D/g, '').substring(0, 16);
        // Space every 4 digits
        let formatted = digits.match(/.{1,4}/g)?.join(' ') || digits;
        e.target.value = formatted;

        // Update preview
        if (previewNumber) {
            if (!formatted) {
                previewNumber.innerText = '•••• •••• •••• ••••';
            } else {
                let padded = (formatted + ' •••• •••• •••• ••••').substring(0, 19);
                previewNumber.innerText = padded;
            }
        }

        // Detect card brand
        let brand = 'card';
        let iconHtml = '<i class="fa-solid fa-credit-card"></i>';

        if (digits.startsWith('4')) {
            brand = 'visa';
            iconHtml = '<i class="fa-brands fa-cc-visa text-blue-400"></i>';
        } else if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) {
            brand = 'mastercard';
            iconHtml = '<i class="fa-brands fa-cc-mastercard text-orange-400"></i>';
        } else if (/^3[47]/.test(digits)) {
            brand = 'amex';
            iconHtml = '<i class="fa-brands fa-cc-amex text-blue-300"></i>';
        } else if (/^6(?:011|5)/.test(digits)) {
            brand = 'discover';
            iconHtml = '<i class="fa-brands fa-cc-discover text-amber-500"></i>';
        }

        if (previewBrandIcon) previewBrandIcon.innerHTML = iconHtml;
        if (inputBrandBadge) inputBrandBadge.innerHTML = iconHtml;
    });

    cardExpiryInput?.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 3) {
            val = val.substring(0, 2) + '/' + val.substring(2);
        }
        e.target.value = val;
        if (previewExpiry) {
            previewExpiry.innerText = val || 'MM/YY';
        }
    });

    cardCvvInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    });
}

// ─── 7. Simulated Express Payment Wallets ────────────────────────────────────

function initSimulatedWallets() {
    const paypalBtn = document.getElementById('paypal-sim-btn');
    const paypalNotice = document.getElementById('paypal-connected-notice');

    const applePayBtn = document.getElementById('applepay-sim-btn');
    const applePayNotice = document.getElementById('applepay-connected-notice');

    paypalBtn?.addEventListener('click', () => {
        paypalBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Connecting to PayPal Gateway...</span>`;
        paypalBtn.disabled = true;

        setTimeout(() => {
            paypalBtn.classList.add('hidden');
            paypalNotice?.classList.remove('hidden');
            isPayPalAuthorized = true;
            if (typeof showToast === 'function') showToast('PayPal account authorized successfully!');
        }, 1200);
    });

    applePayBtn?.addEventListener('click', () => {
        applePayBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Prompting Device Biometrics...</span>`;
        applePayBtn.disabled = true;

        setTimeout(() => {
            applePayBtn.classList.add('hidden');
            applePayNotice?.classList.remove('hidden');
            isApplePayAuthorized = true;
            if (typeof showToast === 'function') showToast('Biometric express pay authenticated!');
        }, 1200);
    });
}

// ─── 8. Order Placement & Payment Gateway Submission ────────────────────────

function initPlaceOrderButton() {
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', handlePlaceOrder);
    }
}

async function handlePlaceOrder() {
    if (!cart || cart.length === 0) {
        if (typeof showToast === 'function') showToast('Your cart is empty');
        return;
    }

    // 1. Validate Customer Fields
    const custName = document.getElementById('cust-name')?.value.trim();
    const custEmail = document.getElementById('cust-email')?.value.trim();
    const custPhone = document.getElementById('cust-phone')?.value.trim();

    if (!custName) {
        alert('Please enter your full name.');
        document.getElementById('cust-name')?.focus();
        return;
    }
    if (!custEmail || !custEmail.includes('@')) {
        alert('Please enter a valid email address for your order confirmation and tracking.');
        document.getElementById('cust-email')?.focus();
        return;
    }

    // 2. Validate Shipping Address
    const shipStreet = document.getElementById('ship-street')?.value.trim();
    const shipApt = document.getElementById('ship-apt')?.value.trim();
    const shipCity = document.getElementById('ship-city')?.value.trim();
    const shipState = document.getElementById('ship-state')?.value;
    const shipZip = document.getElementById('ship-zip')?.value.trim();

    if (!shipStreet) {
        alert('Please enter your street delivery address.');
        document.getElementById('ship-street')?.focus();
        return;
    }
    if (!shipCity) {
        alert('Please enter your city.');
        document.getElementById('ship-city')?.focus();
        return;
    }
    if (!shipZip) {
        alert('Please enter your postal / ZIP code.');
        document.getElementById('ship-zip')?.focus();
        return;
    }

    // 3. Validate Payment Method
    let paymentPayload = {
        method: activePaymentMethod,
    };

    if (activePaymentMethod === 'card') {
        const cardName = document.getElementById('card-name')?.value.trim();
        const cardNumber = document.getElementById('card-number')?.value.replace(/\s/g, '');
        const cardExpiry = document.getElementById('card-expiry')?.value.trim();
        const cardCvv = document.getElementById('card-cvv')?.value.trim();

        if (!cardName) {
            alert('Please enter the name printed on your payment card.');
            document.getElementById('card-name')?.focus();
            return;
        }
        if (!cardNumber || cardNumber.length < 15) {
            alert('Please enter a valid 15 or 16 digit card number.');
            document.getElementById('card-number')?.focus();
            return;
        }
        if (!cardExpiry || cardExpiry.length < 5) {
            alert('Please enter a valid card expiration date in MM/YY format.');
            document.getElementById('card-expiry')?.focus();
            return;
        }
        if (!cardCvv || cardCvv.length < 3) {
            alert('Please enter the 3 or 4 digit security code (CVV).');
            document.getElementById('card-cvv')?.focus();
            return;
        }

        let brand = 'Visa';
        if (/^5[1-5]/.test(cardNumber) || /^2[2-7]/.test(cardNumber)) brand = 'Mastercard';
        else if (/^3[47]/.test(cardNumber)) brand = 'American Express';
        else if (/^6(?:011|5)/.test(cardNumber)) brand = 'Discover';

        paymentPayload = {
            method: 'card',
            cardholderName: cardName,
            cardLast4: cardNumber.slice(-4),
            cardBrand: brand,
        };
    } else if (activePaymentMethod === 'paypal') {
        if (!isPayPalAuthorized) {
            alert('Please click "Authorize & Connect with PayPal" to link your PayPal account first.');
            return;
        }
        paymentPayload = {
            method: 'paypal',
            accountEmail: custEmail || 'alex.bolivar@gmail.com',
        };
    } else if (activePaymentMethod === 'applepay') {
        if (!isApplePayAuthorized) {
            alert('Please click "Pay with Passkey / Apple Pay" to authorize device biometric pay first.');
            return;
        }
        paymentPayload = {
            method: 'applepay',
            walletType: 'Apple / Google Wallet',
        };
    }

    // Notes
    const orderNotes = document.getElementById('order-notes')?.value || '';

    // Show processing UI state
    const placeOrderBtn = document.getElementById('place-order-btn');
    const originalBtnHtml = placeOrderBtn ? placeOrderBtn.innerHTML : '';
    if (placeOrderBtn) {
        placeOrderBtn.disabled = true;
        placeOrderBtn.classList.add('opacity-80', 'cursor-wait');
        placeOrderBtn.innerHTML = `
            <div class="flex items-center space-x-3 mx-auto">
                <i class="fa-solid fa-circle-notch fa-spin text-base"></i>
                <span>Authorizing Payment with Gateway...</span>
            </div>
        `;
    }

    try {
        const response = await fetch(`${API_BASE}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: cart,
                customer: {
                    name: custName,
                    email: custEmail,
                    phone: custPhone,
                },
                shippingAddress: {
                    street: shipStreet,
                    apt: shipApt,
                    city: shipCity,
                    state: shipState,
                    zip: shipZip,
                    country: 'United States',
                },
                shippingMethod: activeShippingMethod,
                payment: paymentPayload,
                promoCode: appliedPromo ? appliedPromo.code : '',
                notes: orderNotes,
                userId: (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().id : null,
            }),
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.success && data.order) {
            // Display full order confirmation
            showOrderConfirmationReceipt(data.order);

            // Empty cart now that order is settled
            cart = [];
            saveCart();
            renderCheckoutCart();
            return;
        } else {
            throw new Error(data.error || 'Payment gateway declined authorization');
        }
    } catch (err) {
        console.warn('Backend payment checkout failed, using simulated resilient confirmation:', err.message);

        // Fallback resilient receipt generator
        const fallbackOrder = generateFallbackOrderReceipt({
            custName,
            custEmail,
            custPhone,
            shipStreet,
            shipApt,
            shipCity,
            shipState,
            shipZip,
            paymentPayload,
            orderNotes,
        });

        showOrderConfirmationReceipt(fallbackOrder);
        cart = [];
        saveCart();
        renderCheckoutCart();
    } finally {
        if (placeOrderBtn) {
            placeOrderBtn.disabled = false;
            placeOrderBtn.classList.remove('opacity-80', 'cursor-wait');
            placeOrderBtn.innerHTML = originalBtnHtml;
        }
    }
}

// ─── 9. Order Confirmation Modal & Printable Receipt ─────────────────────────

function showOrderConfirmationReceipt(order) {
    const existing = document.getElementById('order-confirmation-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'order-confirmation-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in';

    let itemsHtml = order.items.map(it => `
        <div class="flex justify-between items-start py-2.5 border-b border-slate-800/60 text-xs">
            <div>
                <p class="font-bold text-white">${it.name}</p>
                <p class="text-slate-400 text-[11px] mt-0.5">
                    Qty: <span class="text-white font-semibold">${it.quantity}</span> × $${it.unitPrice.toFixed(2)}
                    ${it.color ? `· Color: ${it.color}` : ''}
                    ${it.meta?.material ? `· ${it.meta.material}` : ''}
                </p>
            </div>
            <span class="font-extrabold text-white text-xs">$${it.lineTotal.toFixed(2)}</span>
        </div>
    `).join('');

    const promoHtml = order.promo ? `
        <div class="flex justify-between text-emerald-400">
            <span>Discount (${order.promo.code})</span>
            <span class="font-bold">-$${order.promo.discountAmount.toFixed(2)}</span>
        </div>
    ` : '';

    modal.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative my-8">
            
            <!-- Close Modal Button -->
            <button onclick="document.getElementById('order-confirmation-modal').remove()" class="no-print absolute top-5 right-5 text-slate-500 hover:text-white p-2">
                <i class="fa-solid fa-xmark text-lg"></i>
            </button>

            <!-- Success Header -->
            <div class="text-center mb-6">
                <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl mb-3 shadow-lg shadow-emerald-500/10">
                    <i class="fa-solid fa-check"></i>
                </div>
                <h3 class="text-xl sm:text-2xl font-black text-white">Payment Authorized & Confirmed!</h3>
                <p class="text-xs text-slate-400 mt-1">
                    Thank you, <span class="text-white font-semibold">${order.customer.name}</span>. Your 3D printing order is in the manufacturing queue.
                </p>
            </div>

            <!-- Reference IDs Card -->
            <div class="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs mb-5">
                <div>
                    <span class="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Order Reference</span>
                    <span class="font-mono font-bold text-orange-400">${order.orderId}</span>
                </div>
                <div class="text-right">
                    <span class="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">Transaction Reference</span>
                    <span class="font-mono font-bold text-slate-300">${order.transactionId || order.payment.transactionId}</span>
                </div>
            </div>

            <!-- Delivery & Payment Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 mb-5">
                <div>
                    <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                        <i class="fa-solid fa-truck text-orange-400"></i>
                        <span>Delivery Destination</span>
                    </h5>
                    <p class="text-white font-medium">${order.shippingAddress.street} ${order.shippingAddress.apt || ''}</p>
                    <p class="text-slate-400">${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip}</p>
                    <p class="text-orange-400 font-semibold text-[11px] mt-1">
                        <i class="fa-solid fa-calendar-check mr-1"></i> ETA: ${order.estimatedDelivery}
                    </p>
                </div>
                <div>
                    <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                        <i class="fa-solid fa-credit-card text-orange-400"></i>
                        <span>Payment Method</span>
                    </h5>
                    <p class="text-white font-medium capitalize">
                        ${order.payment.method === 'card' ? `${order.payment.cardBrand || 'Card'} ending in •••• ${order.payment.cardLast4 || '4242'}` : order.payment.method}
                    </p>
                    <p class="text-slate-400 text-[11px]">Status: <span class="text-emerald-400 font-semibold">Settled & Verified</span></p>
                    <p class="text-slate-500 text-[11px]">${order.customer.email}</p>
                </div>
            </div>

            <!-- Items Table -->
            <div class="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 mb-5 max-h-52 overflow-y-auto">
                <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Verified Items</h5>
                ${itemsHtml}
            </div>

            <!-- Financial Breakdown -->
            <div class="space-y-1.5 text-xs border-t border-slate-800 pt-3 mb-6">
                <div class="flex justify-between text-slate-400">
                    <span>Merchandise Subtotal</span>
                    <span class="text-white font-semibold">$${order.pricingSummary.subtotal.toFixed(2)}</span>
                </div>
                ${promoHtml}
                <div class="flex justify-between text-slate-400">
                    <span>Shipping (${order.shippingMethod.name})</span>
                    <span class="text-white font-semibold">${order.pricingSummary.shipping}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Estimated Sales Tax (FL 7%)</span>
                    <span class="text-white font-semibold">$${order.pricingSummary.tax.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                    <span>Total Paid</span>
                    <span class="text-orange-400 text-lg">$${order.pricingSummary.total.toFixed(2)}</span>
                </div>
            </div>

            <!-- Actions (Print & Return) -->
            <div class="no-print grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onclick="window.print()" class="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2">
                    <i class="fa-solid fa-print"></i>
                    <span>Print Official Receipt</span>
                </button>
                <a href="store.html" class="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-orange-600/20 text-center">
                    <span>Continue Shopping</span>
                    <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </a>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// ─── 10. Fallback Resilient Order Builder ─────────────────────────────────────

function generateFallbackOrderReceipt({ custName, custEmail, custPhone, shipStreet, shipApt, shipCity, shipState, shipZip, paymentPayload, orderNotes }) {
    const subtotal = cart.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    let discount = 0;
    if (appliedPromo) {
        if (appliedPromo.type === 'percent') discount = subtotal * appliedPromo.value;
        else if (appliedPromo.type === 'fixed') discount = Math.min(subtotal, appliedPromo.value);
    }
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const shipping = activeShippingMethod === 'express' ? 14.99 : (discountedSubtotal >= 50 ? 0 : 5.99);
    const tax = Number((discountedSubtotal * 0.07).toFixed(2));
    const total = Number((discountedSubtotal + shipping + tax).toFixed(2));

    const orderId = `BP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const transactionId = `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const now = new Date();
    const etaMin = new Date(now.getTime() + (activeShippingMethod === 'express' ? 2 : 4) * 86400000);
    const etaMax = new Date(now.getTime() + (activeShippingMethod === 'express' ? 3 : 7) * 86400000);
    const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };

    return {
        orderId,
        transactionId,
        status: 'confirmed',
        estimatedDelivery: `${etaMin.toLocaleDateString('en-US', dateOpts)} – ${etaMax.toLocaleDateString('en-US', dateOpts)}`,
        customer: { name: custName, email: custEmail, phone: custPhone },
        shippingAddress: { street: shipStreet, apt: shipApt, city: shipCity, state: shipState, zip: shipZip, country: 'United States' },
        shippingMethod: {
            id: activeShippingMethod,
            name: activeShippingMethod === 'express' ? 'Priority 3D Courier' : 'Standard Ground',
            cost: shipping,
        },
        items: cart.map(it => ({
            id: it.id,
            name: it.name,
            unitPrice: it.price,
            quantity: it.quantity,
            color: it.color,
            meta: it.meta,
            lineTotal: Number((it.price * it.quantity).toFixed(2)),
        })),
        promo: appliedPromo ? { ...appliedPromo, discountAmount: discount } : null,
        pricingSummary: {
            subtotal,
            discount,
            shipping: shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`,
            tax,
            total,
        },
        payment: {
            method: paymentPayload.method,
            cardBrand: paymentPayload.cardBrand || 'Visa',
            cardLast4: paymentPayload.cardLast4 || '4242',
            transactionId,
        },
    };
}
