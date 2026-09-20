
# Workday AutoFill AI

> **Selected: Target — ETL GM Food Sales (R0000452117)**

AI-powered Chrome extension for automated job application filling on Workday platforms. Uses semantic field mapping with Google Gemini to intelligently fill complex multi-step Workday forms.

## Features

- **Resume Parsing**: PDF/DOCX upload with AI-powered structured extraction
- **Smart Field Mapping**: Three-tier resolution (deterministic → heuristic → AI)
- **Widget-Aware Filling**: Handles React-controlled inputs, dropdowns, date pickers, radio buttons, checkboxes, and multi-selects
- **Multi-Step Navigation**: Automatically progresses through application steps
- **Review Screen**: Final review before submission with manual override
- **Secure**: API key stored locally, user confirmation required before submit

## Quick Start

```bash
npm install
npm run build
```

Then load the `dist` folder in `chrome://extensions/` (Developer mode).

See [docs/SETUP.md](docs/SETUP.md) for detailed instructions.

## Architecture

```
Resume Parser → Mapper (3-tier) → Filler (widget-aware) → Navigator (state machine)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full architecture details.

## AI Strategy

- **Resume parsing**: Gemini 3.5 Flash Lite with structured JSON output
- **Field mapping**: Batch per-step API calls with confidence scoring
- **Question answering**: Rule-based for common questions, AI for complex ones

See [docs/AI_STRATEGY.md](docs/AI_STRATEGY.md) for AI implementation details.

## Target Platform

Tested on Target Corporation Workday applications:
- https://target.wd5.myworkdayjobs.com/en-US/targetcareers/details/ETL-GM---Food-Sales_R0000452117

## Limitations

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for known limitations and scope.

## License

ISC
