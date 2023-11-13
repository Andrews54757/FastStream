import {Localize} from './player/modules/Localize.mjs';

window.getI18nMessage = Localize.getMessage;

document.querySelectorAll('[data-i18n]').forEach((elem) => {
  elem.innerText = window.getI18nMessage(elem.dataset.i18n);
});

document.querySelectorAll('[data-i18n-label]').forEach((elem) => {
  elem.title = window.getI18nMessage(elem.dataset.i18nLabel);
});
