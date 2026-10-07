// An optional permission's row shows only where the manifest declares it: the Firefox
// builds alone ask for "proxy" (build.mjs), and requesting an undeclared one throws.
const optionalPermissions = chrome.runtime.getManifest().optional_permissions || [];
for (const row of document.querySelectorAll('.optional-perm')) {
  if (!optionalPermissions.includes(row.dataset.perm)) {
    row.remove();
  }
}

async function updatePerms() {
  const perms = await chrome.permissions.getAll();
  const permsEl = document.querySelectorAll('.permstatus');
  for (const el of permsEl) {
    let hasPerms = false;
    if (el.dataset.perm === 'all-urls') {
      hasPerms = perms.origins.includes('<all_urls>');
    } else {
      hasPerms = perms.permissions.includes(el.dataset.perm);
    }

    if (hasPerms) {
      el.classList.add('has-perms');
      el.classList.remove('no-perms');
      el.textContent = window.getI18nMessage('perms_page_granted');
      el.onclick = null;
    } else {
      el.classList.remove('has-perms');
      el.classList.add('no-perms');
      el.textContent = window.getI18nMessage('perms_page_notgranted');
      // onclick, not a listener: updatePerms runs again at every permission change, and each
      // run added one more listener, so a click asked for the permission that many times.
      el.onclick = () => {
        if (el.dataset.perm === 'all-urls') {
          chrome.permissions.request({
            origins: ['<all_urls>'],
          });
        } else {
          chrome.permissions.request({
            permissions: [el.dataset.perm],
          });
        }
      };
    }
  }
}

updatePerms();

// Opened from the player's Firefox VPN button (player/ui/VpnPrompt.mjs): the proxy row is
// the one, and once it is granted the tab closes, back to the video, whose player loads
// again.
if (location.hash === '#proxy') {
  const status = document.querySelector('.permstatus[data-perm="proxy"]');
  const row = status?.closest('h4');
  if (row) {
    row.classList.add('asked');
    row.scrollIntoView({block: 'center'});
  }
  chrome.permissions.onAdded.addListener(async (added) => {
    if (!added.permissions?.includes('proxy')) return;
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
  });
}

chrome.permissions.onAdded.addListener(updatePerms);
chrome.permissions.onRemoved.addListener(updatePerms);
