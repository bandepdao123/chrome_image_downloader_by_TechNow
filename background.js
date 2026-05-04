const MENU_JPG = 'save-image-as-jpg';
const MENU_PNG = 'save-image-as-png';
const OFFSCREEN_URL = 'offscreen.html';
const LAST_DOWNLOAD_DIR_KEY = 'lastDownloadDir';
const DOWNLOADS_DIR_RE = /(?:^|[\\/])Downloads[\\/](.*)[\\/][^\\/]+$/i;

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
    const downloadId = await chrome.downloads.download({
      url: result.dataUrl,
      filename: await buildRememberedFilename(info.srcUrl, format),
      saveAs: true
    });
    rememberDownloadDirectory(downloadId);
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

async function buildRememberedFilename(srcUrl, format) {
  const filename = buildFilename(srcUrl, format);
  const { [LAST_DOWNLOAD_DIR_KEY]: lastDir = '' } = await chrome.storage.local.get(LAST_DOWNLOAD_DIR_KEY);
  return lastDir ? `${lastDir}/${filename}` : filename;
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

function rememberDownloadDirectory(downloadId) {
  if (!downloadId) return;

  const handleChange = async (delta) => {
    if (delta.id !== downloadId || delta.state?.current !== 'complete') return;
    chrome.downloads.onChanged.removeListener(handleChange);

    const [item] = await chrome.downloads.search({ id: downloadId });
    const relativeDir = extractDownloadsRelativeDir(item?.filename || '');
    if (relativeDir) {
      await chrome.storage.local.set({ [LAST_DOWNLOAD_DIR_KEY]: relativeDir });
    }
  };

  chrome.downloads.onChanged.addListener(handleChange);
}

function extractDownloadsRelativeDir(nativePath) {
  const normalized = nativePath.replace(/\\/g, '/');
  const match = normalized.match(DOWNLOADS_DIR_RE);
  if (!match) return '';
  return match[1]
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[\\:*?"<>|]+/g, '_'))
    .join('/');
}

function notifyFailure(error) {
  // Keep dependency surface minimal. Errors are visible in chrome://extensions service-worker console.
  console.warn(`Could not convert image: ${error?.message || error}`);
}
