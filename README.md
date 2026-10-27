# Bolivar Prints — 3D Printing E-Commerce Architecture

High-precision custom 3D printing and catalog e-commerce platform.

## Architecture

The project is structured with strict separation of concerns between client assets and server authority:

```
Bolivar Prints/
├── frontend/               # Public client website
│   ├── index.html          # Homepage & brand introduction
│   ├── store.html          # Product catalog with category filtering
│   ├── product-detail.html # Interactive product view with dynamic color options
│   ├── custom-order.html   # Custom 3D print quote configurator & file upload
│   ├── account.html        # User account dashboard (Order history, shipping addresses, profile)
│   ├── account.js          # Account dashboard controller & past order loader
│   ├── auth.js             # Global authentication manager, navbar profile dropdown & modal
│   ├── cart.html           # Full shopping cart review & summary page
│   ├── checkout.html       # Dedicated checkout page & integrated payment gateway
│   ├── checkout.js         # Checkout controller, dynamic cart adjustments, card visualizer & payment gateway
│   ├── cart.js             # Cart state, slide-over drawer & server validation
│   ├── cart-page.js        # Full cart line-item rendering & verified checkout
│   ├── custom-order.js     # Multi-file validation, live UI estimator & server quoting
│   ├── product.js          # Product detail page logic
│   ├── store.js            # Store grid rendering & category filtering
│   └── style.css           # Styling extensions
│
├── backend/                # Authoritative server engine (Protected from client tampering)
│   ├── server.js           # Express API server & static frontend host
│   ├── config/
│   │   └── pricing.js      # Single source of truth for materials, infill, urgency rates
│   ├── data/
│   │   ├── products.json   # Authoritative catalog database with verified prices
│   │   ├── users.json      # Secure user accounts database with salted password hashes
│   │   └── orders.json     # Permanent order ledger linked to user accounts
│   ├── routes/
│   │   ├── auth.js         # User registration, login, profile updates, and order history
│   │   ├── products.js     # GET /api/products, photo upload, product management
│   │   ├── customOrder.js  # POST /api/custom-order/quote, POST /estimate
│   │   ├── cart.js         # POST /api/cart/validate (tamper detection & sanitization)
│   │   └── checkout.js     # POST /api/checkout (server-verified order creation)
│   └── uploads/            # Secure storage for uploaded 3D files and product photos
│
├── package.json            # Root scripts
├── STARTUP_AND_GIT_GUIDE.md # Terminal startup & Git commit/push instructions
└── README.md
```

> [!NOTE]
> For complete step-by-step terminal instructions on running the app, troubleshooting ports, and pushing code to GitHub, see [STARTUP_AND_GIT_GUIDE.md](file:///Users/calebbolivar/Desktop/Bolivar%20Prints/STARTUP_AND_GIT_GUIDE.md).

## Security & Anti-Tampering Features

- **Authoritative Server Pricing:** All product prices and custom print calculations are strictly evaluated on the server in [backend/config/pricing.js](file:///Users/calebbolivar/Desktop/Bolivar%20Prints/backend/config/pricing.js) and [backend/data/products.json](file:///Users/calebbolivar/Desktop/Bolivar%20Prints/backend/data/products.json).
- **Cart Validation Engine:** Even if a user attempts to alter line-item prices in browser DevTools or `localStorage`, the backend endpoint `/api/cart/validate` instantly identifies tampered items and restores the true store prices before checkout.
- **Server Checkout Verification:** The `/api/checkout` endpoint re-computes subtotal, tax, and shipping from scratch using server rules, guaranteeing that orders cannot be placed with fraudulent pricing.
- **3D File Security:** Uploaded customer CAD models are strictly filtered by extension (`.stl`, `.step`, `.obj`, `.3mf`) and stored in a dedicated server upload directory.

## Quick Start

### 1. Install Dependencies
```bash
npm run install:backend
```

### 2. Start the Server
```bash
npm start
```
Or for auto-reload during development:
```bash
npm run dev
```

### 3. Open in Browser
Visit `http://localhost:3000` to browse the store, configure custom prints, and test the cart.
