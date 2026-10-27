/**
 * Bolivar Prints - Product Detail Script
 * Handles product detail display, dynamic image rendering, color selection,
 * and Add to Cart functionality.
 */

const API_BASE_PRODUCT = (window.location.protocol !== 'file:' && window.location.port === '3000') ? '' : 'http://localhost:3000';

let currentProduct = {
    id: "crystal-dragon",
    name: "Articulated Crystal Dragon",
    price: 24.99,
    tag: "Silk Filament",
    icon: "fa-dragon",
    description: "Flexible, multi-segment print featuring a mesmerizing silk dual-tone color shift. Printed on high-performance Bambu Lab equipment with optimized tolerances for silky smooth articulation. Great desk companion or statement gift.",
    colors: ["Silk Gold", "Matte Black", "Galaxy Blue"],
    image: null,
};

let selectedColor = "Silk Gold";

// Global function: Color selection handler
window.selectColor = function(btnEl, colorName) {
    selectedColor = colorName;
    // expose globally for debugging / external access
    window.selectedColor = selectedColor;

    const allBtns = document.querySelectorAll('.color-option-btn');
    allBtns.forEach(b => {
        b.classList.remove('bg-orange-600', 'text-white', 'border-orange-500');
        b.classList.add('bg-slate-900', 'text-slate-300', 'border-slate-800');
    });

    if (btnEl) {
        btnEl.classList.remove('bg-slate-900', 'text-slate-300', 'border-slate-800');
        btnEl.classList.add('bg-orange-600', 'text-white', 'border-orange-500');
    }
};

// Global function: Add to Cart from product detail page
window.handleDetailAddToCart = function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const itemToAdd = {
        id: currentProduct.id,
        name: currentProduct.name,
        price: currentProduct.price,
        image: currentProduct.image || null,
        color: selectedColor,
        quantity: 1,
    };

    if (typeof addToCart === 'function') {
        addToCart(itemToAdd);
    } else {
        const storedCart = JSON.parse(localStorage.getItem('bolivar_cart')) || [];
        const existingIndex = storedCart.findIndex(
            it => it.id === itemToAdd.id && it.color === itemToAdd.color
        );
        if (existingIndex > -1) {
            storedCart[existingIndex].quantity += 1;
        } else {
            storedCart.push(itemToAdd);
        }
        localStorage.setItem('bolivar_cart', JSON.stringify(storedCart));

        const totalCount = storedCart.reduce((sum, it) => sum + (it.quantity || 1), 0);
        const badge = document.getElementById('cart-badge');
        if (badge) {
            badge.innerText = totalCount;
            badge.classList.add('scale-125');
            setTimeout(() => badge.classList.remove('scale-125'), 200);
        }

        if (typeof showToast === 'function') {
            showToast(`Added "${itemToAdd.name}" to cart!`);
        }
    }

    // Confirmation feedback
    const btn = document.getElementById('add-to-cart-detail-btn');
    if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check text-sm mr-2"></i><span>Added to Cart!</span>`;
        btn.classList.remove('bg-orange-600', 'hover:bg-orange-500');
        btn.classList.add('bg-emerald-600', 'hover:bg-emerald-500');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
            btn.classList.add('bg-orange-600', 'hover:bg-orange-500');
        }, 1500);
    }
};

async function loadProductDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || 'crystal-dragon';

    try {
        const response = await fetch(`${API_BASE_PRODUCT}/api/products/${productId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.product) {
                currentProduct = data.product;
            }
        }
    } catch (err) {
        console.debug('Loaded detail from local fallback:', err.message);
    }

    populateProductUI();
}

function populateProductUI() {
    const titleEl = document.getElementById('product-title');
    const priceEl = document.getElementById('product-price');
    const descEl = document.getElementById('product-description');
    const tagEl = document.getElementById('product-tag');
    const iconContainer = document.getElementById('product-icon-container');
    const colorsContainer = document.getElementById('color-options');

    if (titleEl) titleEl.innerText = currentProduct.name;
    if (priceEl) priceEl.innerText = '$' + currentProduct.price.toFixed(2);
    if (descEl) descEl.innerText = currentProduct.description || 'High precision 3D additive manufactured model.';
    if (tagEl) tagEl.innerText = currentProduct.tag || 'Precision Print';
    document.title = `${currentProduct.name} | Bolivar Prints`;

    // Picture vs Icon display
    if (iconContainer) {
        if (currentProduct.image) {
            iconContainer.innerHTML = `
                <img src="${currentProduct.image}" alt="${currentProduct.name}"
                    class="max-h-80 sm:max-h-96 max-w-full rounded-2xl object-contain shadow-2xl relative z-10 transition-transform duration-300 hover:scale-105"
                    onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fa-solid ${currentProduct.icon || 'fa-cube'}\\'></i>';">
            `;
        } else {
            iconContainer.innerHTML = `<i class="fa-solid ${currentProduct.icon || 'fa-cube'}"></i>`;
        }
    }

    // Dynamic Colors Buttons
    if (colorsContainer && Array.isArray(currentProduct.colors) && currentProduct.colors.length > 0) {
        selectedColor = currentProduct.colors[0];
        colorsContainer.innerHTML = currentProduct.colors.map((c, i) => `
            <button type="button" onclick="selectColor(this, '${c}')"
                class="color-option-btn p-3 rounded-xl ${i === 0 ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'} font-semibold text-xs transition-all cursor-pointer border"
                data-color="${c}">
                ${c}
            </button>
        `).join('');
    }

    const btn = document.getElementById('add-to-cart-detail-btn');
    if (btn) {
        if (currentProduct.inStock === false) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-ban text-sm mr-2"></i><span>Currently Out of Stock</span>`;
            btn.className = 'w-full py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 font-bold text-sm tracking-wide uppercase flex items-center justify-center cursor-not-allowed';
        } else {
            btn.onclick = window.handleDetailAddToCart;
        }
    }
}

document.addEventListener('DOMContentLoaded', loadProductDetail);
