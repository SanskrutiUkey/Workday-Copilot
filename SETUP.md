# Workday AutoFill AI — Setup & Installation Guide

This document outlines the prerequisites, installation instructions, build workflow, API key configuration, and execution mode configuration for the **Workday AutoFill AI Chrome Extension**.

---

## 1. Prerequisites

Before installing and running the extension, ensure your local development environment meets the following requirements:

- **Node.js**: `v18.0.0` or higher (tested on Node.js v20+)
- **npm**: `v9.0.0` or higher
- **Google Chrome**: Version 116+ (requires native support for Manifest V3 side panel APIs `chrome.sidePanel`)
- **Target Application Page**: A active Workday job application posting (e.g., target Workday tenant application URL).

---

## 2. Project Installation & Build Steps

1. **Clone or Navigate to Project Directory**:
   ```bash
   cd D:\Hidani-Tech
   ```

2. **Install Dependencies**:
   Install devDependencies (Vite, CRXJS plugin) and dependencies (`mammoth` for DOCX parsing, `pdfjs-dist` for PDF parsing):
   ```bash
   npm install
   ```

3. **Build Extension Bundle**:
   To compile content scripts, side panel UI, background service worker, and assets into the `dist/` directory, run:
   ```bash
   npm run build
   ```
   *Note: For live development and hot module reloading, you can run `npm run dev`.*

4. **Load Unpacked Extension into Chrome**:
   - Open Chrome and navigate to `chrome://extensions`.
   - Toggle **Developer mode** in the top-right corner to **ON**.
   - Click **Load unpacked**.
   - Select the `D:\Hidani-Tech\dist` folder.
   - The **Workday AutoFill AI** extension will now appear in your extensions toolbar.

---

## 3. Configuring the AI API Key

The extension relies on Google Gemini (`gemini-3.6-flash`) for AI resume parsing and fallback field mapping. 

> [!IMPORTANT]
> The API key is **never hardcoded** in source files and **never committed** to repository history. It is securely stored locally in the browser's extension storage (`chrome.storage.local`).

### Steps to Configure Key:
1. Click the **Workday AutoFill AI** action icon in your Chrome toolbar to open the **Side Panel**.
2. Click on the **Settings** tab.
3. Paste your Google Gemini API key into the **Gemini API Key** field (starts with `AIza...`).
4. Click **Save Key**.
5. The status will update to **"API key configured"**. All background service worker AI requests will now attach this stored key dynamically.

---

## 4. Dry-Run Mode vs Live Mode

The extension supports safe evaluation before performing real action on application portals.

### Dry-Run Mode (Review Mode)
* **How it works**:
  1. Upload your resume (PDF/DOCX) in the **Upload** tab.
  2. Click **Start Autofill**.
  3. The extension navigates, parses fields, runs the deterministic/heuristic/AI mapping pipeline, and inputs values into fields on the active Workday step.
  4. Once all steps complete or reach the **Review** step (`applyFlowReviewPage`), the extension **pauses automatically** and presents all mapped fields in the **Fill Review** side panel tab.
  5. It logs all decision confidence scores, field paths, and reasoning into the **Activity Log** without triggering the final form submission.

### Live Mode (Final Submission)
* **How it works**:
  1. Open the **Review** tab in the side panel after autofill completes.
  2. Inspect the populated values and resolve any flagged fields.
  3. Explicitly check the confirmation box: `[x] I reviewed these values and confirm submission`.
  4. Click **Submit application**.
  5. The extension locates the submit element on the Workday page (`[data-automation-id="bottom-navigation-submit-button"]`, `pageFooterSubmitButton`, or matching ARIA submit elements) and performs the final submit click.
