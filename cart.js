/**
 * Bolivar Prints - Cart Logic (Frontend Client)
 * Handles cart state, UI updates, drawer functionality, and secure server synchronization.
 */

const API_BASE = (window.location.protocol !== 'file:' && window.location.port === '3000') ? '' : 'http://localhost:3000';

// Cart state loaded from localStorage or initialized empty
let cart = JSON.parse(localStorage.getItem('bolivar_cart')) || [];

// Save cart changes to localStorage and update badges globally
function saveCart() {
    localStorage.setItem('bolivar_cart', JSON.stringify(cart));
    updateCartBadge();
}

// Update cart count badges across all pages
function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Select by ID (used in most pages)
    const badgeById = document.getElementById('cart-badge');
    if (badgeById) {
        badgeById.innerText = totalItems;
        badgeById.classList.add('scale-125');
        setTimeout(() => badgeById.classList.remove('scale-125'), 200);
    }

    // Select by class (fallback / future-proof)
    const badgesByClass = document.querySelectorAll('.cart-badge');
    badgesByClass.forEach(badge => {
        badge.innerText = totalItems;
    });
}

/**
 * Validates the cart against authoritative backend prices.
 * Overwrites any client-side tampering in localStorage.
 * Sends the auth token if the user is logged in so the server can
 * associate the validation with the correct user session.
 */
async function validateCartWithServer() {
    if (!cart || cart.length === 0) return;

    try {
        // Build request headers — include Authorization token when logged in
        const headers = { 'Content-Type': 'application/json' };
        const storedToken = localStorage.getItem('bolivar_token');
        if (storedToken) {
            headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const response = await fetch(`${API_BASE}/api/cart/validate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ items: cart }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
            if (data.tampered) {
                console.warn('Tampered prices detected. Restoring official catalog prices.');
                if (typeof showToast === 'function') {
                    showToast('Cart prices synchronized with official store rates.');
                }
            }
            cart = data.items;
            localStorage.setItem('bolivar_cart', JSON.stringify(cart));
            updateCartBadge();
            updateCartUI();
        }
    } catch (err) {
        // Backend not currently reachable; keep local copy
        console.debug('Backend offline, using local cached cart:', err.message);
    }
}

/**
 * Add item to cart.
 * Accepts either:
 *   addToCart({ id, name, price, color, quantity })  ← object form (preferred)
 *   addToCart(name, price)                           ← legacy two-arg form (product-detail)
 */
function addToCart(productOrName, legacyPrice) {
    let product;
    if (typeof productOrName === 'string') {
        product = {
            id: productOrName,
            name: productOrName,
            price: legacyPrice,
            color: 'Standard',
            quantity: 1
        };
    } else {
        product = productOrName;
    }

    const existingIndex = cart.findIndex(
        item => item.id === product.id && item.color === (product.color || 'Standard')
    );

    if (existingIndex > -1) {
        cart[existingIndex].quantity += product.quantity || 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image || null,
            color: product.color || 'Standard',
            quantity: product.quantity || 1,
            meta: product.meta || undefined,
        });
    }

    saveCart();
    if (typeof showToast === 'function') {
        showToast(`Added "${product.name}" to cart!`);
    } else {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'fixed bottom-5 right-5 bg-orange-600 text-white px-5 py-3 rounded-xl shadow-xl z-[9999] transition-opacity duration-300 opacity-0 text-sm font-semibold';
            document.body.appendChild(toast);
        }
        toast.innerText = `Added "${product.name}" to cart!`;
        clearTimeout(toast._hideTimer);
        toast.classList.remove('opacity-0');
        toast._hideTimer = setTimeout(() => toast.classList.add('opacity-0'), 3000);
    }

    // Verify and sync with backend
    validateCartWithServer();

    // Open the cart drawer if it exists on this page
    openCartDrawer();
}

// Update quantity of an item in the cart (used by cart.html)
function updateQuantity(index, change) {
    if (!cart[index]) return;
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    validateCartWithServer();
}

// ─── Cart Drawer (slide-over) ────────────────────────────────────────────────

function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const panel = document.getElementById('cart-panel');
    if (!drawer || !panel) return;

    updateCartUI();
    drawer.classList.remove('opacity-0', 'pointer-events-none');
    drawer.classList.add('opacity-100');
    panel.classList.remove('translate-x-full');

    // Asynchronously validate prices with backend
    validateCartWithServer();
}

function closeCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const panel = document.getElementById('cart-panel');
    if (!drawer || !panel) return;

    drawer.classList.add('opacity-0', 'pointer-events-none');
    drawer.classList.remove('opacity-100');
    panel.classList.add('translate-x-full');
}

// Render items inside the slide-over cart drawer
function updateCartUI() {
    const cartItemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    if (!cartItemsEl) return;

    if (cart.length === 0) {
        cartItemsEl.innerHTML = `
            <div class="text-center py-10 text-slate-500 space-y-2">
                <i class="fa-solid fa-cart-shopping text-3xl text-slate-700"></i>
                <p class="text-sm font-medium text-white">Your cart is empty</p>
                <p class="text-xs text-slate-500">Browse the store to add items.</p>
            </div>
        `;
        if (subtotalEl) subtotalEl.innerText = '$0.00';
        return;
    }

    let html = '';
    let subtotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        const icon = item.meta?.type === 'custom' ? 'fa-screwdriver-wrench' : 'fa-cube';

        html += `
            <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-800/40 last:border-b-0">
                <div class="flex items-center space-x-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-orange-500 shrink-0">
                        <i class="fa-solid ${icon} text-sm"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-semibold text-white truncate">${item.name}</p>
                        <p class="text-[11px] text-slate-500">$${item.price.toFixed(2)} × ${item.quantity}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 shrink-0">
                    <span class="text-xs font-bold text-white">$${itemTotal.toFixed(2)}</span>
                    <button onclick="removeItemFromDrawer(${index})" class="text-slate-500 hover:text-red-400 transition-colors p-1" title="Remove item">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    });

    cartItemsEl.innerHTML = html;
    if (subtotalEl) subtotalEl.innerText = '$' + subtotal.toFixed(2);
}

function removeItemFromDrawer(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

// ─── Initialize on DOM load ───────────────────────────────────────────────────
function initCart() {
    updateCartBadge();
    validateCartWithServer();

    // Wire up cart button to open drawer (if drawer exists on this page)
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawer = document.getElementById('cart-drawer');
    if (cartBtn && cartDrawer) {
        const cartBtnParentLink = cartBtn.closest('a[href="cart.html"]');
        if (cartBtnParentLink) {
            cartBtnParentLink.addEventListener('click', (e) => {
                e.preventDefault();
                openCartDrawer();
            });
        } else {
            cartBtn.addEventListener('click', () => openCartDrawer());
        }
    }

    // Close cart drawer via close button
    const closeCartBtn = document.getElementById('close-cart');
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCartDrawer);
    }

    // Close cart drawer via backdrop click
    const cartBackdrop = document.getElementById('cart-backdrop');
    if (cartBackdrop) {
        cartBackdrop.addEventListener('click', closeCartDrawer);
    }

    // Checkout button inside drawer → navigate to checkout.html
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                if (typeof showToast === 'function') showToast('Your cart is empty!');
                return;
            }
            window.location.href = 'checkout.html';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCart);
} else {
    initCart();
}
