const MENU_JPG = 'save-image-as-jpg';
const MENU_PNG = 'save-image-as-png';
const OFFSCREEN_URL = 'offscreen.html';
const LAST_DOWNLOAD_DIR_KEY = 'lastDownloadDir';

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
    const rememberedTarget = await buildRememberedDownloadTarget(info.srcUrl, format);
    const downloadId = await chrome.downloads.download({
      url: result.dataUrl,
      filename: rememberedTarget.filename,
      saveAs: !rememberedTarget.hasRememberedDir
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

async function buildRememberedDownloadTarget(srcUrl, format) {
  const filename = buildFilename(srcUrl, format);
  const { [LAST_DOWNLOAD_DIR_KEY]: lastDir = '' } = await chrome.storage.local.get(LAST_DOWNLOAD_DIR_KEY);
  const safeLastDir = sanitizeRelativePath(lastDir);
  return {
    filename: safeLastDir ? `${safeLastDir}/${filename}` : filename,
    hasRememberedDir: Boolean(safeLastDir)
  };
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
    if (delta.id === downloadId && delta.filename?.current) {
      const [item] = await chrome.downloads.search({ id: downloadId });
      const finalPath = item?.filename || delta.filename?.current || '';
      const relativeDir = deriveRelativeDirFromFinalPath(finalPath, item?.filename || '');
      if (relativeDir) {
        await chrome.storage.local.set({ [LAST_DOWNLOAD_DIR_KEY]: relativeDir });
      }
    }

    if (delta.id === downloadId && ['complete', 'interrupted'].includes(delta.state?.current)) {
      chrome.downloads.onChanged.removeListener(handleChange);
    }
  };

  chrome.downloads.onChanged.addListener(handleChange);
}

function deriveRelativeDirFromFinalPath(finalPath, fallbackPath = '') {
  const normalized = normalizePath(finalPath || fallbackPath);
  if (!normalized) return '';

  const fileName = normalized.split('/').filter(Boolean).pop() || '';
  const folderPath = normalized.slice(0, normalized.length - fileName.length).replace(/\/$/, '');
  if (!folderPath) return '';

  // Chrome's downloads API accepts paths relative to its default download directory.
  // If the final path is inside the current default download directory, the part
  // after that directory is exactly what we can reuse for the next download.
  // With saveAs enabled, Chrome may also remember the OS dialog's last folder;
  // in that case an empty relativeDir is still okay because Chrome itself opens
  // the previous folder. We only persist a non-empty relative subfolder.
  const downloadsIndex = findDownloadsSegmentIndex(folderPath);
  if (downloadsIndex === -1) return '';

  const parts = folderPath.split('/').filter(Boolean).slice(downloadsIndex + 1);
  return sanitizeRelativePath(parts.join('/'));
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/');
}

function findDownloadsSegmentIndex(path) {
  const parts = path.split('/').filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (/^downloads$/i.test(parts[index])) return index;
  }
  return -1;
}

function sanitizeRelativePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[\\/:*?"<>|]+/g, '_'))
    .filter(Boolean)
    .join('/');
}

function notifyFailure(error) {
  // Keep dependency surface minimal. Errors are visible in chrome://extensions service-worker console.
  console.warn(`Could not convert image: ${error?.message || error}`);
}
