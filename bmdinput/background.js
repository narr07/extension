// Klik ikon extension membuka side panel. Kalau browser belum mendukung
// side panel, panel dibuka sebagai jendela popup biasa.
const PANEL_URL = 'panel/panel.html';

async function setup() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      return;
    } catch (e) {
      console.warn('sidePanel tidak tersedia, pakai jendela popup', e);
    }
  }
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.action.onClicked.addListener(async () => {
  // Hanya terpanggil kalau openPanelOnActionClick tidak aktif.
  await chrome.windows.create({
    url: chrome.runtime.getURL(PANEL_URL + '?window=1'),
    type: 'popup',
    width: 440,
    height: 820
  });
});
