# Workday AutoFill AI - Setup Guide

## Prerequisites
- Node.js 18+ installed
- Google Chrome browser
- OpenAI API key (for AI-powered field mapping)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd Hidani-Tech
```

### 2. Install dependencies
```bash
npm install
```

### 3. Build the extension
```bash
npm run build
```

### 4. Load in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `dist` folder from the project directory

### 5. Configure API Key
1. Click the extension icon in Chrome toolbar
2. Side panel will open
3. Go to "Settings" tab
4. Enter your OpenAI API key
5. Click "Save Key"

### 6. Using the Extension
1. Navigate to a Workday job application (e.g., Target careers)
2. Click the extension icon to open the side panel
3. Go to "Upload" tab
4. Drag & drop or click to upload your resume (PDF, DOCX, or TXT)
5. Review the parsed profile data
6. Click "Start Autofill"
7. The extension will automatically fill all fields and navigate through steps
8. Review the final screen before submitting

## Development

### Watch mode (auto-rebuild)
```bash
npm run dev
```

### Rebuild after changes
```bash
npm run build
```

Then reload the extension in `chrome://extensions/`.

## Testing
Test with the provided Target job posting:
https://target.wd5.myworkdayjobs.com/en-US/targetcareers/details/ETL-GM---Food-Sales_R0000452117

## Troubleshooting

### Extension not detecting fields
- Ensure you're on a `*.myworkdayjobs.com` page
- Try refreshing the page and re-opening the side panel

### Autofill not working
- Check that the API key is configured in Settings tab
- Verify the resume was parsed successfully (check Profile tab)
- Look at the Log tab for error messages

### Resume parsing fails
- Ensure the PDF contains extractable text (not scanned images)
- Try converting DOCX to a simpler format
- Check API key is valid
