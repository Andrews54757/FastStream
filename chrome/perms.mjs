async function updatePerms() {
  const perms = await chrome.permissions.getAll();
  const permsEl = document.querySelectorAll('.permstatus');
  for (const el of permsEl) {
    let hasPerms = false;
    if (el.dataset.perm === 'all-urls') {
      hasPerms = perms.origins[0] === '<all_urls>';
    } else {
      hasPerms = perms.permissions.includes(el.dataset.perm);
    }

    if (hasPerms) {
      el.classList.add('has-perms');
      el.classList.remove('no-perms');
      el.textContent = window.getI18nMessage('perms_page_granted');
    } else {
      el.classList.remove('no-perms');
      el.classList.add('no-perms');
      el.textContent = window.getI18nMessage('perms_page_notgranted');
      el.addEventListener('click', () => {
        if (el.dataset.perm === 'all-urls') {
          chrome.permissions.request({
            origins: ['<all_urls>'],
          });
        } else {
          chrome.permissions.request({
            permissions: [el.dataset.perm],
          });
        }
      });
    }
  }
}

updatePerms();

chrome.permissions.onAdded.addListener(updatePerms);
chrome.permissions.onRemoved.addListener(updatePerms);
