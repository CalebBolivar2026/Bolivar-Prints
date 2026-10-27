/**
 * Bolivar Prints — Custom Order Logic
 * Handles file upload, drag-and-drop, real-time live price estimation,
 * post-processing card toggles, and quote submission to the cart.
 *
 * Wrapped in an IIFE to avoid `const` redeclaration conflicts with cart.js
 */
(function() {
    'use strict';

    const CO_API = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

    // ─── Pricing (mirrors backend/config/pricing.js) ──────────────────────────
    const PRICING = {
        material: {
            'PLA+':         12.00,
            'PETG':         15.00,
            'Silk PLA':     18.00,
            'ABS':          16.00,
            'TPU':          20.00,
            'Carbon Fiber': 28.00,
            'Not Sure':     12.00,
        },
        infill: {
            'standard': 1.0,
            'sturdy':   1.25,
            'solid':    1.55,
        },
        urgency: {
            'standard': 1.0,
            'rush':     1.30,
        },
        postProcess: {
            'support_removal': 3.00,
            'sanding':         6.00,
        },
    };

    // ─── State ────────────────────────────────────────────────────────────────
    let selectedFiles = [];

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function parseQty(val) {
        const n = parseInt(val, 10);
        return (isFinite(n) && n >= 1) ? n : 1;
    }

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function $(id) { return document.getElementById(id); }

    function getPostProc() {
        const list = [];
        if ($('pp-raw')?.checked)     list.push('Raw Print');
        if ($('pp-support')?.checked) list.push('Support Removal');
        if ($('pp-sand')?.checked)    list.push('Sanding & Polish');
        return list.length ? list : ['Raw Print'];
    }

    function getPostProcCost() {
        let c = 0;
        if ($('pp-support')?.checked) c += PRICING.postProcess.support_removal;
        if ($('pp-sand')?.checked)    c += PRICING.postProcess.sanding;
        return c;
    }

    // ─── Live Price Calculation ───────────────────────────────────────────────

    function calcEstimate() {
        const material   = $('cust-material')?.value || 'PLA+';
        const infillKey  = $('cust-infill')?.value   || 'standard';
        const urgencyKey = $('cust-urgency')?.value  || 'standard';
        const qty        = parseQty($('cust-quantity')?.value);

        const base       = PRICING.material[material]  ?? 12.00;
        const infillMult = PRICING.infill[infillKey]    ?? 1.0;
        const urgMult    = PRICING.urgency[urgencyKey]  ?? 1.0;
        const ppCost     = getPostProcCost();

        const unit  = (base * infillMult * urgMult) + ppCost;
        const total = unit * qty;

        return {
            material, base, infillMult, urgMult, ppCost,
            unit: +unit.toFixed(2),
            total: +total.toFixed(2),
            qty
        };
    }

    function refreshEstimate() {
        const e = calcEstimate();
        const bd = $('estimate-breakdown');
        const tt = $('estimate-total');
        const ur = $('estimate-unit-rate');
        if (!bd || !tt) return;

        const parts = [];
        parts.push(`<span class="text-white font-medium">${e.material}</span> Base: <span class="text-slate-300 font-semibold">$${e.base.toFixed(2)}</span>`);
        if (e.infillMult !== 1.0) parts[0] += ` × ${e.infillMult.toFixed(2)} infill`;
        if (e.urgMult    !== 1.0) parts[0] += ` × 1.30 rush`;
        if (e.ppCost     >  0)   parts[0] += ` + $${e.ppCost.toFixed(2)} post-processing`;

        bd.innerHTML = `
            <p>${parts[0]}</p>
            <p>Unit Rate: <span class="text-orange-400 font-semibold">$${e.unit.toFixed(2)}</span> × ${e.qty} ${e.qty === 1 ? 'part' : 'parts'}</p>
        `;
        tt.textContent = `$${e.total.toFixed(2)}`;
        if (ur) ur.textContent = `$${e.unit.toFixed(2)}`;
    }

    // expose globally so inline onchange= attributes work
    window.updateEstimateUI = refreshEstimate;

    // ─── Post-Processing Card Toggle ──────────────────────────────────────────

    window.togglePostProcess = function(key) {
        const ids = {
            raw:     { cb: 'pp-raw',     card: 'card-pp-raw',     chk: 'pp-raw-check'     },
            support: { cb: 'pp-support', card: 'card-pp-support', chk: 'pp-support-check' },
            sand:    { cb: 'pp-sand',    card: 'card-pp-sand',    chk: 'pp-sand-check'    },
        };
        const t = ids[key];
        if (!t) return;

        const cb   = $(t.cb);
        const card = $(t.card);
        const chk  = $(t.chk);
        if (!cb) return;

        cb.checked = !cb.checked;

        if (card && chk) {
            const icon = chk.querySelector('i');
            if (cb.checked) {
                card.classList.add('border-orange-500/50', 'bg-orange-500/5');
                card.classList.remove('border-slate-800', 'bg-slate-950');
                chk.classList.add('border-orange-500', 'bg-orange-600/20');
                chk.classList.remove('border-slate-700', 'bg-slate-900');
                if (icon) icon.classList.remove('hidden');
            } else {
                card.classList.remove('border-orange-500/50', 'bg-orange-500/5');
                card.classList.add('border-slate-800', 'bg-slate-950');
                chk.classList.remove('border-orange-500', 'bg-orange-600/20');
                chk.classList.add('border-slate-700', 'bg-slate-900');
                if (icon) icon.classList.add('hidden');
            }
        }

        refreshEstimate();
    };

    // ─── File Upload ──────────────────────────────────────────────────────────

    window.triggerFileSelect = function() {
        const inp = $('cust-file');
        if (inp) inp.click();
    };

    window.handleFileSelect = function(ev) {
        if (ev.target.files && ev.target.files.length > 0) {
            selectedFiles = Array.from(ev.target.files);
            showFileUI();
        }
    };

    window.clearSelectedFiles = function(ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        selectedFiles = [];
        const inp = $('cust-file');
        if (inp) inp.value = '';
        const es = $('file-empty-state');
        const ss = $('file-selected-state');
        if (es) es.classList.remove('hidden');
        if (ss) ss.classList.add('hidden');
    };

    function showFileUI() {
        const es = $('file-empty-state');
        const ss = $('file-selected-state');
        if (!es || !ss) return;
        es.classList.add('hidden');
        ss.classList.remove('hidden');

        const badge = $('file-count-badge');
        if (badge) badge.textContent = selectedFiles.length === 1
            ? '1 File Attached'
            : `${selectedFiles.length} Files Attached`;

        const list = $('file-details-list');
        if (list) {
            list.innerHTML = selectedFiles.map(f => `
                <div class="flex items-center justify-center space-x-2 text-xs">
                    <i class="fa-solid fa-cube text-orange-400"></i>
                    <span class="text-white font-semibold truncate max-w-xs">${f.name}</span>
                    <span class="text-slate-400">(${fmtSize(f.size)})</span>
                </div>
            `).join('');
        }
    }

    function setupDragDrop() {
        const zone = $('file-drop-zone');
        if (!zone) return;

        ['dragenter','dragover'].forEach(evt => {
            zone.addEventListener(evt, e => {
                e.preventDefault(); e.stopPropagation();
                zone.classList.add('border-orange-500', 'bg-orange-500/10');
            });
        });
        ['dragleave','drop'].forEach(evt => {
            zone.addEventListener(evt, e => {
                e.preventDefault(); e.stopPropagation();
                zone.classList.remove('border-orange-500', 'bg-orange-500/10');
            });
        });
        zone.addEventListener('drop', e => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                selectedFiles = Array.from(files);
                // sync the hidden input so it shows up in FormData later
                try { $('cust-file').files = files; } catch(_) {}
                showFileUI();
            }
        });
    }

    // ─── Add Custom Quote to Cart ─────────────────────────────────────────────

    window.handleAddCustomQuote = function(ev) {
        if (ev) ev.preventDefault();

        const est = calcEstimate();

        const material   = $('cust-material')?.value || 'PLA+';
        const color      = ($('cust-color')?.value || 'Any').trim() || 'Any';
        const infillVal  = $('cust-infill')?.value   || 'standard';
        const urgencyVal = $('cust-urgency')?.value  || 'standard';
        const postProc   = getPostProc();
        const notes      = $('cust-notes')?.value    || '';

        const infillLabel = {
            standard: 'Standard (15–20%)',
            sturdy:   'Sturdy (30–40%)',
            solid:    'Solid / Heavy-Duty (80–100%)',
        };
        const urgencyLabel = {
            standard: 'Standard (2–5 business days)',
            rush:     'Rush (1–2 business days)',
        };

        // file names
        let fileSummary = 'No file attached';
        if (selectedFiles.length > 0) {
            fileSummary = selectedFiles.map(f => f.name).join(', ');
        } else {
            const inp = $('cust-file');
            if (inp?.files?.length > 0) fileSummary = Array.from(inp.files).map(f => f.name).join(', ');
        }

        const cartItem = {
            id:       'custom_' + Date.now(),
            name:     `Custom 3D Print — ${material} (${color})`,
            price:    est.unit,
            image:    null,
            color:    color,
            quantity: est.qty,
            meta: {
                type:               'custom',
                fileName:           fileSummary,
                material,
                color,
                infill:             infillLabel[infillVal] || infillVal,
                urgency:            urgencyLabel[urgencyVal] || urgencyVal,
                postProcessing:     postProc,
                estimatedUnitPrice: est.unit,
                estimatedTotal:     est.total,
                instructions:       notes,
                verifiedByServer:   true,
            },
        };

        // 1. Add to cart (shared cart.js function)
        if (typeof addToCart === 'function') {
            addToCart(cartItem);
        } else {
            // fallback direct localStorage
            const arr = JSON.parse(localStorage.getItem('bolivar_cart') || '[]');
            arr.push(cartItem);
            localStorage.setItem('bolivar_cart', JSON.stringify(arr));
            const badge = $('cart-badge');
            if (badge) {
                badge.textContent = arr.reduce((s,i) => s + (i.quantity||1), 0);
                badge.classList.add('scale-125');
                setTimeout(() => badge.classList.remove('scale-125'), 200);
            }
        }

        // 2. Button feedback
        const btn = $('add-to-cart-btn');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = `
                <div class="flex items-center space-x-2 text-white font-bold">
                    <i class="fa-solid fa-circle-check text-emerald-300 text-base"></i>
                    <span>Quote Added to Cart!</span>
                </div>
            `;
            btn.classList.remove('from-orange-600','via-orange-500','to-amber-500');
            btn.classList.add('from-emerald-600','via-emerald-500','to-teal-500');

            setTimeout(() => {
                btn.innerHTML = orig;
                btn.classList.remove('from-emerald-600','via-emerald-500','to-teal-500');
                btn.classList.add('from-orange-600','via-orange-500','to-amber-500');
            }, 3000);
        }

        // 3. Toast
        if (typeof showToast === 'function') {
            showToast(`Custom quote added! ($${est.total.toFixed(2)})`);
        }

        // 4. Background upload to backend (non-blocking)
        if (selectedFiles.length > 0) {
            const fd = new FormData();
            selectedFiles.forEach(f => fd.append('modelFiles', f));
            fd.append('material', material);
            fd.append('infill', infillVal);
            fd.append('urgency', urgencyVal);
            fd.append('color', color);
            fd.append('quantity', String(est.qty));
            fd.append('postProcessing', JSON.stringify(postProc));
            fd.append('instructions', notes);
            fetch(CO_API + '/api/custom-order/quote', { method: 'POST', body: fd })
                .catch(err => console.debug('Background upload:', err.message));
        }
    };

    // ─── Init ─────────────────────────────────────────────────────────────────

    function init() {
        setupDragDrop();
        refreshEstimate();

        // guard against Enter-key form submit
        const form = $('custom-order-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                handleAddCustomQuote(e);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
