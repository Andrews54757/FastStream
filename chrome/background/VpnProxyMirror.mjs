// Firefox VPN (Firefox's built-in "IP protection", Firefox 149+) sends a page's requests
// through Mozilla's proxy, but not an extension's: IPPExceptionsManager.getPrincipalRule
// leaves out every principal that is not http(s), moz-extension:// among them (Firefox 157,
// toolkit/components/ipprotection). A site that ties its stream URL to the address that
// asked for the page then refuses FastStream: VOE's stream URL carries the VPN exit's
// network (...&i=63.245&asn=54113), and FastStream's player, asking from the user's own
// address, never loads the video while the site's own player plays it.
//
// So FastStream's own requests to a host go the way the page's latest request to it went.
// webRequest reports the proxy a page's request took (details.proxyInfo: type, host, port,
// proxyAuthorizationHeader, connectionIsolationKey, as measured in Firefox 157), and
// proxy.onRequest gives the same one to FastStream's requests to that host. The token is
// the newest any page request through that proxy carried; the isolation key keeps them on
// the page's connection, and so on its exit address. The listener asks only for those
// hosts, and only with the optional "proxy" permission, which the player asks for the first
// time it meets such a page (VPN_STATUS, player/ui/VpnPrompt.mjs).
//
// Only http and https proxies are copied: the VPN's servers are CONNECT proxies over TLS.
// A MASQUE proxy needs its URI template, which webRequest does not report, and a SOCKS one
// its password.
//
// Firefox only: Chromium's webRequest reports no proxy and it has no proxy.onRequest. The
// Firefox builds alone declare the permission (build.mjs), and background.mjs creates this
// only when the manifest does.

/** Proxy types whose every setting webRequest reports, so that a copy is the same proxy. */
const CopyableTypes = ['http', 'https'];

/** Hosts remembered at most; the oldest goes first. The listener is rebuilt per new host. */
const MaxHosts = 200;

/**
 * A page's own loads, which say its tab now goes direct when they do. Not xmlhttprequest:
 * a content script's fetch looks like the page's and always goes direct.
 */
const PageLoadTypes = ['main_frame', 'sub_frame', 'script', 'stylesheet', 'image', 'font', 'media'];

/**
 * @typedef {Object} HostEntry
 * @property {string} key - The proxy's (keyOf).
 * @property {number} tabId - The tab whose page last reached the host that way: only its
 *   page going direct takes the host off (another tab's site may be left out of the VPN).
 */

/**
 * @typedef {Object} SeenProxy
 * @property {string} type
 * @property {string} host
 * @property {number} port
 * @property {string} [proxyAuthorizationHeader]
 * @property {string} [connectionIsolationKey]
 * @property {number} [failoverTimeout]
 */

/**
 * The host of a URL, or '' when it has none.
 * @param {string} url
 * @return {string}
 */
function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

export class VpnProxyMirror {
  /**
   * @param {Object} env
   * @param {string} env.origin - This extension's origin, e.g. moz-extension://<uuid>/.
   * @param {() => any} env.getProxyApi - Reads chrome.proxy, which is there only while
   *   the permission is granted.
   */
  constructor({origin, getProxyApi}) {
    this.origin = origin;
    this.getProxyApi = getProxyApi;
    /** @type {Map<string, HostEntry>} private-window flag + host -> the way there */
    this.hosts = new Map();
    /** @type {Map<number, string>} tab -> proxy key of its page's latest request */
    this.tabs = new Map();
    /** @type {Map<string, SeenProxy>} proxy key -> its newest settings */
    this.proxies = new Map();
    this.permitted = false;
    /** @type {((details: Object) => (Object|undefined))|null} */
    this.listener = null;
    /** @type {string[]} */
    this.listenerUrls = [];
  }

  /**
   * Whether a request is this extension's own: its player page, the background, an
   * options page (originUrl, else documentUrl, is under the extension's origin).
   * @param {{originUrl?: string, documentUrl?: string}} details
   * @return {boolean}
   */
  isOwnRequest(details) {
    const from = details.originUrl || details.documentUrl || '';
    return from.startsWith(this.origin);
  }

  /**
   * @param {SeenProxy} info
   * @return {string}
   */
  static keyOf(info) {
    return `${info.type}://${info.host}:${info.port}`;
  }

  /**
   * @param {boolean|undefined} incognito
   * @param {string} host
   * @return {string}
   */
  static hostKey(incognito, host) {
    return (incognito ? 'p|' : 'n|') + host;
  }

  /**
   * @param {string|undefined} key - A proxy's key.
   * @return {boolean} Whether FastStream can send its requests through that proxy.
   */
  isCopyable(key) {
    return !!key && CopyableTypes.includes(this.proxies.get(key)?.type || '');
  }

  /**
   * Remembers the proxy a request took, with its newest token; null when it went directly.
   * @param {?Object|undefined} info - webRequest's details.proxyInfo.
   * @return {?string} The proxy's key.
   */
  rememberProxy(info) {
    if (!info || !info.type || info.type === 'direct') return null;
    /** @type {SeenProxy} */
    const seen = {
      type: String(info.type),
      host: String(info.host),
      port: Number(info.port),
      proxyAuthorizationHeader: info.proxyAuthorizationHeader || undefined,
      connectionIsolationKey: info.connectionIsolationKey || undefined,
      failoverTimeout: typeof info.failoverTimeout === 'number' ? info.failoverTimeout : undefined,
    };
    const key = VpnProxyMirror.keyOf(seen);
    this.proxies.set(key, seen);
    return key;
  }

  /**
   * Takes note of a request webRequest saw (onBeforeRequest, every request). A page's
   * carries its proxy's newest token (Firefox VPN gives every request the same one), and
   * tells whether its tab's page goes through a proxy. A remembered host goes off the list
   * once the page of the tab it came from reaches it directly, that tab's page loads
   * having gone direct first (the VPN turned off, or off for this site, and the page
   * loaded again): a content script's fetch in a page still on the VPN goes direct by
   * itself, and so may another tab's site. Hosts are added only where FastStream fetches
   * (noteSource, own requests): with the VPN on, every page request has a proxy, and a
   * listener for all their hosts would hold up every request.
   * @param {{url: string, tabId: number, frameId?: number, type?: string, incognito?: boolean,
   *   originUrl?: string, documentUrl?: string, proxyInfo?: ?Object}} details
   */
  noteRequest(details) {
    const host = hostOf(details.url);
    if (!host) return;
    if (this.isOwnRequest(details)) {
      this.noteOwnRequest(details, host);
      return;
    }
    const hostKey = VpnProxyMirror.hostKey(details.incognito, host);
    const key = this.rememberProxy(details.proxyInfo);
    if (!key) {
      // The top frame's: a frame of a site left out of the VPN loads its parts directly.
      if (details.frameId === 0 && PageLoadTypes.includes(details.type || '')) this.tabs.delete(details.tabId);
      const entry = this.hosts.get(hostKey);
      if (entry && details.tabId >= 0 && entry.tabId === details.tabId && !this.tabs.has(details.tabId)) {
        this.hosts.delete(hostKey);
        this.updateListener();
      }
      return;
    }
    // The top frame's: a frame of another site may be on the VPN when the page is not.
    if (details.tabId >= 0 && (details.frameId ?? 0) === 0) this.tabs.set(details.tabId, key);
    const entry = this.hosts.get(hostKey);
    if (!entry) return;
    if (!this.isCopyable(key)) {
      // The page went over to a proxy FastStream cannot follow: the old way may be gone.
      this.hosts.delete(hostKey);
      this.updateListener();
      return;
    }
    entry.key = key;
    if (details.tabId >= 0) entry.tabId = details.tabId;
  }

  /**
   * A stream or subtitle file detected from a page's request: its host goes the way that
   * request went.
   * @param {{url: string, tabId: number, incognito?: boolean, originUrl?: string,
   *   documentUrl?: string, proxyInfo?: ?Object}} details
   */
  noteSource(details) {
    const host = hostOf(details.url);
    if (!host || details.tabId < 0 || this.isOwnRequest(details)) return;
    const key = this.rememberProxy(details.proxyInfo);
    if (key) this.addHost(VpnProxyMirror.hostKey(details.incognito, host), key, details.tabId);
  }

  /**
   * FastStream's own request in a tab whose page goes through a proxy: its host goes that
   * way too, from the next request on (a retry: the proxy is chosen before webRequest
   * hears of a request).
   * @param {{tabId: number, incognito?: boolean}} details
   * @param {string} host
   */
  noteOwnRequest(details, host) {
    if (details.tabId < 0) return;
    const key = this.tabs.get(details.tabId);
    if (key) this.addHost(VpnProxyMirror.hostKey(details.incognito, host), key, details.tabId);
  }

  /**
   * Remembers a host behind a proxy FastStream can copy. Others are left out: their
   * requests would only wait on the background for an answer that changes nothing.
   * @param {string} hostKey
   * @param {string} key - The proxy's.
   * @param {number} tabId - The tab it was seen in.
   */
  addHost(hostKey, key, tabId) {
    if (!this.isCopyable(key)) return;
    const known = this.hosts.has(hostKey);
    // Re-inserted, so that the most recently used host is the last to go.
    this.hosts.delete(hostKey);
    this.hosts.set(hostKey, {key, tabId});
    if (known) return;
    while (this.hosts.size > MaxHosts) {
      this.hosts.delete(this.hosts.keys().next().value);
    }
    this.updateListener();
  }

  /**
   * Forgets a closed tab, and the hosts its page last reached through a proxy: no page
   * going direct could take them off any more. Another tab still on them adds them again
   * with its player's next request (noteOwnRequest).
   * @param {number} tabId
   */
  forgetTab(tabId) {
    this.tabs.delete(tabId);
    let changed = false;
    for (const [hostKey, entry] of this.hosts) {
      if (entry.tabId === tabId) {
        this.hosts.delete(hostKey);
        changed = true;
      }
    }
    if (changed) this.updateListener();
  }

  /**
   * The proxy a page's requests to this URL's host took, if any.
   * @param {string} url
   * @param {boolean} [incognito]
   * @param {number} [tabId] - The tab asking, whose page's proxy counts for a host its
   *   page was not seen asking.
   * @return {?SeenProxy}
   */
  proxyForUrl(url, incognito, tabId) {
    const host = hostOf(url);
    let key = host ? this.hosts.get(VpnProxyMirror.hostKey(incognito, host))?.key : undefined;
    if (!key && tabId !== undefined && tabId >= 0) key = this.tabs.get(tabId);
    return key ? this.proxies.get(key) || null : null;
  }

  /**
   * What the player needs to know about its source: whether the page reached it through
   * a proxy that FastStream's requests skip, and whether FastStream can follow it. A
   * source in a tab whose page goes through a proxy has its host added.
   * @param {string} url
   * @param {boolean} [incognito]
   * @param {number} [tabId]
   * @return {{proxied: boolean, copyable: boolean, permitted: boolean}}
   */
  status(url, incognito, tabId) {
    const host = hostOf(url);
    const tabKey = tabId !== undefined && tabId >= 0 ? this.tabs.get(tabId) : undefined;
    if (host && tabKey && !this.hosts.has(VpnProxyMirror.hostKey(incognito, host))) {
      this.addHost(VpnProxyMirror.hostKey(incognito, host), tabKey, /** @type {number} */ (tabId));
    }
    const seen = this.proxyForUrl(url, incognito, tabId);
    return {
      proxied: !!seen,
      copyable: !!seen && CopyableTypes.includes(seen.type),
      permitted: this.permitted,
    };
  }

  /**
   * proxy.onRequest's answer: for FastStream's own request to a host the page reached
   * through a proxy, that proxy with its newest token; for anything else, no change.
   * @param {{url: string, tabId?: number, incognito?: boolean, originUrl?: string,
   *   documentUrl?: string}} details
   * @return {Object|undefined}
   */
  proxyFor(details) {
    if (!this.isOwnRequest(details)) return undefined;
    const host = hostOf(details.url);
    const key = host ? this.hosts.get(VpnProxyMirror.hostKey(details.incognito, host))?.key : undefined;
    const seen = key ? this.proxies.get(key) : undefined;
    if (!seen || !CopyableTypes.includes(seen.type)) return undefined;
    /** @type {Object} */
    const answer = {type: seen.type, host: seen.host, port: seen.port};
    if (seen.proxyAuthorizationHeader) answer.proxyAuthorizationHeader = seen.proxyAuthorizationHeader;
    if (seen.connectionIsolationKey) answer.connectionIsolationKey = seen.connectionIsolationKey;
    if (seen.failoverTimeout !== undefined) answer.failoverTimeout = seen.failoverTimeout;
    return answer;
  }

  /**
   * Whether FastStream holds the "proxy" permission now; registers or drops the listener.
   * @param {boolean} permitted
   */
  setPermitted(permitted) {
    this.permitted = permitted;
    this.updateListener();
  }

  /**
   * Listens on proxy.onRequest for the remembered hosts only: a request to one of them,
   * the page's too, waits for the background's answer (undefined, at once, for all but
   * FastStream's own), and no other request does; without the permission or any host,
   * nothing listens.
   */
  updateListener() {
    const api = this.permitted ? this.getProxyApi() : null;
    const urls = Array.from(new Set(Array.from(this.hosts.keys()).map((hostKey) => `*://${hostKey.slice(2)}/*`)));
    const same = this.listener && urls.length === this.listenerUrls.length &&
      urls.every((u, i) => u === this.listenerUrls[i]);
    if (same && api) return;
    if (this.listener) {
      try {
        this.getProxyApi()?.onRequest.removeListener(this.listener);
      } catch (e) {
        // The permission went, and the listener with it.
      }
      this.listener = null;
      this.listenerUrls = [];
    }
    if (!api || !urls.length) return;
    this.listener = (details) => this.proxyFor(details);
    this.listenerUrls = urls;
    try {
      api.onRequest.addListener(this.listener, {urls});
    } catch (e) {
      console.warn('Could not listen for proxy requests', e);
      this.listener = null;
      this.listenerUrls = [];
    }
  }
}
