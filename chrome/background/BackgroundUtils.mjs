export class BackgroundUtils {
  static checkMessageError(message, suppress = false) {
    if (chrome.runtime.lastError) {
      if (!suppress) console.warn(`Unable to send message '${message}'`, chrome.runtime.lastError);
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
