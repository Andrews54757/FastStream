export class BackgroundUtils {
  static async getOptionsFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get({
        options: '{}',
      }, (results) => {
        resolve(results.options);
      });
    });
  }

  static checkMessageError(message) {
    if (chrome.runtime.lastError) {
      console.warn(`Unable to send message '${message}'`, chrome.runtime.lastError);
    }
  }

  static checkPermissions() {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains({
        origins: ['<all_urls>'],
        permissions: ['storage', 'tabs', 'webRequest', 'declarativeNetRequest'],
      }, (result) => {
        resolve(result);
      });
    });
  }
}
