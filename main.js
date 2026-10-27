/**
 * Bolivar Prints - Main Frontend Logic
 * Handles global UI updates, toasts, navigation.
 */

// Toast notification pop-up for user feedback
function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed bottom-5 right-5 bg-orange-600 text-white px-5 py-3 rounded-xl shadow-xl z-[9999] transition-opacity duration-300 opacity-0 text-sm font-semibold';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    // Clear any existing hide timer
    clearTimeout(toast._hideTimer);
    toast.classList.remove('opacity-0');
    toast._hideTimer = setTimeout(() => toast.classList.add('opacity-0'), 3000);
}

// Initialize global UI components on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn    = document.getElementById('theme-toggle');
    const themeIcon         = document.getElementById('theme-icon');
    const themeToggleMobile = document.getElementById('theme-toggle-mobile');
    const themeIconMobile   = document.getElementById('theme-icon-mobile');

    // Apply saved theme on load (default: dark)
    const currentTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(currentTheme);

    // Shared function: applies theme and syncs both icon buttons
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            if (themeIcon)       themeIcon.className       = 'fa-solid fa-moon text-orange-400';
            if (themeIconMobile) themeIconMobile.className = 'fa-solid fa-moon text-orange-400';
        } else {
            document.body.classList.remove('dark');
            if (themeIcon)       themeIcon.className       = 'fa-solid fa-sun text-orange-500';
            if (themeIconMobile) themeIconMobile.className = 'fa-solid fa-sun text-orange-500';
        }
        localStorage.setItem('theme', theme);
    }

    // Toggle handler shared by both buttons
    function handleToggle() {
        const isDark = document.body.classList.contains('dark');
        applyTheme(isDark ? 'light' : 'dark');
    }

    if (themeToggleBtn)    themeToggleBtn.addEventListener('click',    handleToggle);
    if (themeToggleMobile) themeToggleMobile.addEventListener('click', handleToggle);
});

// ─── Scroll-spy: highlight About & Contact nav links ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const NAV_HEIGHT = 80; // matches h-20 (5rem = 80px)

    const spySections = [
        { sectionId: 'about',   linkId: 'nav-about'   },
        { sectionId: 'contact', linkId: 'nav-contact'  },
    ];

    const activeClass    = ['text-orange-400', 'font-semibold'];
    const inactiveClass  = ['hover:text-orange-400', 'transition-colors'];

    function setActive(linkEl, active) {
        if (!linkEl) return;
        if (active) {
            inactiveClass.forEach(c => linkEl.classList.remove(c));
            activeClass.forEach(c => linkEl.classList.add(c));
        } else {
            activeClass.forEach(c => linkEl.classList.remove(c));
            inactiveClass.forEach(c => linkEl.classList.add(c));
        }
    }

    // IntersectionObserver watches each section; fires when ≥30% is visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const match = spySections.find(s => s.sectionId === entry.target.id);
            if (!match) return;
            const linkEl = document.getElementById(match.linkId);
            setActive(linkEl, entry.isIntersecting);
        });
    }, {
        rootMargin: `-${NAV_HEIGHT}px 0px -40% 0px`,
        threshold: 0,
    });

    spySections.forEach(({ sectionId }) => {
        const el = document.getElementById(sectionId);
        if (el) observer.observe(el);
    });
});

// ─── Contact Form Submission Handler ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form') || document.querySelector('#contact form');
    if (!contactForm) return;

    const nameInput    = document.getElementById('contact-name') || contactForm.querySelector('input[type="text"]');
    const emailInput   = document.getElementById('contact-email') || contactForm.querySelector('input[type="email"]');
    const messageInput = document.getElementById('contact-message') || contactForm.querySelector('textarea');
    const submitBtn    = document.getElementById('contact-submit-btn') || contactForm.querySelector('button[type="submit"]');
    const statusBox    = document.getElementById('contact-status');

    // Auto-fill logged-in customer's details if available
    try {
        const storedUser = localStorage.getItem('bolivar_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user && nameInput && !nameInput.value) {
                nameInput.value = user.name || user.username || '';
            }
            if (user && emailInput && !emailInput.value) {
                emailInput.value = user.email || '';
            }
        }
    } catch {
        // Ignore JSON parse errors
    }

    function setFormStatus(message, type = 'success') {
        if (!statusBox) return;
        statusBox.classList.remove('hidden', 'bg-emerald-500/10', 'border-emerald-500/30', 'text-emerald-400', 'bg-red-500/10', 'border-red-500/30', 'text-red-400');
        if (type === 'success') {
            statusBox.className = 'p-4 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center space-x-2';
            statusBox.innerHTML = `<i class="fa-solid fa-circle-check text-sm"></i> <span>${message}</span>`;
        } else {
            statusBox.className = 'p-4 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center space-x-2';
            statusBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-sm"></i> <span>${message}</span>`;
        }
    }

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name    = nameInput ? nameInput.value.trim() : '';
        const email   = emailInput ? emailInput.value.trim() : '';
        const message = messageInput ? messageInput.value.trim() : '';

        if (!name || !email || !message) {
            setFormStatus('Please fill out all required fields before submitting.', 'error');
            return;
        }

        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Message';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Sending Message...</span>';
        }
        if (statusBox) statusBox.classList.add('hidden');

        const apiBase = (window.location.protocol !== 'file:' && window.location.port === '3000') ? '' : 'http://localhost:3000';

        try {
            const response = await fetch(`${apiBase}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, message }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setFormStatus('Thank you! Your message has been sent successfully. We will get back to you shortly.', 'success');
                showToast('Message sent to Bolivar Prints!');
                if (messageInput) messageInput.value = '';
            } else {
                const errorMsg = data.error || 'Unable to submit your message. Please try again.';
                setFormStatus(errorMsg, 'error');
                showToast(errorMsg);
            }
        } catch (err) {
            console.error('Contact form submission error:', err);
            const fallbackMsg = 'Network error: could not connect to server. Please try again later.';
            setFormStatus(fallbackMsg, 'error');
            showToast('Unable to connect to server');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    });
});