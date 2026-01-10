// Listen for messages
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }
  if (typeof event.data !== 'object') {
    return;
  }
  if (event.data?.type === 'fs_source_detected') {
    const value = (event.data?.value || '').toString();
    const ext = (event.data?.ext || '').toString();
    const mpd = value;
    const url = `data:application/dash+xml;base64,${btoa(mpd)}`;
    chrome.runtime.sendMessage({
      type: 'DETECTED_SOURCE',
      url,
      ext: ext,
      headers: {
        'Referer': location.href,
        'Origin': location.origin,
      },
    });
    console.log('Detected source', event.data);
  }
});
const sc = document.createElement('script');
sc.src = chrome.runtime.getURL('custom/instagram_inject.js');
const it = document.head || document.documentElement;
it.appendChild(sc);
sc.remove();
