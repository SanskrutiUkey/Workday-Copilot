# Workday AutoFill AI - Limitations

## Scope

This extension is designed and tested specifically for **Target Corporation** Workday applications. While the architecture supports other Workday tenants, testing has been limited to Target's `targetcareers` portal.

## Known Limitations

### Workday Platform
- **Custom tenant steps**: Each Workday tenant can customize application steps. The extension detects steps by `data-automation-id` patterns, which may vary.
- **Assessment questions**: Complex assessment questions (situational judgment, personality tests) are not automated.
- **File upload size**: Limited by browser memory; very large files (>10MB) may fail.
- **Shadow DOM**: Closed shadow DOM components cannot be accessed (browser security restriction).
- **Cross-origin iframes**: Some Workday pages use cross-origin iframes that content scripts cannot access.

### Field Mapping
- **Custom fields**: Tenant-specific custom fields may not have deterministic mappings.
- **Complex dropdowns**: Nested or cascading dropdowns may not be fully supported.
- **Dynamic options**: Dropdown options loaded asynchronously may be missed if they load after detection.
- **Conditional fields**: Fields that appear/disappear based on previous answers may be missed.

### Resume Parsing
- **Scanned PDFs**: Image-only PDFs cannot be parsed (no OCR implemented).
- **Non-standard formats**: Unusual resume layouts may produce incomplete extraction.
- **Multiple languages**: Only English resumes are supported.
- **Tables/columns**: Complex layouts may produce garbled text extraction.

### Question Answering
- **EEO/Voluntary**: Protected characteristics (gender, race, ethnicity, veteran status, disability) are never inferred from resumes. The extension defaults to "I don't wish to answer."
- **Open-ended questions**: Long-form questions (essays, descriptions) are not generated.
- **Experience-specific**: Years of specific experience are not reliably inferred.
- **Certification verification**: Cannot verify certifications or licenses.

### Security & Privacy
- **API key storage**: Stored in `chrome.storage.local` (encrypted by Chrome, but not zero-knowledge).
- **Resume data**: Stored locally only; never sent to third parties except OpenAI for parsing.
- **Authentication**: Login is never automated (explicit requirement).
- **Submission**: Always requires explicit user confirmation before submitting.

### Technical
- **Manifest V3**: Limited by Chrome extension API restrictions.
- **Performance**: Large resumes (>5 pages) may cause slow parsing.
- **Memory**: Long-running autofill sessions may consume significant memory.
- **Browser compatibility**: Chrome-only (Manifest V3).

## Not Implemented

- Other ATS platforms (Greenhouse, Lever, iCIMS)
- Cover letter generation
- Job search/matching
- Application tracking
- Multiple resume profiles
- Automatic resume tailoring
- Assessment completion

## Recommendations

1. **Always review** the autofill results before submitting
2. **Manually verify** EEO/voluntary questions
3. **Check flagged fields** in the review screen
4. **Test with a backup** resume before using on real applications
5. **Keep API key secure** and rotate periodically
