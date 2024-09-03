import {Localize} from '../modules/Localize.mjs';
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
      confirmButtonText: Localize.getMessage('yes'),
      cancelButtonText: Localize.getMessage('cancel'),
    })).isConfirmed;
  }

  static async prompt(message, defaultValue = '', inputType = 'text') {
    return (await SweetAlert.fire({
      text: message,
      input: inputType,
      inputValue: defaultValue,
      showCancelButton: true,
      confirmButtonText: Localize.getMessage('ok'),
      cancelButtonText: Localize.getMessage('cancel'),
    })).value;
  }

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
      },
    });
  }
}
