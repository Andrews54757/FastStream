import {MessageTypes} from '../enums/MessageTypes.mjs';
import {Localize} from '../modules/Localize.mjs';
import {EnvUtils} from '../utils/EnvUtils.mjs';
import {WebUtils} from '../utils/WebUtils.mjs';
import {DOMElements} from './DOMElements.mjs';

/**
 * Firefox VPN carries a page's requests but not FastStream's, and a site that ties its
 * stream to the VPN's address refuses FastStream's player (background/VpnProxyMirror.mjs).
 * FastStream can follow the page's way with the optional "proxy" permission: when a source
 * came through the VPN and the permission is missing, this button shows. A player in a
 * page has no permissions API (chrome.permissions is undefined there, Firefox 157), so the
 * button opens FastStream's permissions page at its proxy row, where the user allows it;
 * the background then tells the players (VPN_ALLOWED), and this one loads its source again.
 *
 * Only builds that declare the optional permission (the Firefox ones) ask the background.
 */
export class VpnPrompt {
  /**
   * @param {Object} client - The FastStreamClient.
   */
  constructor(client) {
    this.client = client;
    this.source = null;
    const button = DOMElements.vpnButton;
    if (!button) return;
    button.textContent = Localize.getMessage('player_vpn_allow');
    button.title = Localize.getMessage('player_vpn_allow_tooltip');
    button.ariaLabel = button.title;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.allow();
    });
    WebUtils.setupTabIndex(button);
  }

  /**
   * @return {boolean} Whether this build can follow Firefox VPN.
   */
  static isAvailable() {
    if (!EnvUtils.isExtension()) return false;
    try {
      return !!chrome.runtime.getManifest().optional_permissions?.includes('proxy');
    } catch (e) {
      return false;
    }
  }

  /**
   * Asks the background whether this source came through Firefox VPN, and shows the
   * button when FastStream may not follow yet.
   * @param {Object} source - The source just set.
   * @return {Promise<void>}
   */
  async check(source) {
    this.hide();
    this.source = source;
    if (!source?.url || !VpnPrompt.isAvailable()) return;
    let status;
    try {
      status = await chrome.runtime.sendMessage({type: MessageTypes.VPN_STATUS, url: source.url});
    } catch (e) {
      return;
    }
    if (this.source !== source) return;
    if (status?.proxied && status.copyable && !status.permitted) {
      this.show();
    }
  }

  /**
   * Opens the permissions page at its proxy row.
   */
  allow() {
    chrome.runtime.sendMessage({type: MessageTypes.VPN_OPEN_PERMISSION}).catch((e) => {
      console.warn('Could not open the permissions page', e);
    });
  }

  /**
   * The permission was given: a source this button was shown for loads again.
   */
  onAllowed() {
    const source = this.source;
    const client = this.client;
    if (!this.isShown() || !source || client.source !== source) return;
    this.hide();
    client.setSource(source).catch((e) => console.error(e));
  }

  isShown() {
    return !!DOMElements.vpnButton && DOMElements.vpnButton.style.display !== 'none';
  }

  show() {
    if (DOMElements.vpnButton) DOMElements.vpnButton.style.display = '';
  }

  hide() {
    if (DOMElements.vpnButton) DOMElements.vpnButton.style.display = 'none';
  }
}
