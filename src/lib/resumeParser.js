import mammoth from 'mammoth';

const geminiObj = (properties, required) => ({
  type: 'OBJECT',
  properties,
  required
});

export function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  profile.name = profile.name || { first: '', middle: null, last: '' };
  profile.phone = profile.phone || { countryCode: '+1', number: '' };
  if (!profile.phone.type) profile.phone.type = 'Mobile';
  profile.address = profile.address || {};
  if (profile.address.country === 'US' || profile.address.country === 'USA') {
    profile.address.country = 'United States of America';
  }
  profile.meta = profile.meta || {};
  if (!profile.meta.previousWorker) profile.meta.previousWorker = 'No';
  if (!profile.meta.source) profile.meta.source = 'Target.com/careers';
  profile.meta.eeo = profile.meta.eeo || {};
  if (profile.meta.acceptTerms !== true) profile.meta.acceptTerms = false;
  profile.experience = profile.experience || [];
  profile.education = profile.education || [];
  profile.skills = profile.skills || [];
  return profile;
}

export async function parseResume(file) {
  const arrayBuffer = await file.arrayBuffer();
  let rawText = '';

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    rawText = await extractPDF(arrayBuffer);
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             file.name.endsWith('.docx')) {
    rawText = await extractDOCX(arrayBuffer);
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    rawText = new TextDecoder().decode(arrayBuffer);
  } else {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('No text could be extracted from the resume');
  }

  return rawText;
}

async function extractPDF(arrayBuffer) {
  await import('pdfjs-dist/build/pdf.worker.min.mjs');
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    text += pageText + '\n';
  }

  return text;
}

async function extractDOCX(arrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function parseResumeWithAI(rawText) {
  const response = await chrome.runtime.sendMessage({
    type: 'AI_REQUEST',
    payload: {
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: rawText }] }],
      systemInstruction: {
        parts: [{
          text: `Extract resume data into this exact JSON schema. Normalize all dates to ISO 8601 (YYYY-MM-DD).
If a field is not found, use null for scalars and empty arrays for arrays.
Split name into first/middle/last. Include country code for phone.
For experience and education, use the most recent entries (up to 5).
Country should be a full name when possible (United States of America, India).`
        }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            name: geminiObj({
              first: { type: 'STRING' },
              middle: { type: 'STRING', nullable: true },
              last: { type: 'STRING' }
            }, ['first', 'middle', 'last']),
            email: { type: 'STRING' },
            phone: geminiObj({
              countryCode: { type: 'STRING' },
              number: { type: 'STRING' }
            }, ['countryCode', 'number']),
            address: geminiObj({
              line1: { type: 'STRING' },
              city: { type: 'STRING' },
              state: { type: 'STRING' },
              postalCode: { type: 'STRING' },
              country: { type: 'STRING' }
            }, ['line1', 'city', 'state', 'postalCode', 'country']),
            links: geminiObj({
              linkedin: { type: 'STRING' },
              github: { type: 'STRING' },
              portfolio: { type: 'STRING' }
            }, ['linkedin', 'github', 'portfolio']),
            experience: {
              type: 'ARRAY',
              items: geminiObj({
                jobTitle: { type: 'STRING' },
                company: { type: 'STRING' },
                startDate: { type: 'STRING' },
                endDate: { type: 'STRING', nullable: true },
                current: { type: 'BOOLEAN' },
                description: { type: 'STRING' }
              }, ['jobTitle', 'company', 'startDate', 'endDate', 'current', 'description'])
            },
            education: {
              type: 'ARRAY',
              items: geminiObj({
                school: { type: 'STRING' },
                degree: { type: 'STRING' },
                fieldOfStudy: { type: 'STRING' },
                startDate: { type: 'STRING' },
                endDate: { type: 'STRING' }
              }, ['school', 'degree', 'fieldOfStudy', 'startDate', 'endDate'])
            },
            skills: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            },
            certifications: {
              type: 'ARRAY',
              items: { type: 'STRING' }
            }
          },
          required: ['name', 'email', 'phone', 'address', 'links', 'experience', 'education', 'skills', 'certifications']
        }
      }
    }
  });

  if (typeof response === 'string') {
    return normalizeProfile(JSON.parse(response));
  }

  if (response?.error) throw new Error(response.error);

  throw new Error('Failed to parse resume with AI');
}
