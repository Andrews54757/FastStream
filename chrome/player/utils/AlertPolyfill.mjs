import {SweetAlert} from '../modules/sweetalert.mjs';

export class AlertPolyfill {
  static async alert(message) {
    return SweetAlert.fire({
      text: message,
    });
  }

  static async confirm(message) {
    return (await SweetAlert.fire({
      text: message,
      showCancelButton: true,
    })).isConfirmed;
  }

  static async prompt(message, defaultValue = '') {
    return (await SweetAlert.fire({
      text: message,
      input: 'text',
      inputValue: defaultValue,
      showCancelButton: true,
    })).value;
  }
}
