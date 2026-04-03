import * as browser from 'webextension-polyfill';

const ICON_URL = browser.runtime.getURL('images/icon-large.png');
const pendingActions = new Map();

browser.notifications.onClicked.addListener((id) => {
  pendingActions.get(id)?.();
  pendingActions.delete(id);
});

// Clean up entries for notifications dismissed without being clicked
browser.notifications.onClosed.addListener((id) => {
  pendingActions.delete(id);
});

export async function notify(title, message, onClick = null) {
  const id = Date.now().toString();
  if (onClick) pendingActions.set(id, onClick);
  await browser.notifications.create(id, {
    type: 'basic',
    iconUrl: ICON_URL,
    title,
    message,
  });
}
