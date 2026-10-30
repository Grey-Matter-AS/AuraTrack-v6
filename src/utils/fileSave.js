// Saving a file: the system save dialog where the browser has one, a download otherwise.
// Kept apart from the report code so screens that only save a backup don't load the PDF library.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function saveFileBlob(blob, suggestedName, description, extensions) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [blob.type]: extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, cancelled: false };
    } catch (error) {
      if (error.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }
  triggerDownload(blob, suggestedName);
  return { ok: true, cancelled: false };
}

export async function saveTextFile(text, suggestedName, description, extensions, mimeType = 'application/json') {
  return saveFileBlob(new Blob([text], { type: mimeType }), suggestedName, description, extensions);
}
