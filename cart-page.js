/**
 * Bolivar Prints - Full Cart Page Script
 * Renders line items, custom print specifications, quantity updates,
 * and handles server-verified checkout.
 */

async function initCartPage() {
    if (typeof validateCartWithServer === 'function') {
        await validateCartWithServer();
    }
    renderFullCartPage();
}

function renderFullCartPage() {
    const container = document.getElementById('full-cart-items');
    const subtotalEl = document.getElementById('summary-subtotal');
    const totalEl = document.getElementById('summary-total');
    
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 space-y-4">
                <div class="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-orange-500 text-2xl">
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
                <div>
                    <p class="text-base font-semibold text-white mb-1">Your cart is empty</p>
                    <p class="text-xs text-slate-500 mb-6">Explore our store catalog or submit a custom print quote.</p>
                    <a href="store.html" class="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all">
                        <span>Browse Store</span>
                        <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                </div>
            </div>
        `;
        if (subtotalEl) subtotalEl.innerText = '$0.00';
        if (totalEl) totalEl.innerText = '$0.00';
        return;
    }

    let html = '';
    let subtotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const isCustom = item.meta && item.meta.type === 'custom';
        const icon     = isCustom ? 'fa-screwdriver-wrench' : 'fa-cube';

        // Build metadata detail line for custom orders
        let metaHtml = '';
        if (isCustom) {
            const m = item.meta;
            const details = [
                m.material  && `<span>${m.material}</span>`,
                m.infill    && `<span>${m.infill}</span>`,
                m.urgency   && `<span>${m.urgency}</span>`,
                m.postProcessing && m.postProcessing.length
                    ? `<span>${m.postProcessing.join(', ')}</span>`
                    : null,
                m.fileName  && `<span class="italic text-slate-400"><i class="fa-solid fa-paperclip mr-1 text-[10px]"></i>${m.fileName}</span>`,
            ].filter(Boolean);

            if (details.length) {
                metaHtml = `<p class="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2">${details.join('<span class="text-slate-700">·</span>')}</p>`;
            }
        } else if (item.color && item.color !== 'Standard') {
            metaHtml = `<p class="text-[11px] text-slate-500 mt-0.5">Color: <span class="text-slate-300">${item.color}</span></p>`;
        }

        html += `
            <div class="py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/60 last:border-b-0">
                <div class="flex items-start space-x-4">
                    <div class="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-orange-500 text-xl shrink-0 mt-0.5 shadow-sm">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-white mb-0.5 flex items-center space-x-2">
                            <span>${item.name}</span>
                            ${item.meta?.verifiedByServer || item.verifiedByServer ? '<span class="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"><i class="fa-solid fa-check text-[9px] mr-1"></i>Verified</span>' : ''}
                        </h3>
                        <span class="text-xs text-orange-400 font-semibold">$${item.price.toFixed(2)} / unit</span>
                        ${metaHtml}
                    </div>
                </div>
                <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-6">
                    <div class="flex items-center border border-slate-800 rounded-xl bg-slate-950">
                        <button onclick="updateQuantityAndRefresh(${index}, -1)" class="px-3 py-1.5 text-slate-400 hover:text-white transition-colors" title="Decrease quantity">-</button>
                        <span class="text-xs font-semibold text-white px-3">${item.quantity}</span>
                        <button onclick="updateQuantityAndRefresh(${index}, 1)" class="px-3 py-1.5 text-slate-400 hover:text-white transition-colors" title="Increase quantity">+</button>
                    </div>
                    <span class="text-sm font-extrabold text-white w-20 text-right">$${itemTotal.toFixed(2)}</span>
                    <button onclick="removeItemAndRefresh(${index})" class="text-slate-500 hover:text-red-400 transition-colors p-1" title="Remove item">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (subtotalEl) subtotalEl.innerText = '$' + subtotal.toFixed(2);
    if (totalEl) totalEl.innerText = '$' + subtotal.toFixed(2);
}

function updateQuantityAndRefresh(index, change) {
    updateQuantity(index, change);
    renderFullCartPage();
}

function removeItemAndRefresh(index) {
    cart.splice(index, 1);
    saveCart();
    renderFullCartPage();
}

// ── Checkout Modal & Handler ─────────────────────────────────────────────────

async function handleCheckout() {
    if (!cart || cart.length === 0) {
        if (typeof showToast === 'function') showToast('Your cart is empty!');
        return;
    }

    const checkoutBtn = document.getElementById('page-checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.innerHTML = `
            <div class="flex items-center space-x-2.5 mx-auto">
                <i class="fa-solid fa-circle-notch fa-spin text-sm"></i>
                <span>Opening Checkout...</span>
            </div>
        `;
    }

    // Direct user to dedicated secure checkout page
    window.location.href = 'checkout.html';
}

function showOrderConfirmation(order) {
    const existing = document.getElementById('order-confirmation-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'order-confirmation-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in';

    let itemsHtml = order.items.map(it => `
        <div class="flex justify-between items-center py-2 border-b border-slate-800/40 text-xs">
            <div>
                <p class="font-medium text-white">${it.name}</p>
                <p class="text-slate-500">Qty: ${it.quantity} × $${it.unitPrice.toFixed(2)}</p>
            </div>
            <span class="font-bold text-white">$${it.lineTotal.toFixed(2)}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button onclick="document.getElementById('order-confirmation-modal').remove()" class="absolute top-5 right-5 text-slate-500 hover:text-white p-2">
                <i class="fa-solid fa-xmark text-base"></i>
            </button>
            <div class="text-center mb-6">
                <div class="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl mb-3">
                    <i class="fa-solid fa-check"></i>
                </div>
                <h3 class="text-xl font-extrabold text-white">Order Verified & Created!</h3>
                <p class="text-xs text-slate-400 mt-1">Order Ref: <span class="text-orange-400 font-mono font-bold">${order.orderId}</span></p>
            </div>

            <div class="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 mb-6 max-h-60 overflow-y-auto">
                <h4 class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Verified Items</h4>
                ${itemsHtml}
            </div>

            <div class="space-y-2 text-xs border-t border-slate-800 pt-4 mb-6">
                <div class="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span class="text-white font-semibold">$${order.pricingSummary.subtotal.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Shipping</span>
                    <span class="text-white font-semibold">${order.pricingSummary.shipping}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Estimated Tax (FL)</span>
                    <span class="text-white font-semibold">$${order.pricingSummary.tax.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                    <span>Total</span>
                    <span class="text-orange-400">$${order.pricingSummary.total.toFixed(2)}</span>
                </div>
            </div>

            <button onclick="document.getElementById('order-confirmation-modal').remove()" class="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all">
                Close & Return to Store
            </button>
        </div>
    `;

    document.body.appendChild(modal);
}

// Render on load
document.addEventListener('DOMContentLoaded', () => {
    initCartPage();

    const pageCheckoutBtn = document.getElementById('page-checkout-btn');
    if (pageCheckoutBtn) {
        pageCheckoutBtn.addEventListener('click', handleCheckout);
    }
});
