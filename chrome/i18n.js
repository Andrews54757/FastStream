document.querySelectorAll('[data-i18n]').forEach((elem) => {
  elem.innerText = chrome.i18n.getMessage(elem.dataset.i18n);
});
