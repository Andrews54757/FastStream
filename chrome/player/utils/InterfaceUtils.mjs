import {DOMElements} from '../ui/DOMElements.mjs';

export class InterfaceUtils {
  static closeWindows() {
    DOMElements.optionsContainer.style.display = 'none';
    DOMElements.subuiContainer.style.display = 'none';
    DOMElements.linkuiContainer.style.display = 'none';
    DOMElements.audioConfigContainer.style.display = 'none';
  }
}
