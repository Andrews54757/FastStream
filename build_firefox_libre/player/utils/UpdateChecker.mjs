// SPLICER:NO_UPDATE_CHECKER:REMOVE_FILE
import {RequestUtils} from './RequestUtils.mjs';
const PACKAGE_JSON_URL = 'https://raw.githubusercontent.com/Andrews54757/FastStream/main/package.json';
/**
 * Utility for checking and comparing FastStream versions.
 */
export class UpdateChecker {
  /**
   * Fetches the latest version from the remote package.json.
   * @return {Promise<string|null>} The latest version string or null if failed.
   */
  static async getLatestVersion() {
    const xhr = await RequestUtils.requestSimple(PACKAGE_JSON_URL);
    if (xhr.status !== 200) {
      return null;
    }
    const body = xhr.responseText;
    const json = JSON.parse(body);
    return json.version;
  }
  /**
   * Compares two version strings.
   * @param {string} currentVersion - The current version.
   * @param {string} latestVersion - The latest version.
   * @return {boolean} True if currentVersion is less than latestVersion, false otherwise.
   */
  static compareVersions(currentVersion, latestVersion) {
    const current = currentVersion.split('.');
    const latest = latestVersion.split('.');
    const maxLen = Math.max(current.length, latest.length);
    for (let i = 0; i < maxLen; i++) {
      const c = parseInt(current[i] || '0', 10);
      const l = parseInt(latest[i] || '0', 10);
      if (isNaN(l) || isNaN(c)) {
        return false;
      }
      if (c < l) {
        return true;
      }
      if (c > l) {
        return false;
      }
    }
    return false;
  }
}
