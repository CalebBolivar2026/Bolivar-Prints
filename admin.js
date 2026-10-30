/**
 * Bolivar Prints - Admin Portal Controller
 * Manages store configuration, live customer announcements, catalog products,
 * order statuses, and dashboard statistics.
 */

const ADMIN_API_BASE = (window.location.protocol !== 'file:' && window.location.port === '3000') ? '' : 'http://localhost:3000';

// State
let currentAdmin = null;
let currentSettings = {
    announcement: {
        enabled: true,
        text: '🎉 Special Launch Offer: Free US Shipping on orders over $35 with code PRINTSHIP!',
        badge: 'Special Notice',
        linkText: 'Browse Catalog',
        linkUrl: 'store.html',
    },
    storeNotice: '',
    featuredPromoCode: 'BOLIVAR10',
};
let adminProducts = [];
let adminOrders = [];
let adminUsers = [];
let adminContacts = [];
let selectedContactModalId = null;
let activeAdminTab = 'announcement';

// ─── 1. Authentication & Security Guard ──────────────────────────────────────

function getAdminToken() {
    return localStorage.getItem('bolivar_token') || null;
}

function getStoredUser() {
    try {
        const raw = localStorage.getItem('bolivar_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function verifyAdminAccess() {
    const token = getAdminToken();
    const user = getStoredUser();

    if (!token || !user || user.role !== 'admin') {
        showAdminLockModal();
        return false;
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/verify`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                currentAdmin = data.admin || user;
                hideAdminLockModal();
                updateAdminHeaderUI();
                loadAllAdminData();
                return true;
            }
        }
    } catch (err) {
        console.warn('Backend admin verify check failed, using cached session:', err.message);
        currentAdmin = user;
        hideAdminLockModal();
        updateAdminHeaderUI();
        loadAllAdminData();
        return true;
    }

    showAdminLockModal();
    return false;
}

function showAdminLockModal() {
    const lock = document.getElementById('admin-lock-screen');
    if (lock) {
        lock.classList.remove('hidden');
        lock.classList.add('flex');
    }
}

function hideAdminLockModal() {
    const lock = document.getElementById('admin-lock-screen');
    if (lock) {
        lock.classList.add('hidden');
        lock.classList.remove('flex');
    }
}

async function handleAdminDirectLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-login-username')?.value.trim();
    const password = document.getElementById('admin-login-password')?.value;
    const errorEl = document.getElementById('admin-login-error');
    const submitBtn = document.getElementById('admin-login-btn');

    if (errorEl) errorEl.classList.add('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Authenticating...';
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
            localStorage.setItem('bolivar_user', JSON.stringify(data.admin));
            localStorage.setItem('bolivar_token', data.token);
            currentAdmin = data.admin;
            hideAdminLockModal();
            updateAdminHeaderUI();
            showAdminToast('Welcome Administrator! Portal unlocked.', 'success');
            loadAllAdminData();
        } else {
            if (errorEl) {
                errorEl.innerText = data.error || 'Invalid credentials. Default: admin / bolivar';
                errorEl.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.warn('Backend connection issue in admin login:', err);
        if (username === 'admin' && password === 'bolivar') {
            const fallbackAdmin = {
                id: 'admin_root',
                username: 'admin',
                name: 'Store Administrator',
                email: 'admin@bolivarprints.com',
                role: 'admin',
                isAdmin: true,
            };
            const fallbackToken = 'ADMIN:admin:' + Date.now();
            localStorage.setItem('bolivar_user', JSON.stringify(fallbackAdmin));
            localStorage.setItem('bolivar_token', fallbackToken);
            currentAdmin = fallbackAdmin;
            hideAdminLockModal();
            updateAdminHeaderUI();
            showAdminToast('Welcome Administrator! Portal unlocked.', 'success');
            loadAllAdminData();
            return;
        }
        if (errorEl) {
            errorEl.innerText = 'Unable to reach backend server. Default credentials: admin / bolivar';
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-lock-open mr-2"></i> Unlock Admin Portal';
        }
    }
}

function handleAdminLogout() {
    localStorage.removeItem('bolivar_user');
    localStorage.removeItem('bolivar_token');
    currentAdmin = null;
    showAdminToast('Admin signed out.', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 400);
}

function updateAdminHeaderUI() {
    const nameEl = document.getElementById('admin-user-display');
    if (nameEl && currentAdmin) {
        nameEl.innerText = currentAdmin.name || 'Admin';
    }
}

// ─── 2. Data Loading ─────────────────────────────────────────────────────────

async function loadAllAdminData() {
    await Promise.all([
        loadStats(),
        loadSettings(),
        loadProducts(),
        loadOrders(),
        loadUsers(),
        loadContactSubmissions(),
    ]);
}

async function loadStats() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.stats) {
                renderStats(data.stats);
            }
        }
    } catch (err) {
        console.warn('Failed to load stats:', err);
    }
}

function renderStats(stats) {
    const revEl = document.getElementById('stat-revenue');
    const ordersEl = document.getElementById('stat-orders');
    const prodsEl = document.getElementById('stat-products');
    const usersEl = document.getElementById('stat-users');

    if (revEl) revEl.innerText = `$${(stats.totalRevenue || 0).toFixed(2)}`;
    if (ordersEl) ordersEl.innerText = stats.totalOrders || 0;
    if (prodsEl) prodsEl.innerText = stats.totalProducts || 0;
    if (usersEl) usersEl.innerText = stats.totalUsers || 0;
}

// ─── 3. Site Announcement & Storefront Settings ──────────────────────────────

async function loadSettings() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/settings`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.settings) {
                currentSettings = data.settings;
            }
        }
    } catch (err) {
        console.warn('Failed to load settings:', err);
    }
    populateSettingsForm();
    updateLiveBannerPreview();
}

function populateSettingsForm() {
    const enabledInput = document.getElementById('setting-banner-enabled');
    const textInput = document.getElementById('setting-banner-text');
    const badgeInput = document.getElementById('setting-banner-badge');
    const linkTextInput = document.getElementById('setting-banner-link-text');
    const linkUrlInput = document.getElementById('setting-banner-link-url');
    const promoInput = document.getElementById('setting-promo-code');

    const anno = currentSettings.announcement || {};
    if (enabledInput) enabledInput.checked = anno.enabled !== false;
    if (textInput) textInput.value = anno.text || '';
    if (badgeInput) badgeInput.value = anno.badge || 'Special Notice';
    if (linkTextInput) linkTextInput.value = anno.linkText || 'Browse Catalog';
    if (linkUrlInput) linkUrlInput.value = anno.linkUrl || 'store.html';
    if (promoInput) promoInput.value = currentSettings.featuredPromoCode || 'BOLIVAR10';
}

function updateLiveBannerPreview() {
    const enabled = document.getElementById('setting-banner-enabled')?.checked ?? true;
    const text = document.getElementById('setting-banner-text')?.value || 'Your customer announcement appears here...';
    const badge = document.getElementById('setting-banner-badge')?.value || 'Notice';
    const linkText = document.getElementById('setting-banner-link-text')?.value || '';
    const linkUrl = document.getElementById('setting-banner-link-url')?.value || '';

    const previewContainer = document.getElementById('banner-live-preview');
    if (!previewContainer) return;

    if (!enabled) {
        previewContainer.innerHTML = `
            <div class="py-4 text-center text-xs text-slate-500 italic">
                <i class="fa-solid fa-eye-slash mr-1"></i> Announcement banner is currently <strong>disabled</strong>. Customers will not see a banner.
            </div>
        `;
        return;
    }

    const actionHtml = linkText && linkUrl ? `
        <span class="inline-flex items-center space-x-1 underline decoration-orange-500 underline-offset-2 text-white font-bold ml-2">
            <span>${escapeHtml(linkText)}</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
        </span>
    ` : '';

    previewContainer.innerHTML = `
        <div class="bg-gradient-to-r from-orange-950 via-slate-900 to-amber-950 border border-orange-500/40 rounded-2xl py-3 px-4 text-white text-xs shadow-lg flex items-center justify-between gap-3">
            <div class="flex-1 flex items-center justify-center space-x-2 text-center flex-wrap">
                <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                    <i class="fa-solid fa-bullhorn text-[9px]"></i>
                    <span>${escapeHtml(badge)}</span>
                </span>
                <span class="text-slate-200 font-medium">${escapeHtml(text)}</span>
                ${actionHtml}
            </div>
            <span class="text-slate-400 text-xs shrink-0"><i class="fa-solid fa-xmark"></i></span>
        </div>
    `;
}

async function saveSettings(e) {
    if (e) e.preventDefault();
    const token = getAdminToken();

    const enabled = document.getElementById('setting-banner-enabled')?.checked ?? true;
    const text = document.getElementById('setting-banner-text')?.value.trim() || '';
    const badge = document.getElementById('setting-banner-badge')?.value.trim() || 'Notice';
    const linkText = document.getElementById('setting-banner-link-text')?.value.trim() || '';
    const linkUrl = document.getElementById('setting-banner-link-url')?.value.trim() || '';
    const promoCode = document.getElementById('setting-promo-code')?.value.trim() || '';

    const payload = {
        announcement: {
            enabled,
            text,
            badge,
            linkText,
            linkUrl,
        },
        featuredPromoCode: promoCode,
    };

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Publishing to Site...';
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
            currentSettings = data.settings;
            localStorage.setItem('bolivar_site_settings', JSON.stringify(data.settings));
            showAdminToast('Live changes published! Customers will now see this banner.', 'success');
            updateLiveBannerPreview();
        } else {
            showAdminToast(data.error || 'Failed to update settings', 'error');
        }
    } catch (err) {
        console.warn('Backend settings update offline, caching locally:', err);
        currentSettings = { ...currentSettings, ...payload };
        localStorage.setItem('bolivar_site_settings', JSON.stringify(currentSettings));
        showAdminToast('Settings published locally! (Backend server offline)', 'info');
        updateLiveBannerPreview();
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-bolt mr-1.5"></i> Publish Live to Store';
        }
    }
}

// ─── 4. Product Management ───────────────────────────────────────────────────

async function loadProducts() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/products`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.products)) {
                adminProducts = data.products;
                renderProductsTable();
            }
        }
    } catch (err) {
        console.warn('Failed to load products:', err);
    }
}

function renderProductsTable() {
    const tbody = document.getElementById('admin-products-table-body');
    if (!tbody) return;

    if (adminProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-500 text-xs">
                    <i class="fa-solid fa-box-open text-3xl mb-2 text-slate-700"></i>
                    <p>No products in the store catalog yet.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = adminProducts.map(p => {
        const isStock = p.inStock !== false;
        const imgHtml = p.image
            ? `<img src="${p.image}" class="w-10 h-10 rounded-xl object-cover border border-slate-800" alt="">`
            : `<div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-orange-400 text-xs"><i class="fa-solid ${p.icon || 'fa-cube'}"></i></div>`;

        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors text-xs text-slate-300">
                <td class="py-3 px-4">
                    <div class="flex items-center space-x-3">
                        ${imgHtml}
                        <div>
                            <p class="font-bold text-white text-xs">${escapeHtml(p.name)}</p>
                            <p class="text-[10px] text-slate-500">ID: ${p.id}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] uppercase font-semibold">
                        ${escapeHtml(p.category || 'decor')}
                    </span>
                </td>
                <td class="py-3 px-4 font-mono font-bold text-white">
                    $${Number(p.price).toFixed(2)}
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-semibold">
                        ${escapeHtml(p.tag || 'Precision Print')}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <button type="button" onclick="toggleProductStock('${p.id}', ${!isStock})"
                        class="px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${isStock ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'}">
                        <i class="fa-solid ${isStock ? 'fa-check' : 'fa-xmark'} mr-1"></i>
                        ${isStock ? 'In Stock' : 'Out of Stock'}
                    </button>
                </td>
                <td class="py-3 px-4 text-right space-x-2">
                    <button type="button" onclick="openEditProductModal('${p.id}')"
                        class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors cursor-pointer"
                        title="Edit Details">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" onclick="deleteProduct('${p.id}')"
                        class="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors cursor-pointer"
                        title="Delete Product">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleProductStock(productId, newStock) {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ inStock: newStock }),
        });

        if (res.ok) {
            showAdminToast(`Product marked as ${newStock ? 'In Stock' : 'Out of Stock'}!`, 'success');
            await loadProducts();
        } else {
            showAdminToast('Failed to update stock status', 'error');
        }
    } catch (err) {
        showAdminToast('Network error updating stock', 'error');
    }
}

function openAddProductModal() {
    document.getElementById('product-modal-title').innerText = 'Add New Product to Store';
    document.getElementById('edit-prod-id').value = '';
    document.getElementById('edit-prod-name').value = '';
    document.getElementById('edit-prod-price').value = '';
    document.getElementById('edit-prod-category').value = 'decor';
    document.getElementById('edit-prod-tag').value = 'Precision Print';
    document.getElementById('edit-prod-icon').value = 'fa-cube';
    document.getElementById('edit-prod-image').value = '';
    document.getElementById('edit-prod-colors').value = 'Silk Gold, Matte Black';
    document.getElementById('edit-prod-desc').value = '';

    const modal = document.getElementById('product-edit-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function openEditProductModal(productId) {
    const prod = adminProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('product-modal-title').innerText = `Edit Product: ${prod.name}`;
    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('edit-prod-name').value = prod.name || '';
    document.getElementById('edit-prod-price').value = prod.price || '';
    document.getElementById('edit-prod-category').value = prod.category || 'decor';
    document.getElementById('edit-prod-tag').value = prod.tag || '';
    document.getElementById('edit-prod-icon').value = prod.icon || 'fa-cube';
    document.getElementById('edit-prod-image').value = prod.image || '';
    document.getElementById('edit-prod-colors').value = Array.isArray(prod.colors) ? prod.colors.join(', ') : (prod.colors || '');
    document.getElementById('edit-prod-desc').value = prod.description || '';

    const modal = document.getElementById('product-edit-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function closeProductModal() {
    const modal = document.getElementById('product-edit-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
}

async function handleProductFormSubmit(e) {
    e.preventDefault();
    const token = getAdminToken();
    const id = document.getElementById('edit-prod-id').value;
    const isEdit = Boolean(id);

    const payload = {
        name: document.getElementById('edit-prod-name').value.trim(),
        price: parseFloat(document.getElementById('edit-prod-price').value),
        category: document.getElementById('edit-prod-category').value,
        tag: document.getElementById('edit-prod-tag').value.trim(),
        icon: document.getElementById('edit-prod-icon').value.trim() || 'fa-cube',
        image: document.getElementById('edit-prod-image').value.trim() || null,
        colors: document.getElementById('edit-prod-colors').value.trim(),
        description: document.getElementById('edit-prod-desc').value.trim(),
    };

    const submitBtn = document.getElementById('edit-prod-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving...';
    }

    try {
        const url = isEdit
            ? `${ADMIN_API_BASE}/api/admin/products/${id}`
            : `${ADMIN_API_BASE}/api/admin/products`;

        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closeProductModal();
            showAdminToast(isEdit ? 'Product updated successfully!' : 'New product created!', 'success');
            await loadProducts();
            await loadStats();
        } else {
            showAdminToast(data.error || 'Failed to save product', 'error');
        }
    } catch (err) {
        showAdminToast('Error saving product: ' + err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isEdit ? 'Save Changes' : 'Create Product';
        }
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to permanently remove this product from the store?')) {
        return;
    }

    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
            showAdminToast('Product deleted from store catalog', 'success');
            await loadProducts();
            await loadStats();
        } else {
            showAdminToast('Failed to delete product', 'error');
        }
    } catch (err) {
        showAdminToast('Error deleting product', 'error');
    }
}

// ─── 5. Orders Management ────────────────────────────────────────────────────

async function loadOrders() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/orders`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                adminOrders = data.orders;
                filterOrdersTable();
            }
        }
    } catch (err) {
        console.warn('Failed to load orders:', err);
    }
}

function filterOrdersTable() {
    const query      = (document.getElementById('order-search-input')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('order-filter-status')?.value || 'all';

    const filtered = adminOrders.filter(o => {
        const matchesStatus = statusFilter === 'all' || (o.status || 'confirmed').toLowerCase() === statusFilter;
        if (!matchesStatus) return false;
        if (!query) return true;
        const id      = (o.orderId || '').toLowerCase();
        const name    = (o.customer?.name || '').toLowerCase();
        const email   = (o.customer?.email || '').toLowerCase();
        return id.includes(query) || name.includes(query) || email.includes(query);
    });

    renderOrdersTable(filtered);
}

function renderOrdersTable(list = null) {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;

    const orders = list !== null ? list : adminOrders;

    if (orders.length === 0) {
        const isEmpty = adminOrders.length === 0;
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-slate-500 text-xs">
                    <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-700"></i>
                    <p>${isEmpty ? 'No customer orders placed yet.' : 'No orders match your current filter.'}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(o => {
        const dateStr       = o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Recent';
        const total         = o.pricingSummary?.total ? `$${o.pricingSummary.total.toFixed(2)}` : '$0.00';
        const custName      = o.customer?.name  || 'Customer';
        const custEmail     = o.customer?.email || '';
        const itemsCount    = (o.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
        const currentStatus = (o.status || 'confirmed').toLowerCase();
        const isArchived    = currentStatus === 'archived';

        // Status badge colour
        const statusColors = {
            confirmed:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
            printing:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
            ready:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
            shipped:    'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
            completed:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            cancelled:  'bg-red-500/10 text-red-400 border-red-500/20',
            archived:   'bg-slate-700/40 text-slate-400 border-slate-700',
        };
        const badgeCls = statusColors[currentStatus] || statusColors.confirmed;

        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors text-xs text-slate-300 ${isArchived ? 'opacity-60' : ''}">
                <td class="py-3 px-4 font-mono font-bold text-orange-400">
                    ${escapeHtml(o.orderId || 'ORDER')}
                </td>
                <td class="py-3 px-4">
                    <p class="font-bold text-white">${escapeHtml(custName)}</p>
                    <p class="text-[10px] text-slate-500">${escapeHtml(custEmail)}</p>
                </td>
                <td class="py-3 px-4 text-slate-400">
                    ${itemsCount} item${itemsCount === 1 ? '' : 's'}
                </td>
                <td class="py-3 px-4 font-mono font-bold text-white">
                    ${total}
                </td>
                <td class="py-3 px-4 text-slate-400">
                    ${dateStr}
                </td>
                <td class="py-3 px-4">
                    <select onchange="updateOrderStatus('${o.orderId}', this.value)"
                        class="py-1 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-orange-500 transition-colors">
                        <option value="confirmed"  ${currentStatus === 'confirmed'  ? 'selected' : ''}>Confirmed</option>
                        <option value="printing"   ${currentStatus === 'printing'   ? 'selected' : ''}>3D Printing</option>
                        <option value="ready"      ${currentStatus === 'ready'      ? 'selected' : ''}>Ready for Pickup/Pack</option>
                        <option value="shipped"    ${currentStatus === 'shipped'    ? 'selected' : ''}>Shipped</option>
                        <option value="completed"  ${currentStatus === 'completed'  ? 'selected' : ''}>Completed</option>
                        <option value="archived"   ${currentStatus === 'archived'   ? 'selected' : ''}>Archived</option>
                        <option value="cancelled"  ${currentStatus === 'cancelled'  ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="inline-flex items-center space-x-1.5">
                        <!-- Archive / Unarchive toggle -->
                        <button type="button"
                            onclick="openOrderActionModal('archive', '${escapeHtml(o.orderId)}', '${escapeHtml(custName)}', '${total}', '${currentStatus}')"
                            class="p-2 rounded-xl ${isArchived ? 'bg-slate-700/60 hover:bg-slate-600 text-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'} transition-all cursor-pointer"
                            title="${isArchived ? 'Unarchive order' : 'Archive order'}">
                            <i class="fa-solid ${isArchived ? 'fa-box-open' : 'fa-box-archive'} text-xs"></i>
                        </button>
                        <!-- Permanent delete -->
                        <button type="button"
                            onclick="openOrderActionModal('delete', '${escapeHtml(o.orderId)}', '${escapeHtml(custName)}', '${total}', '${currentStatus}')"
                            class="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                            title="Permanently delete order">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
        });

        if (res.ok) {
            // Update local state so the row re-renders correctly
            const order = adminOrders.find(o => o.orderId === orderId);
            if (order) order.status = newStatus;
            filterOrdersTable();
            showAdminToast(`Order ${orderId} → ${newStatus.toUpperCase()}`, 'success');
        } else {
            showAdminToast('Failed to update order status', 'error');
        }
    } catch (err) {
        showAdminToast('Error connecting to server', 'error');
    }
}

// ─── Order Action Modal (Archive / Delete) ────────────────────────────────────

let _pendingOrderAction = null; // { type: 'archive'|'delete', orderId, currentStatus }

function openOrderActionModal(type, orderId, custName, total, currentStatus) {
    _pendingOrderAction = { type, orderId, currentStatus };

    const isArchived = currentStatus === 'archived';
    const isDelete   = type === 'delete';
    const isUnarchive = type === 'archive' && isArchived;

    // Populate info card
    document.getElementById('order-modal-id').innerText       = orderId;
    document.getElementById('order-modal-customer').innerText = custName;
    document.getElementById('order-modal-total').innerText    = total;
    document.getElementById('order-modal-status').innerText   = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);

    const iconWrap    = document.getElementById('order-modal-icon-wrap');
    const icon        = document.getElementById('order-modal-icon');
    const title       = document.getElementById('order-modal-title');
    const subtitle    = document.getElementById('order-modal-subtitle');
    const warning     = document.getElementById('order-modal-warning');
    const confirmBtn  = document.getElementById('order-modal-confirm-btn');
    const btnIcon     = document.getElementById('order-modal-btn-icon');
    const btnLabel    = document.getElementById('order-modal-btn-label');

    if (isDelete) {
        iconWrap.className  = 'w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl mb-4';
        icon.className      = 'fa-solid fa-trash';
        title.innerText     = 'Permanently Delete Order';
        subtitle.innerText  = 'This cannot be undone. The entire order record will be erased.';
        warning.classList.remove('hidden');
        warning.classList.add('flex');
        confirmBtn.className = 'py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center justify-center space-x-1.5';
        btnIcon.className   = 'fa-solid fa-trash text-xs';
        btnLabel.innerText  = 'Delete Permanently';
    } else if (isUnarchive) {
        iconWrap.className  = 'w-14 h-14 rounded-2xl bg-slate-700/40 border border-slate-700 flex items-center justify-center text-slate-300 text-2xl mb-4';
        icon.className      = 'fa-solid fa-box-open';
        title.innerText     = 'Unarchive Order';
        subtitle.innerText  = 'The order status will be set back to Confirmed and shown in active views.';
        warning.classList.add('hidden');
        warning.classList.remove('flex');
        confirmBtn.className = 'py-2.5 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5';
        btnIcon.className   = 'fa-solid fa-box-open text-xs';
        btnLabel.innerText  = 'Unarchive Order';
    } else {
        iconWrap.className  = 'w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4';
        icon.className      = 'fa-solid fa-box-archive';
        title.innerText     = 'Archive Order';
        subtitle.innerText  = 'The order will be hidden from active views but kept in your records.';
        warning.classList.add('hidden');
        warning.classList.remove('flex');
        confirmBtn.className = 'py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer flex items-center justify-center space-x-1.5';
        btnIcon.className   = 'fa-solid fa-box-archive text-xs';
        btnLabel.innerText  = 'Archive Order';
    }

    const modal = document.getElementById('order-action-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function closeOrderActionModal() {
    _pendingOrderAction = null;
    const modal = document.getElementById('order-action-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
}

async function confirmOrderAction() {
    if (!_pendingOrderAction) return;

    const { type, orderId, currentStatus } = _pendingOrderAction;
    const token      = getAdminToken();
    const confirmBtn = document.getElementById('order-modal-confirm-btn');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i><span>Working...</span>';
    }

    try {
        if (type === 'delete') {
            // ── Permanent delete ──────────────────────────────────────────────
            const res = await fetch(`${ADMIN_API_BASE}/api/admin/orders/${orderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                adminOrders = adminOrders.filter(o => o.orderId !== orderId);
                closeOrderActionModal();
                filterOrdersTable();
                await loadStats();
                showAdminToast(`Order ${orderId} permanently deleted.`, 'success');
            } else {
                showAdminToast(data.error || 'Failed to delete order.', 'error');
            }

        } else {
            // ── Archive / Unarchive ───────────────────────────────────────────
            const isCurrentlyArchived = currentStatus === 'archived';
            const newStatus = isCurrentlyArchived ? 'confirmed' : 'archived';

            const res = await fetch(`${ADMIN_API_BASE}/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const order = adminOrders.find(o => o.orderId === orderId);
                if (order) order.status = newStatus;
                closeOrderActionModal();
                filterOrdersTable();
                const verb = isCurrentlyArchived ? 'unarchived' : 'archived';
                showAdminToast(`Order ${orderId} ${verb}.`, 'success');
            } else {
                showAdminToast(data.error || 'Failed to update order.', 'error');
            }
        }
    } catch (err) {
        showAdminToast('Network error — could not reach server.', 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }
}

// ─── 6. Registered Customers Viewer ──────────────────────────────────────────

async function loadUsers() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.users)) {
                adminUsers = data.users;
                renderUsersTable();
            }
        }
    } catch (err) {
        console.warn('Failed to load users:', err);
    }
}

function filterUsersTable() {
    const query = (document.getElementById('user-search-input')?.value || '').trim().toLowerCase();
    const filtered = !query
        ? adminUsers
        : adminUsers.filter(u =>
            (u.name || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query)
        );
    renderUsersTable(filtered);
}

function renderUsersTable(list = null) {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    const users = list !== null ? list : adminUsers;

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-slate-500 text-xs">
                    <i class="fa-solid fa-users text-3xl mb-2 text-slate-700"></i>
                    <p>${adminUsers.length === 0 ? 'No customer accounts created yet.' : 'No customers match your search.'}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const dateStr   = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
        const cityState = u.shippingAddress?.city
            ? `${u.shippingAddress.city}, ${u.shippingAddress.state || ''}`
            : '<span class="text-slate-600">Not set</span>';

        // Build initials avatar
        const initials = (u.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors text-xs text-slate-300">
                <td class="py-3 px-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                            ${escapeHtml(initials)}
                        </div>
                        <div>
                            <p class="font-bold text-white">${escapeHtml(u.name || 'User')}</p>
                            <p class="text-[10px] text-slate-500 font-mono">ID: ${escapeHtml(u.id)}</p>
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <p class="text-white">${escapeHtml(u.email || '')}</p>
                    <p class="text-[10px] text-slate-500">${escapeHtml(u.phone || 'No phone on file')}</p>
                </td>
                <td class="py-3 px-4 text-slate-400">
                    ${cityState}
                </td>
                <td class="py-3 px-4 text-slate-400">
                    ${dateStr}
                </td>
                <td class="py-3 px-4 text-right">
                    <button type="button"
                        onclick="openDeleteUserModal('${escapeHtml(u.id)}', '${escapeHtml(u.name || 'User')}', '${escapeHtml(u.email || '')}')"
                        class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer"
                        title="Remove this customer account">
                        <i class="fa-solid fa-user-xmark text-xs"></i>
                        <span>Remove</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ─── Delete Customer Modal Logic ──────────────────────────────────────────────

let _pendingDeleteUserId = null;

function openDeleteUserModal(userId, userName, userEmail) {
    _pendingDeleteUserId = userId;

    document.getElementById('delete-user-name').innerText        = userName;
    document.getElementById('delete-user-email').innerText       = userEmail;
    document.getElementById('delete-user-id-display').innerText  = userId;

    const modal = document.getElementById('delete-user-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
}

function closeDeleteUserModal() {
    _pendingDeleteUserId = null;
    const modal = document.getElementById('delete-user-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
}

async function confirmDeleteUser() {
    if (!_pendingDeleteUserId) return;

    const userId    = _pendingDeleteUserId;
    const token     = getAdminToken();
    const confirmBtn = document.getElementById('confirm-delete-user-btn');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-xs"></i><span>Deleting...</span>';
    }

    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // Remove from local state immediately — no page reload needed
            adminUsers = adminUsers.filter(u => u.id !== userId);
            closeDeleteUserModal();
            filterUsersTable();       // re-render (respects active search filter)
            await loadStats();        // refresh the KPI counter in the header
            showAdminToast('Customer account removed successfully.', 'success');
        } else {
            showAdminToast(data.error || 'Failed to delete customer account.', 'error');
        }
    } catch (err) {
        showAdminToast('Network error — could not reach server.', 'error');
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-trash text-xs"></i><span>Delete Account</span>';
        }
    }
}

// ─── 7. Contact Submissions Management ────────────────────────────────────────

async function loadContactSubmissions() {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/contact`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.submissions)) {
                adminContacts = data.submissions;
                updateContactBadge();
                renderContactSubmissions();
            }
        }
    } catch (err) {
        console.warn('Failed to load contact submissions:', err);
    }
}

function updateContactBadge() {
    const badge = document.getElementById('contact-tab-badge');
    if (!badge) return;
    const unreadCount = adminContacts.filter(c => !c.status || c.status === 'unread').length;
    if (unreadCount > 0) {
        badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function filterContactSubmissions() {
    const searchVal = document.getElementById('contact-search-input')?.value.trim().toLowerCase() || '';
    const statusVal = document.getElementById('contact-filter-status')?.value || 'all';

    const filtered = adminContacts.filter(sub => {
        const matchesStatus = (statusVal === 'all') ||
            (statusVal === 'unread' && (!sub.status || sub.status === 'unread')) ||
            (statusVal === sub.status);

        if (!matchesStatus) return false;

        if (!searchVal) return true;
        const name = (sub.name || '').toLowerCase();
        const email = (sub.email || '').toLowerCase();
        const msg = (sub.message || '').toLowerCase();
        return name.includes(searchVal) || email.includes(searchVal) || msg.includes(searchVal);
    });

    renderContactSubmissions(filtered);
}

function renderContactSubmissions(list = null) {
    const tbody = document.getElementById('admin-contact-table-body');
    if (!tbody) return;

    const items = list !== null ? list : adminContacts;

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-12 text-center text-slate-500 text-xs">
                    <i class="fa-solid fa-inbox text-3xl mb-2 text-slate-700"></i>
                    <p>No customer contact submissions found.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(sub => {
        const dateStr = sub.createdAt ? new Date(sub.createdAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }) : 'N/A';

        const status = sub.status || 'unread';
        let statusBadge = '';
        if (status === 'unread') {
            statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></span>New</span>';
        } else if (status === 'replied') {
            statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><i class="fa-solid fa-reply mr-1 text-[9px]"></i>Replied</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Read</span>';
        }

        const rawMsg = sub.message || '';
        const previewMsg = rawMsg.length > 70 ? rawMsg.substring(0, 70) + '...' : rawMsg;
        const mailtoHref = `mailto:${encodeURIComponent(sub.email || '')}?subject=${encodeURIComponent('Inquiry Response - Bolivar Prints')}`;

        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors text-xs text-slate-300">
                <td class="py-3 px-4">
                    ${statusBadge}
                </td>
                <td class="py-3 px-4">
                    <p class="font-bold text-white">${escapeHtml(sub.name || 'Anonymous')}</p>
                    <a href="${mailtoHref}" class="text-[11px] text-orange-400 hover:text-orange-300 transition-colors flex items-center space-x-1 mt-0.5">
                        <i class="fa-solid fa-envelope text-[10px]"></i>
                        <span>${escapeHtml(sub.email || '')}</span>
                    </a>
                </td>
                <td class="py-3 px-4 max-w-xs text-slate-300 cursor-pointer" onclick="openContactModal('${sub.id}')">
                    <p class="truncate hover:text-white transition-colors" title="Click to view full message">${escapeHtml(previewMsg)}</p>
                </td>
                <td class="py-3 px-4 text-slate-400 whitespace-nowrap">
                    ${dateStr}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <div class="inline-flex items-center space-x-2">
                        <button type="button" onclick="openContactModal('${sub.id}')" title="View Full Message"
                            class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer">
                            <i class="fa-solid fa-eye text-xs"></i>
                        </button>
                        <a href="${mailtoHref}" title="Reply via Email"
                            class="p-2 rounded-lg bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white transition-colors cursor-pointer inline-flex items-center justify-center">
                            <i class="fa-solid fa-reply text-xs"></i>
                        </a>
                        <button type="button" onclick="toggleContactStatus('${sub.id}')" title="Toggle Read/Unread"
                            class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer">
                            <i class="fa-solid ${status === 'unread' ? 'fa-check' : 'fa-envelope'} text-xs"></i>
                        </button>
                        <button type="button" onclick="deleteContactSubmission('${sub.id}')" title="Delete Inquiry"
                            class="p-2 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white transition-colors cursor-pointer">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function updateContactStatus(id, newStatus) {
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/contact/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ status: newStatus }),
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                const item = adminContacts.find(c => c.id === id);
                if (item) item.status = newStatus;
                updateContactBadge();
                filterContactSubmissions();
                return true;
            }
        }
    } catch (err) {
        console.warn('Error updating contact status:', err);
    }
    return false;
}

async function toggleContactStatus(id) {
    const item = adminContacts.find(c => c.id === id);
    if (!item) return;
    const nextStatus = item.status === 'unread' ? 'read' : 'unread';
    const ok = await updateContactStatus(id, nextStatus);
    if (ok) {
        showAdminToast(`Marked inquiry as ${nextStatus}`, 'info');
    }
}

async function deleteContactSubmission(id) {
    if (!confirm('Are you sure you want to permanently delete this contact inquiry?')) {
        return;
    }
    const token = getAdminToken();
    try {
        const res = await fetch(`${ADMIN_API_BASE}/api/contact/${id}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (res.ok) {
            adminContacts = adminContacts.filter(c => c.id !== id);
            updateContactBadge();
            filterContactSubmissions();
            showAdminToast('Contact inquiry deleted', 'success');
        } else {
            showAdminToast('Failed to delete inquiry', 'error');
        }
    } catch (err) {
        showAdminToast('Error connecting to server', 'error');
    }
}

function openContactModal(id) {
    const item = adminContacts.find(c => c.id === id);
    if (!item) return;

    selectedContactModalId = id;

    const modal = document.getElementById('contact-detail-modal');
    const nameEl = document.getElementById('contact-modal-name');
    const emailEl = document.getElementById('contact-modal-email');
    const dateEl = document.getElementById('contact-modal-date');
    const messageEl = document.getElementById('contact-modal-message');
    const statusBadgeEl = document.getElementById('contact-modal-status-badge');
    const statusSelect = document.getElementById('contact-modal-status-select');
    const replyBtn = document.getElementById('contact-modal-reply-btn');

    if (nameEl) nameEl.innerText = item.name || 'Anonymous';
    if (emailEl) emailEl.innerText = item.email || '';
    if (dateEl) {
        dateEl.innerText = item.createdAt ? new Date(item.createdAt).toLocaleString(undefined, {
            dateStyle: 'full',
            timeStyle: 'short',
        }) : '';
    }
    if (messageEl) messageEl.innerText = item.message || '';
    if (statusSelect) statusSelect.value = item.status || 'unread';

    if (statusBadgeEl) {
        const curStatus = item.status || 'unread';
        if (curStatus === 'unread') {
            statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">New / Unread</span>';
        } else if (curStatus === 'replied') {
            statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Replied</span>';
        } else {
            statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Read</span>';
        }
    }

    if (replyBtn) {
        replyBtn.href = `mailto:${encodeURIComponent(item.email || '')}?subject=${encodeURIComponent('Inquiry Response - Bolivar Prints')}`;
        replyBtn.onclick = () => {
            updateContactStatus(id, 'replied');
        };
    }

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // If opening an unread message, auto-mark it as read
    if (!item.status || item.status === 'unread') {
        updateContactStatus(id, 'read');
    }
}

function closeContactModal() {
    const modal = document.getElementById('contact-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    selectedContactModalId = null;
}

async function updateModalContactStatus(newStatus) {
    if (!selectedContactModalId) return;
    const ok = await updateContactStatus(selectedContactModalId, newStatus);
    if (ok) {
        const statusBadgeEl = document.getElementById('contact-modal-status-badge');
        if (statusBadgeEl) {
            if (newStatus === 'unread') {
                statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">New / Unread</span>';
            } else if (newStatus === 'replied') {
                statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Replied</span>';
            } else {
                statusBadgeEl.innerHTML = '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Read</span>';
            }
        }
        showAdminToast(`Inquiry status updated to ${newStatus}`, 'success');
    }
}

// ─── 8. Tab Switching & Utilities ────────────────────────────────────────────

function switchAdminTab(tabName) {
    activeAdminTab = tabName;

    const tabs = ['announcement', 'products', 'orders', 'users', 'contact'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const pane = document.getElementById(`tab-pane-${t}`);

        if (t === tabName) {
            btn?.classList.add('bg-orange-600', 'text-white', 'shadow-md', 'shadow-orange-600/20');
            btn?.classList.remove('text-slate-400', 'hover:text-white');
            pane?.classList.remove('hidden');
        } else {
            btn?.classList.remove('bg-orange-600', 'text-white', 'shadow-md', 'shadow-orange-600/20');
            btn?.classList.add('text-slate-400', 'hover:text-white');
            pane?.classList.add('hidden');
        }
    });
}

function showAdminToast(msg, type = 'info') {
    let container = document.getElementById('admin-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'admin-toast-container';
        container.className = 'fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const color = type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        : type === 'error'
        ? 'bg-red-950/90 border-red-500/40 text-red-200'
        : 'bg-slate-900/90 border-slate-700 text-slate-200';

    const icon = type === 'success'
        ? 'fa-circle-check text-emerald-400'
        : type === 'error'
        ? 'fa-circle-exclamation text-red-400'
        : 'fa-circle-info text-orange-400';

    toast.className = `p-3 rounded-2xl border text-xs shadow-2xl backdrop-blur-md flex items-center space-x-2 animate-fade-in ${color}`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} shrink-0"></i>
        <span>${escapeHtml(msg)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── 8. DOM Load Initialization ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Enforce dark mode on the admin dashboard
    document.body.classList.add('dark');

    verifyAdminAccess();

    // Hook live preview on setting inputs
    ['setting-banner-enabled', 'setting-banner-text', 'setting-banner-badge', 'setting-banner-link-text', 'setting-banner-link-url'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateLiveBannerPreview);
            el.addEventListener('change', updateLiveBannerPreview);
        }
    });
});
