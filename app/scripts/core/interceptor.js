import * as browser from 'webextension-polyfill';

export function shouldIntercept(downloadItem, settings) {
  // Don't re-intercept downloads this extension already initiated
  if (downloadItem.byExtensionName === browser.i18n.getMessage('appName')) return false;
  // Extension is disabled
  if (!settings.extensionStatus) return false;
  // File is smaller than the configured minimum (only when size is known)
  const minBytes = (settings.minFileSize ?? 0) * 1024 * 1024;
  if (minBytes > 0 && downloadItem.fileSize > 0 && downloadItem.fileSize < minBytes) return false;
  // URL is on the blacklist
  const blacklist = settings.blacklist ?? [];
  if (blacklist.some((entry) => entry && downloadItem.url.includes(entry))) return false;
  return true;
}

export async function waitForFilename(downloadId) {
  // Filename may already be set by the time we're called
  const [existing] = await browser.downloads.search({ id: downloadId });
  if (existing?.filename) return existing.filename;

  return new Promise((resolve, reject) => {
    const changedListener = (delta) => {
      if (delta.id === downloadId && delta.filename?.current) {
        browser.downloads.onChanged.removeListener(changedListener);
        browser.downloads.onErased.removeListener(erasedListener);
        resolve(delta.filename.current);
      }
    };
    const erasedListener = (id) => {
      if (id === downloadId) {
        browser.downloads.onChanged.removeListener(changedListener);
        browser.downloads.onErased.removeListener(erasedListener);
        reject(new Error(`Download ${downloadId} was erased before filename was resolved`));
      }
    };
    browser.downloads.onChanged.addListener(changedListener);
    browser.downloads.onErased.addListener(erasedListener);
  });
}
