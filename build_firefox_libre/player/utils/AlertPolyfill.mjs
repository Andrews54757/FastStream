import {Localize} from '../modules/Localize.mjs';
import {SweetAlert} from '../modules/sweetalert.mjs';
import {EnvUtils} from './EnvUtils.mjs';
/**
 * Polyfill for alert, confirm, prompt, and toast dialogs using SweetAlert.
 */
export class AlertPolyfill {
  /**
   * Shows an alert dialog.
   * @param {string} message - The message to display.
   * @param {string} [icon] - Optional icon type.
   * @return {Promise<any>} Resolves when the dialog is closed.
   */
  static async alert(message, icon = undefined) {
    return SweetAlert.fire({
      text: message,
      icon: icon,
    });
  }
  /**
   * Shows a confirmation dialog.
   * @param {string} message - The message to display.
   * @param {string} [icon] - Optional icon type.
   * @return {Promise<boolean>} Resolves with true if confirmed, false otherwise.
   */
  static async confirm(message, icon = undefined) {
    return (await SweetAlert.fire({
      text: message,
      icon: icon,
      showCancelButton: true,
      confirmButtonText: Localize.getMessage('yes'),
      cancelButtonText: Localize.getMessage('cancel'),
    })).isConfirmed;
  }
  /**
   * Shows a prompt dialog for user input.
   * @param {string} message - The message to display.
   * @param {string} [defaultValue] - Default input value.
   * @param {string} [icon] - Optional icon type.
   * @param {string} [inputType='text'] - Input type.
   * @return {Promise<string>} Resolves with the entered value.
   */
  static async prompt(message, defaultValue = '', icon = undefined, inputType = 'text') {
    return (await SweetAlert.fire({
      text: message,
      icon: icon,
      input: inputType,
      inputValue: defaultValue,
      showCancelButton: true,
      confirmButtonText: Localize.getMessage('ok'),
      cancelButtonText: Localize.getMessage('cancel'),
    })).value;
  }
  /**
   * Shows a toast notification.
   * @param {string} icon - Icon type.
   * @param {string} message - Main message.
   * @param {string} [submessage] - Optional submessage.
   * @return {Promise<any>} Resolves when the toast is closed.
   */
  static async toast(icon, message, submessage = undefined) {
    return await SweetAlert.fire({
      icon: icon,
      title: message,
      text: submessage,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = SweetAlert.stopTimer;
        toast.onmouseleave = SweetAlert.resumeTimer;
        toast.onclick = SweetAlert.close;
      },
    });
  }
  /**
   * Shows an error dialog and optionally sends the error report to the developer via GitHub.
   * @param {Error} error - The error object to report.
   * @return {Promise<void>} Resolves when the dialog is closed and report is sent or cancelled.
   */
  static async errorSendToDeveloper(error) {
    const errorHtml = document.createElement('div');
    const bodyText = document.createElement('p');
    bodyText.classList.add('error-popup-body');
    bodyText.textContent = Localize.getMessage('error_popup_body');
    const stackText = document.createElement('pre');
    stackText.classList.add('error-popup-stack');
    stackText.textContent = error?.stack;
    errorHtml.appendChild(bodyText);
    errorHtml.appendChild(stackText);
    return await SweetAlert.fire({
      title: Localize.getMessage('error_popup', [error?.message]),
      html: errorHtml,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: Localize.getMessage('error_popup_send'),
      cancelButtonText: Localize.getMessage('cancel'),
    }).then((result) => {
      if (result.isConfirmed) {
        const body = `## Version:\n${EnvUtils.getVersion()}\n\n## Error message:\n${error?.message || error}\n\n## Stack trace:\n\`\`\`\n${error?.stack || 'No stack trace'}\n\`\`\``;
        const urlBase = `https://github.com/Andrews54757/FastStream/issues/new?`;
        const url = `${urlBase}title=${encodeURIComponent('Error report')}&body=${encodeURIComponent(body)}`;
        if (EnvUtils.isExtension()) {
          chrome?.tabs?.create({
            url,
          });
        } else {
          window.open(url, '_blank');
        }
      }
    });
  }
}
