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
