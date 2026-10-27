/**
 * Bolivar Prints - Account Dashboard Controller
 * Handles user profile display, order history loading, saved address updates,
 * and security credentials management.
 */

let activeAccountTab = 'orders';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Enforce authentication on account page
    const user = getCurrentUser();
    if (!user) {
        // Open login modal and redirect if cancelled
        if (typeof openAuthModal === 'function') {
            openAuthModal('login');
        }
        return;
    }

    // 2. Populate overview & form fields
    populateAccountOverview(user);

    // 3. Check URL hash for direct tab navigation
    const hash = window.location.hash.replace('#', '');
    if (['orders', 'address', 'profile'].includes(hash)) {
        switchAccountTab(hash);
    } else {
        switchAccountTab('orders');
    }

    // 4. Fetch past orders
    await loadAccountOrders();
});

// ─── 1. Overview & Profile Fields ────────────────────────────────────────────

function populateAccountOverview(user) {
    const avatarEl = document.getElementById('account-avatar');
    const nameEl = document.getElementById('account-name');
    const emailEl = document.getElementById('account-email');
    const joinedEl = document.getElementById('account-joined');

    const isAdmin = user.role === 'admin';
    const nameParts = (user.name || 'User').split(' ');
    const initials = isAdmin ? 'ADM' : (nameParts[0][0] + (nameParts[1] ? nameParts[1][0] : '')).toUpperCase();

    if (avatarEl) {
        avatarEl.innerText = initials;
        if (isAdmin) {
            avatarEl.className = 'w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white text-xl font-black shadow-xl shadow-orange-600/30';
        }
    }
    if (nameEl) nameEl.innerText = user.name || 'Valued Maker';
    if (emailEl) emailEl.innerText = user.email || '';

    // If admin, update role pill and add quick button
    if (isAdmin) {
        const badgeEl = nameEl?.parentElement?.querySelector('span');
        if (badgeEl) {
            badgeEl.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-black uppercase tracking-wider';
            badgeEl.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i> Administrator';
        }

        const actionsContainer = document.querySelector('header .flex.items-center.space-x-3');
        if (actionsContainer && !document.getElementById('acc-admin-portal-btn')) {
            const adminBtn = document.createElement('a');
            adminBtn.id = 'acc-admin-portal-btn';
            adminBtn.href = 'admin.html';
            adminBtn.className = 'px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-all flex items-center space-x-1.5';
            adminBtn.innerHTML = '<i class="fa-solid fa-shield-halved text-xs"></i><span>Admin Portal</span>';
            actionsContainer.prepend(adminBtn);
        }
    }

    if (joinedEl && user.createdAt) {
        const d = new Date(user.createdAt);
        joinedEl.innerText = `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }

    // Profile form fields
    const profName = document.getElementById('prof-name');
    const profEmail = document.getElementById('prof-email');
    const profPhone = document.getElementById('prof-phone');

    if (profName) profName.value = user.name || '';
    if (profEmail) profEmail.value = user.email || '';
    if (profPhone) profPhone.value = user.phone || '';

    // Address form fields
    if (user.shippingAddress) {
        const addr = user.shippingAddress;
        const streetEl = document.getElementById('acc-street');
        const aptEl = document.getElementById('acc-apt');
        const cityEl = document.getElementById('acc-city');
        const stateEl = document.getElementById('acc-state');
        const zipEl = document.getElementById('acc-zip');

        if (streetEl) streetEl.value = addr.street || '';
        if (aptEl) aptEl.value = addr.apt || '';
        if (cityEl) cityEl.value = addr.city || '';
        if (stateEl && addr.state) stateEl.value = addr.state;
        if (zipEl) zipEl.value = addr.zip || '';
    }
}

// ─── 2. Tab Navigation ───────────────────────────────────────────────────────

window.switchAccountTab = function(tabName) {
    activeAccountTab = tabName;

    const btnOrders = document.getElementById('tab-btn-orders');
    const btnAddress = document.getElementById('tab-btn-address');
    const btnProfile = document.getElementById('tab-btn-profile');

    const viewOrders = document.getElementById('account-view-orders');
    const viewAddress = document.getElementById('account-view-address');
    const viewProfile = document.getElementById('account-view-profile');

    [btnOrders, btnAddress, btnProfile].forEach(b => {
        b?.classList.remove('bg-orange-600', 'text-white', 'shadow-md');
        b?.classList.add('text-slate-400');
    });

    [viewOrders, viewAddress, viewProfile].forEach(v => v?.classList.add('hidden'));

    if (tabName === 'orders') {
        btnOrders?.classList.add('bg-orange-600', 'text-white', 'shadow-md');
        btnOrders?.classList.remove('text-slate-400');
        viewOrders?.classList.remove('hidden');
    } else if (tabName === 'address') {
        btnAddress?.classList.add('bg-orange-600', 'text-white', 'shadow-md');
        btnAddress?.classList.remove('text-slate-400');
        viewAddress?.classList.remove('hidden');
    } else if (tabName === 'profile') {
        btnProfile?.classList.add('bg-orange-600', 'text-white', 'shadow-md');
        btnProfile?.classList.remove('text-slate-400');
        viewProfile?.classList.remove('hidden');
    }

    window.history.replaceState(null, null, `#${tabName}`);
};

// ─── 3. Orders Loading & Rendering ───────────────────────────────────────────

async function loadAccountOrders() {
    const container = document.getElementById('orders-list-container');
    const badgeCount = document.getElementById('orders-badge-count');
    const token = getAuthToken();

    if (!container) return;

    try {
        const res = await fetch(`${AUTH_API_BASE}/api/auth/orders`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                if (badgeCount) badgeCount.innerText = data.orders.length;
                renderOrdersList(data.orders);
                return;
            }
        }
        renderOrdersList([]);
    } catch (err) {
        console.debug('Failed to fetch orders from backend:', err.message);
        renderOrdersList([]);
    }
}

function renderOrdersList(orders) {
    const container = document.getElementById('orders-list-container');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 text-slate-500 space-y-3">
                <div class="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-orange-500 text-2xl shadow-sm">
                    <i class="fa-solid fa-box-open"></i>
                </div>
                <h3 class="text-base font-bold text-white">No Orders Placed Yet</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">
                    When you order custom 3D prints or catalog models, they will appear here with live tracking.
                </p>
                <div class="pt-3">
                    <a href="store.html" class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all">
                        <span>Explore 3D Store</span>
                        <i class="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                </div>
            </div>
        `;
        return;
    }

    let html = '';

    orders.forEach(order => {
        const d = new Date(order.createdAt);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        let itemsHtml = order.items.map(it => {
            const isCustom = it.meta && it.meta.type === 'custom';
            const icon = isCustom ? 'fa-screwdriver-wrench' : 'fa-cube';
            return `
                <div class="flex items-center justify-between py-2 text-xs border-b border-slate-800/40 last:border-b-0">
                    <div class="flex items-center space-x-2.5 min-w-0">
                        <div class="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-orange-400 text-xs shrink-0">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div class="truncate">
                            <p class="font-bold text-white truncate">${it.name}</p>
                            <p class="text-[10px] text-slate-400">Qty: ${it.quantity} × $${it.unitPrice.toFixed(2)} ${it.color ? `· Color: ${it.color}` : ''}</p>
                        </div>
                    </div>
                    <span class="font-extrabold text-white text-xs shrink-0">$${it.lineTotal.toFixed(2)}</span>
                </div>
            `;
        }).join('');

        html += `
            <div class="p-5 sm:p-6 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
                
                <!-- Order Card Top Bar -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div>
                        <div class="flex items-center space-x-2.5">
                            <span class="text-xs font-bold text-white">Order Reference:</span>
                            <span class="font-mono text-xs font-black text-orange-400">${order.orderId}</span>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                                <i class="fa-solid fa-circle-check mr-1 text-[8px]"></i> Confirmed
                            </span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">Placed on ${dateStr} · Delivery ETA: <span class="text-slate-300 font-medium">${order.estimatedDelivery}</span></p>
                    </div>

                    <div class="flex items-center space-x-3">
                        <span class="text-base font-black text-white">$${order.pricingSummary.total.toFixed(2)}</span>
                        <button type="button" onclick='viewSavedReceipt(${JSON.stringify(order).replace(/'/g, "&#39;")})'
                            class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-orange-500 text-xs text-slate-300 hover:text-white transition-all font-semibold flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-receipt text-orange-400"></i>
                            <span>View Receipt</span>
                        </button>
                    </div>
                </div>

                <!-- Items Breakdown -->
                <div class="space-y-1">
                    ${itemsHtml}
                </div>

                <!-- Shipping Destination Footer -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
                    <div>
                        <i class="fa-solid fa-location-dot mr-1 text-slate-400"></i>
                        <span>Ship to: <strong class="text-slate-300">${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}</strong></span>
                    </div>
                    <div>
                        <span class="text-slate-400">Payment: <strong class="text-slate-300 capitalize">${order.payment.method} (${order.payment.cardBrand || 'Approved'})</strong></span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ─── 4. Save Shipping Destination ────────────────────────────────────────────

async function handleSaveAddress(e) {
    e.preventDefault();

    const token = getAuthToken();
    const btn = document.getElementById('save-address-btn');
    const origText = btn ? btn.innerHTML : '';

    const street = document.getElementById('acc-street')?.value.trim();
    const apt = document.getElementById('acc-apt')?.value.trim();
    const city = document.getElementById('acc-city')?.value.trim();
    const state = document.getElementById('acc-state')?.value;
    const zip = document.getElementById('acc-zip')?.value.trim();

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving...`;
    }

    try {
        const res = await fetch(`${AUTH_API_BASE}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                shippingAddress: { street, apt, city, state, zip, country: 'United States' }
            }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
            setAuthSession(data.user, token);
            if (typeof showToast === 'function') {
                showToast('Default shipping address saved!');
            }
        } else {
            alert(data.error || 'Failed to save address');
        }
    } catch (err) {
        // Fallback local save
        const user = getCurrentUser();
        if (user) {
            user.shippingAddress = { street, apt, city, state, zip, country: 'United States' };
            setAuthSession(user, token);
            if (typeof showToast === 'function') {
                showToast('Shipping address saved locally!');
            }
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

// ─── 5. Save Profile & Password ──────────────────────────────────────────────

async function handleSaveProfile(e) {
    e.preventDefault();

    const token = getAuthToken();
    const btn = document.getElementById('save-profile-btn');
    const origText = btn ? btn.innerHTML : '';

    const name = document.getElementById('prof-name')?.value.trim();
    const phone = document.getElementById('prof-phone')?.value.trim();
    const currentPassword = document.getElementById('prof-curr-pass')?.value;
    const newPassword = document.getElementById('prof-new-pass')?.value;

    if (!name) {
        alert('Full name is required.');
        return;
    }

    if (newPassword && newPassword.length < 6) {
        alert('New password must be at least 6 characters.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Updating...`;
    }

    try {
        const payload = { name, phone };
        if (newPassword) {
            payload.currentPassword = currentPassword;
            payload.newPassword = newPassword;
        }

        const res = await fetch(`${AUTH_API_BASE}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
            setAuthSession(data.user, token);
            populateAccountOverview(data.user);
            const pass1 = document.getElementById('prof-curr-pass');
            const pass2 = document.getElementById('prof-new-pass');
            if (pass1) pass1.value = '';
            if (pass2) pass2.value = '';

            if (typeof showToast === 'function') {
                showToast('Profile credentials updated successfully!');
            }
        } else {
            alert(data.error || 'Failed to update profile');
        }
    } catch (err) {
        alert('Network error while updating profile.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    }
}

// ─── 6. View Receipt Modal ───────────────────────────────────────────────────

window.viewSavedReceipt = function(order) {
    if (typeof showOrderConfirmationReceipt === 'function') {
        showOrderConfirmationReceipt(order);
    } else {
        alert(`Order ${order.orderId}\nTotal: $${order.pricingSummary.total.toFixed(2)}\nStatus: ${order.status}`);
    }
};
