import * as browser from 'webextension-polyfill';

const KEYS = [
  'motrixAPIkey',
  'extensionStatus',
  'enableNotifications',
  'minFileSize',
  'blacklist',
  'motrixPort',
  'downloadFallback',
  'hideChromeBar',
  'showContextOption',
  'showOnlyAria',
  'darkMode',
];

class SettingsCache {
  #data = null;

  async init() {
    this.#data = await browser.storage.sync.get(KEYS);
    browser.storage.sync.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        this.#data[key] = newValue;
      }
    });
  }

  get(key) {
    return this.#data?.[key];
  }

  getAll() {
    return { ...this.#data };
  }
}

export const settingsCache = new SettingsCache();
