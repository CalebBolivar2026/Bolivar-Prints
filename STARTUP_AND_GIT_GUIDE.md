# Bolivar Prints — Startup & Git Reference Guide

This guide provides step-by-step instructions on how to start up your Bolivar Prints web application and how to stage, commit, and push changes to GitHub.

---

## Part 1: Starting the Web App

### 1. Open Terminal and Navigate to Project Directory

```bash
cd "/Users/calebbolivar/Desktop/Bolivar Prints"
```

### 2. Install Dependencies (First Time or After New Packages)
If you haven't installed dependencies yet, run:

```bash
npm run install:backend
```
*(Or navigate to backend directly: `cd backend && npm install`)*

### 3. Start the Server

#### Option A: Standard Production Mode
```bash
npm start
```

#### Option B: Development Mode (Auto-Reloads on File Changes)
```bash
npm run dev
```

### 4. View in Your Browser
Once the server starts, open your browser and navigate to:

👉 **[http://localhost:3000](http://localhost:3000)**

* Store Catalog: `http://localhost:3000/store.html`
* Custom 3D Orders: `http://localhost:3000/custom-order.html`
* Shopping Cart: `http://localhost:3000/cart.html`
* Checkout & Payment: `http://localhost:3000/checkout.html`
* My Account & Order History: `http://localhost:3000/account.html`
* Backend API Health: `http://localhost:3000/api/health`

### 5. Stopping the Server
To stop the server in your terminal, press:
```
Ctrl + C
```

> [!TIP]
> **Port 3000 Already in Use?**  
> If terminal says `EADDRINUSE: address already in use :::3000`, run this single command to free it up:  
> ```bash
> lsof -ti :3000 | xargs kill -9
> ```

---

## Part 2: Git Commit & Push Guide (Saving to GitHub)

Your repository is connected to GitHub at:  
`git@github.com:CalebBolivar2026/Bolivar-Prints.git` (Branch: `main`)

### Standard 3-Step Git Workflow

Whenever you make changes to files (adding images, editing HTML/CSS/JS, or updating backend routes):

#### Step 1: Check Which Files Changed
```bash
git status
```
* Green files = staged for commit  
* Red files = modified or newly created  

#### Step 2: Stage Your Changes
To stage all modified and newly created files:
```bash
git add .
```
*(Or stage specific files individually: `git add store.html store.js`)*

#### Step 3: Commit with a Descriptive Message
```bash
git commit -m ""
```

#### Step 4: Push to GitHub
```bash
git push origin main
```

---

## Part 3: Quick Copy-Paste Cheatsheet

### 🚀 One-Line Startup
```bash
cd "/Users/calebbolivar/Desktop/Bolivar Prints" && npm start
```

### 📦 One-Line Save & Push to GitHub
```bash
git add . && git commit -m "Update store features and checkout flow" && git push origin main
```

---

## Part 4: Helpful Git Commands

| Action | Command |
| :--- | :--- |
| **Check current branch & status** | `git status` |
| **View recent commit history** | `git log --oneline -n 5` |
| **See exact line-by-line diffs** | `git diff` |
| **Pull latest changes from GitHub** | `git pull origin main` |
| **Discard uncommitted changes in a file** | `git restore <filename>` |
| **Check connected remote repository** | `git remote -v` |

---

*Bolivar Prints — Precision Additive Manufacturing Platform*
