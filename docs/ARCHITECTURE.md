# Workday AutoFill AI - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Side Panel   │    │   Content    │                   │
│  │  (UI/Upload)  │◄──►│   Script     │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                              │                           │
│                     ┌────────▼────────┐                  │
│                     │   Injected      │                  │
│                     │   Script        │                  │
│                     │   (Page Context)│                  │
│                     └────────┬────────┘                  │
│                              │                           │
│  ┌──────────────┐    ┌──────▼───────┐                   │
│  │  Background   │◄──►│  Workday     │                   │
│  │  Service      │    │  DOM         │                   │
│  │  Worker       │    └──────────────┘                   │
│  └──────────────┘                                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Module Architecture

### Parser Module (`src/lib/resumeParser.js`)
- **Input**: PDF/DOCX/TXT file
- **Process**: 
  1. Text extraction (pdfjs-dist for PDF, mammoth for DOCX)
  2. AI-powered structured extraction (OpenAI API)
- **Output**: Normalized JSON profile

### Mapper Module (`src/content/mapper.js`)
Three-tier field resolution:
1. **Deterministic** (confidence: 1.0) - Direct `data-automation-id` → profile path mapping
2. **Heuristic** (confidence: 0.8) - Synonym-based label matching
3. **AI** (confidence: variable) - Semantic field matching via OpenAI

### Filler Module (`src/content/filler.js`)
Widget-type-aware fill dispatcher:
- `text.js` - React-controlled input value setter
- `dropdown.js` - Click → listbox popup → option match
- `date.js` - Three sibling spinbuttons (MM/DD/YYYY)
- `radio.js` - Radio button selection
- `checkbox.js` - Checkbox toggle
- `multiselect.js` - Multi-select with tag UI
- `file.js` - DataTransfer + hidden input

### Navigator Module (`src/content/navigator.js`)
State machine over Workday steps:
```
My Information → My Experience → Application Questions → Voluntary Disclosures → Review
```

Key responsibilities:
- Step detection via `data-automation-id`
- Field discovery on current step
- Step advancement (Next button click)
- Error detection (inline validation)
- Login screen pause/resume

### Observer Module (`src/content/observer.js`)
- MutationObserver watching DOM changes
- Settle detection (600ms of no mutations)
- `waitForSettle()` for async Workday rendering

## Communication Flow

```
Side Panel ←→ Content Script ←→ Injected Script ←→ Workday DOM
                ↕
         Service Worker ←→ OpenAI API
```

- **Content Script ↔ Injected Script**: `window.postMessage` / `CustomEvent`
- **Content Script ↔ Service Worker**: `chrome.runtime.sendMessage`
- **Service Worker ↔ OpenAI**: `fetch` API

## Data Storage

All data stored in `chrome.storage.local`:
- `autofill_profile` - Parsed resume JSON
- `autofill_mappings` - Cached automation-id → field path mappings
- `openai_api_key` - API key (encrypted at rest by Chrome)
- `autofill_log` - Activity log entries

## Security

- API key never stored in source code
- All OpenAI calls routed through service worker
- User confirmation required before form submission
- No data sent to third parties
