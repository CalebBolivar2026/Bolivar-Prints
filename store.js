/**
 * Bolivar Prints - Store Catalog & Category Filter Controller
 * Handles live product catalog fetching, category filtering (All, Decorative, Toys, Holiday, Functional),
 * responsive UI state updates, and quick Add-to-Cart actions.
 */

(function () {
    'use strict';

    const API_BASE = (window.location.protocol !== 'file:' && window.location.port === '3000') ? '' : 'http://localhost:3000';

    // State
    let allProducts = [];
    let activeFilter = 'all';

    // Fallback products catalog if backend is unreachable
    const FALLBACK_PRODUCTS = [
        {
            id: 'crystal-dragon',
            name: 'Articulated Crystal Dragon',
            price: 24.99,
            category: 'decor',
            tag: 'Silk Dual-Tone',
            icon: 'fa-dragon',
            description: 'Flexible, multi-segment print featuring a mesmerizing silk dual-tone color shift.',
            inStock: true,
            image: null
        },
        {
            id: 'low-poly-planter',
            name: 'Geometric Faceted Planter',
            price: 18.50,
            category: 'decor',
            tag: 'Modern Decor',
            icon: 'fa-seedling',
            description: 'Contemporary faceted planter engineered with drainage holes and catch tray.',
            inStock: true,
            image: null
        },
        {
            id: 'articulated-axolotl',
            name: 'Articulated Flexi Axolotl',
            price: 16.99,
            category: 'toys',
            tag: 'Articulated Fidget',
            icon: 'fa-fish',
            description: 'Wiggle-ready, print-in-place articulated axolotl with expressive gills and fluid movement.',
            inStock: true,
            image: null
        },
        {
            id: 'infinity-fidget-cube',
            name: 'Precision Infinity Fidget Cube',
            price: 12.99,
            category: 'toys',
            tag: 'Mechanical Fidget',
            icon: 'fa-cubes',
            description: 'Seamless interlocking hinge cube that folds continuously inward and outward.',
            inStock: true,
            image: null
        },
        {
            id: 'skull-pumpkin-lantern',
            name: "Faceted Jack-O'-Lantern Tealight",
            price: 19.99,
            category: 'holiday',
            tag: 'Halloween Special',
            icon: 'fa-ghost',
            description: 'Low-poly stylized pumpkin votive with hollow interior for safe LED tealights.',
            inStock: true,
            image: null
        },
        {
            id: 'hex-cable-organizer',
            name: 'Modular Hex Desktop Cable Hive',
            price: 14.50,
            category: 'functional',
            tag: 'Desk Organization',
            icon: 'fa-network-wired',
            description: 'Interlocking hexagonal organizers with weighted base channels for routing charging cords.',
            inStock: true,
            image: null
        }
    ];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Matches product category to the active filter key.
     */
    function matchesCategory(productCategory, filter) {
        if (!filter || filter === 'all') return true;
        const cat = (productCategory || '').trim().toLowerCase();
        const f = filter.trim().toLowerCase();

        if (f === 'decor' || f === 'decorative') {
            return cat === 'decor' || cat === 'decorative';
        }
        if (f === 'toys' || f === 'toy') {
            return cat === 'toys' || cat === 'toy';
        }
        if (f === 'holiday' || f === 'seasonal') {
            return cat === 'holiday' || cat === 'seasonal';
        }
        if (f === 'functional' || f === 'desk') {
            return cat === 'functional' || cat === 'desk';
        }

        return cat === f;
    }

    /**
     * Updates button visual classes based on the current active filter.
     */
    function syncFilterButtonUI(selectedFilter) {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            const filterKey = btn.getAttribute('data-filter') || 'all';
            if (filterKey === selectedFilter) {
                btn.className = 'filter-btn px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold shadow-md shadow-orange-600/20 transition-all cursor-pointer';
            } else {
                btn.className = 'filter-btn px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer';
            }
        });
    }

    /**
     * Renders products according to the active category filter.
     */
    function renderStoreGrid() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;

        const filtered = allProducts.filter(p => matchesCategory(p.category, activeFilter));

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-20 text-center text-slate-500 space-y-4">
                    <div class="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-2xl mx-auto">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <div>
                        <p class="text-lg font-bold text-white">No products found in this category</p>
                        <p class="text-xs text-slate-400 mt-1">Try selecting another filter above or view all products.</p>
                    </div>
                    <button type="button" onclick="window.applyProductFilter('all')"
                        class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer inline-flex items-center space-x-2">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                        <span>Show All Products</span>
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const tagText = escapeHtml(p.tag || 'Precision Print');
            const iconClass = escapeHtml(p.icon || 'fa-cube');
            const isStock = p.inStock !== false;
            const price = typeof p.price === 'number' ? p.price.toFixed(2) : parseFloat(p.price || 0).toFixed(2);

            const stockBadge = !isStock
                ? `<span class="absolute bottom-4 left-4 z-20 px-3 py-1 rounded-full bg-red-950/80 backdrop-blur-md border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-wider">Sold Out</span>`
                : '';

            const mediaHtml = p.image
                ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${!isStock ? 'opacity-60 grayscale' : ''}"/>`
                : `<div class="flex flex-col items-center justify-center p-6 text-center h-full">
                       <div class="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 group-hover:bg-orange-500/20 transition-all duration-500 shadow-lg shadow-orange-500/10 mb-2 ${!isStock ? 'opacity-40' : ''}">
                           <i class="fa-solid ${iconClass} text-3xl"></i>
                       </div>
                       <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${escapeHtml(p.category || '3D Print')}</span>
                   </div>`;

            const actionBtn = isStock
                ? `<button type="button" onclick="window.handleQuickAdd('${p.id}', this)" class="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-orange-600/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer">
                       <i class="fa-solid fa-cart-plus text-xs"></i>
                       <span>Add to Cart</span>
                   </button>`
                : `<button type="button" disabled class="w-full py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 font-semibold text-xs tracking-wider uppercase flex items-center justify-center space-x-1.5 cursor-not-allowed">
                       <i class="fa-solid fa-ban text-xs"></i>
                       <span>Out of Stock</span>
                   </button>`;

            return `
                <div class="product-card bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between hover:border-orange-500/50 transition-all group relative" data-category="${escapeHtml(p.category || 'decor')}">
                    <a href="product-detail.html?id=${encodeURIComponent(p.id)}" class="block relative h-64 bg-slate-950 overflow-hidden flex items-center justify-center">
                        <div class="absolute inset-0 bg-gradient-to-tr from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"></div>
                        <span class="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-orange-400 text-xs font-semibold">${tagText}</span>
                        ${stockBadge}
                        ${mediaHtml}
                    </a>
                    <div class="p-6 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <a href="product-detail.html?id=${encodeURIComponent(p.id)}">
                                    <h3 class="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">${escapeHtml(p.name)}</h3>
                                </a>
                                <span class="text-lg font-extrabold text-orange-400">$${price}</span>
                            </div>
                            <p class="text-slate-400 text-sm leading-relaxed mb-6 line-clamp-2">${escapeHtml(p.description || '')}</p>
                        </div>
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Applies a new category filter, updates active styles, and re-renders grid.
     */
    function applyFilter(filterKey) {
        activeFilter = filterKey || 'all';
        syncFilterButtonUI(activeFilter);
        renderStoreGrid();
    }

    // Expose applyFilter to window for inline calls if needed
    window.applyProductFilter = applyFilter;

    /**
     * Initializes filter buttons with click events.
     */
    function initFilterControls() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const filterKey = btn.getAttribute('data-filter') || 'all';
                applyFilter(filterKey);
            });
        });
    }

    /**
     * Quick Add-To-Cart handler from the store catalog cards.
     */
    window.handleQuickAdd = function (productId, btnEl) {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        if (typeof addToCart === 'function') {
            addToCart(product);
        } else {
            console.warn('addToCart function not found in global scope');
        }

        if (btnEl) {
            const originalHtml = btnEl.innerHTML;
            btnEl.disabled = true;
            btnEl.classList.remove('bg-orange-600', 'hover:bg-orange-500');
            btnEl.classList.add('bg-emerald-600', 'hover:bg-emerald-500');
            btnEl.innerHTML = '<i class="fa-solid fa-check text-xs mr-1"></i><span>Added!</span>';

            setTimeout(() => {
                btnEl.classList.remove('bg-emerald-600', 'hover:bg-emerald-500');
                btnEl.classList.add('bg-orange-600', 'hover:bg-orange-500');
                btnEl.innerHTML = originalHtml;
                btnEl.disabled = false;
            }, 1200);
        }
    };

    /**
     * Fetches products from backend API, checks URL parameters, and initializes store.
     */
    async function initStore() {
        initFilterControls();

        // Check if a category was passed in the URL (e.g. store.html?category=toys or store.html#holiday)
        const urlParams = new URLSearchParams(window.location.search);
        const queryCat = urlParams.get('category');
        const hashCat = window.location.hash ? window.location.hash.replace('#', '') : null;
        const initialFilter = queryCat || hashCat || 'all';

        if (['decor', 'decorative', 'toys', 'toy', 'holiday', 'seasonal', 'functional', 'desk'].includes(initialFilter.toLowerCase())) {
            activeFilter = initialFilter.toLowerCase();
        }

        syncFilterButtonUI(activeFilter);

        try {
            const res = await fetch(`${API_BASE}/api/products`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.products) && data.products.length > 0) {
                    allProducts = data.products;
                } else {
                    allProducts = FALLBACK_PRODUCTS;
                }
            } else {
                allProducts = FALLBACK_PRODUCTS;
            }
        } catch (err) {
            console.warn('Backend unavailable, using fallback catalog:', err);
            allProducts = FALLBACK_PRODUCTS;
        }

        window.__storeProducts = allProducts;
        renderStoreGrid();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStore);
    } else {
        initStore();
    }
})();
