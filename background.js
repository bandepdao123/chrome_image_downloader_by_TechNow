const MENU_JPG = 'save-image-as-jpg';
const MENU_PNG = 'save-image-as-png';
const OFFSCREEN_URL = 'offscreen.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_JPG, title: 'Save image as JPG', contexts: ['image'] });
    chrome.contextMenus.create({ id: MENU_PNG, title: 'Save image as PNG', contexts: ['image'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.srcUrl || ![MENU_JPG, MENU_PNG].includes(info.menuItemId)) return;
  const format = info.menuItemId === MENU_JPG ? 'jpeg' : 'png';
  try {
    await ensureOffscreenDocument();
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'convert-image',
      srcUrl: info.srcUrl,
      pageUrl: info.pageUrl || tab?.url || '',
      format
    });
    if (!result?.ok) throw new Error(result?.error || 'Unknown conversion error');
    await chrome.downloads.download({
      url: result.dataUrl,
      filename: buildFilename(info.srcUrl, format),
      saveAs: true
    });
  } catch (error) {
    console.error('Save Image as JPG/PNG failed:', error);
    notifyFailure(error);
  }
});

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['BLOBS'],
    justification: 'Convert right-clicked web images to user-selected JPG or PNG via canvas.'
  });
}

async function hasOffscreenDocument() {
  if (!chrome.runtime.getContexts) return false;
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
  });
  return contexts.length > 0;
}

function buildFilename(srcUrl, format) {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  let name = 'image';
  try {
    const url = new URL(srcUrl);
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'image');
    name = last.replace(/\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|tif|tiff|webp)(\?.*)?$/i, '') || 'image';
  } catch (_) {}
  name = name.replace(/[\/:*?"<>|]+/g, '_').slice(0, 120) || 'image';
  return `${name}.${ext}`;
}

function notifyFailure(error) {
  // Keep dependency surface minimal. Errors are visible in chrome://extensions service-worker console.
  console.warn(`Could not convert image: ${error?.message || error}`);
}
