import { sleep } from '../../lib/utils.js';

function toFile(fileData) {
  if (fileData instanceof File) return fileData;
  if (typeof fileData === 'string') {
    return new File([new Blob([fileData], { type: 'text/plain' })], 'resume.txt', { type: 'text/plain' });
  }
  if (!fileData) return null;

  let bytes = null;
  if (fileData.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileData.buffer);
  } else if (Array.isArray(fileData.buffer)) {
    bytes = new Uint8Array(fileData.buffer);
  } else if (typeof fileData.buffer === 'string') {
    const bin = atob(fileData.buffer);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  if (!bytes) return null;
  const type = fileData.type || 'application/pdf';
  return new File([bytes], fileData.name || 'resume.pdf', { type });
}

export async function fillFile(inputElement, fileData) {
  if (!inputElement) return false;

  const fileInput = inputElement.tagName === 'INPUT' && inputElement.type === 'file'
    ? inputElement
    : document.querySelector('[data-automation-id="file-upload-input-ref"]') || document.querySelector('input[type="file"]');

  if (!fileInput) return false;

  const file = toFile(fileData);
  if (!file) return false;

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  try {
    fileInput.files = dataTransfer.files;
  } catch {
    Object.defineProperty(fileInput, 'files', {
      value: dataTransfer.files,
      writable: true,
      configurable: true
    });
  }

  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);

  return fileInput.files.length > 0;
}
