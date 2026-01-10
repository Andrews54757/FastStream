import {DOMElements} from '../ui/DOMElements.mjs';
/**
 * Utility functions for managing UI interface windows.
 */
export class InterfaceUtils {
  /**
   * Closes all open UI windows and returns whether any were open.
   * @return {boolean} True if any windows were open, false otherwise.
   */
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
