import {DOMElements} from '../ui/DOMElements.mjs';

export class InterfaceUtils {
  static closeWindows() {
    const windows = [
      DOMElements.optionsContainer,
      DOMElements.subuiContainer,
      DOMElements.linkuiContainer,
      DOMElements.audioConfigContainer,
    ];

    let wasOpen = false;
    for (const box of windows) {
      if (box.style.display !== 'none') {
        wasOpen = true;
      }
      box.getElementsByClassName('close_button')[0].click();
    }

    return wasOpen;
  }
}
