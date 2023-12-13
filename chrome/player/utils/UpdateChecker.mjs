// SPLICER:NO_UPDATE_CHECKER:REMOVE_FILE

import {RequestUtils} from './RequestUtils.mjs';

const PACKAGE_JSON_URL = 'https://raw.githubusercontent.com/Andrews54757/FastStream/main/package.json';

export class UpdateChecker {
  static async getLatestVersion() {
    const xhr = await RequestUtils.requestSimple(PACKAGE_JSON_URL);
    if (xhr.status !== 200) {
      return null;
    }
    const body = xhr.responseText;
    const json = JSON.parse(body);
    return json.version;
  }

  static compareVersions(currentVersion, latestVersion) {
    const current = currentVersion.split('.');
    const latest = latestVersion.split('.');

    for (let i = 0; i < latest.length; i++) {
      const c = parseInt(current[i]);
      const l = parseInt(latest[i]);
      if (isNaN(l) || isNaN(c)) {
        return false;
      } else if (c < l) {
        return true;
      } else if (c > l) {
        return false;
      }
    }
    return false;
  }
}
