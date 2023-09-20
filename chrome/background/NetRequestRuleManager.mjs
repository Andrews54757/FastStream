export class RuleEntry {
  constructor(id) {
    this.id = id;
    this.expiresAt = Date.now() + 1000 * 5;
  }
}

export class RuleManager {
  constructor() {
    this.rules = [];
    this.isLoopRunning = false;
    this.dumpRules();
  }

  getInsertionIndex(id) {
    // use binary search
    let min = 0;
    let max = this.rules.length - 1;
    let mid = 0;
    while (min <= max) {
      mid = Math.floor((min + max) / 2);
      if (this.rules[mid].id < id) {
        min = mid + 1;
      } else if (this.rules[mid].id > id) {
        max = mid - 1;
      } else {
        return -1;
      }
    }
    return min;
  }

  startLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;
    this.mainLoop();
  }

  mainLoop() {
    if (this.rules.length === 0) {
      this.isLoopRunning = false;
      return;
    }
    setTimeout(() => this.mainLoop(), 1000);
    this.filterRules();
  }

  async filterRules() {
    const now = Date.now();
    const removed = [];
    this.rules = this.rules.filter((rule) => {
      if (rule.expiresAt < now) {
        removed.push(rule);
        return false;
      }
      return true;
    });

    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: removed.map((rule) => rule.id),
    });
  }

  async addHeaderRule(url, tabId, requestHeaderCommands) {
    const rule = new RuleEntry(this.getNextID());
    // insert rule in order
    const index = this.getInsertionIndex(rule.id);
    if (index === -1) throw new Error('Rule already exists');
    this.rules.splice(index, 0, rule);

    const ruleObj = {
      id: rule.id,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: requestHeaderCommands,
      },
      condition: {
        urlFilter: '||' + url.replace('https://', '').replace('http://', ''),
        tabIds: [tabId],
      },
    };

    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [ruleObj],
    });

    this.startLoop();
    return rule;
  }

  getNextID() {
    let nextRuleID = 10;
    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (rule.id === nextRuleID) {
        nextRuleID++;
      } else {
        break;
      }
    }
    return nextRuleID;
  }

  async dumpRules() {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: rules.map((rule) => rule.id),
    });
  }
}

