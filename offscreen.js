chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message?.type !== 'convert-image') return false;
  convertImage(message).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function convertImage({ srcUrl, format }) {
  if (!['jpeg', 'png'].includes(format)) throw new Error('Output format must be jpeg or png');
  const blob = await loadImageBlob(srcUrl);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // JPEG has no alpha; avoid black transparent background.
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const outBlob = await canvas.convertToBlob({ type: `image/${format}`, quality: format === 'jpeg' ? 0.92 : undefined });
  return { ok: true, dataUrl: await blobToDataUrl(outBlob), width: canvas.width, height: canvas.height };
}

async function loadImageBlob(srcUrl) {
  if (srcUrl.startsWith('data:')) return (await fetch(srcUrl)).blob();
  const response = await fetch(srcUrl, { credentials: 'include', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Image fetch failed: HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') && blob.size === 0) throw new Error('Fetched resource is not a usable image');
  return blob;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
