window.getI18nMessage = chrome.i18n.getMessage;

document.querySelectorAll('[data-i18n]').forEach((elem) => {
  elem.innerText = window.getI18nMessage(elem.dataset.i18n);
});

document.querySelectorAll('[data-i18n-label]').forEach((elem) => {
  elem.title = window.getI18nMessage(elem.dataset.i18nLabel);
});
