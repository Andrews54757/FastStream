import {DOMElements} from '../ui/DOMElements.mjs';

export class InterfaceUtils {
  static closeWindows() {
    const windows = [
      DOMElements.optionsContainer,
      DOMElements.subuiContainer,
      DOMElements.linkuiContainer,
      DOMElements.audioConfigContainer,
    ];

    for (const box of windows) {
      box.getElementsByClassName('close_button')[0].click();
    }
  }
}
