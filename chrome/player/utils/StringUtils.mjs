export class StringUtils {
  static levenshteinDistance(s, t) {
    if (s === t) {
      return 0;
    }
    const n = s.length; const m = t.length;
    if (n === 0 || m === 0) {
      return n + m;
    }
    let x = 0; let y; let a; let b; let c; let d; let g; let h;
    const p = new Uint16Array(n);
    const u = new Uint32Array(n);
    for (y = 0; y < n;) {
      u[y] = s.charCodeAt(y);
      p[y] = ++y;
    }

    for (; (x + 3) < m; x += 4) {
      const e1 = t.charCodeAt(x);
      const e2 = t.charCodeAt(x + 1);
      const e3 = t.charCodeAt(x + 2);
      const e4 = t.charCodeAt(x + 3);
      c = x;
      b = x + 1;
      d = x + 2;
      g = x + 3;
      h = x + 4;
      for (y = 0; y < n; y++) {
        a = p[y];
        if (a < c || b < c) {
          c = (a > b ? b + 1 : a + 1);
        } else {
          if (e1 !== u[y]) {
            c++;
          }
        }

        if (c < b || d < b) {
          b = (c > d ? d + 1 : c + 1);
        } else {
          if (e2 !== u[y]) {
            b++;
          }
        }

        if (b < d || g < d) {
          d = (b > g ? g + 1 : b + 1);
        } else {
          if (e3 !== u[y]) {
            d++;
          }
        }

        if (d < g || h < g) {
          g = (d > h ? h + 1 : d + 1);
        } else {
          if (e4 !== u[y]) {
            g++;
          }
        }
        p[y] = h = g;
        g = d;
        d = b;
        b = c;
        c = a;
      }
    }

    for (; x < m;) {
      const e = t.charCodeAt(x);
      c = x;
      d = ++x;
      for (y = 0; y < n; y++) {
        a = p[y];
        if (a < c || d < c) {
          d = (a > d ? d + 1 : a + 1);
        } else {
          if (e !== u[y]) {
            d = c + 1;
          } else {
            d = c;
          }
        }
        p[y] = d;
        c = a;
      }
      h = d;
    }

    return h;
  }

  static formatTime(time) {
    const hours = Math.floor(time / 3600);
    time = time - hours * 3600;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time - minutes * 60);

    function strPadLeft(string, pad, length) {
      return (new Array(length + 1).join(pad) + string).slice(-length);
    }

    return (hours ? (hours + ':') : '') + strPadLeft(minutes, '0', 2) + ':' + strPadLeft(seconds, '0', 2);
  }

  static formatFrequency(freq) {
    if (freq > 1000) {
      return (freq / 1000).toFixed(1) + 'k';
    } else {
      return freq.toFixed(0);
    }
  }

  static getSpeedValue(speedStr) {
    // regex
    const float = parseFloat(speedStr);
    const unit = speedStr.replace(float, '').trim();
    if (
      isNaN(float) ||
      float < 0 ||
      float === Infinity
    ) {
      return -1;
    }

    // Unit can be MB/s, Mb/s, MB/hr, mb/ms, etc.
    const match = unit.match(/([a-oq-zA-Z]+)[\/|p]?([a-zA-Z]+)?/);
    const unit1 = match?.[1];
    const unit2 = match?.[2];

    let multiplier = 1;

    // Convert to bytes/s
    if (unit1) {
      const sci = ['b', 'k', 'm', 'g', 't', 'p', 'e', 'z', 'y'];
      const split = unit1.split('');
      if (sci.includes(split[0].toLowerCase())) {
        multiplier *= 1000 ** sci.indexOf(split[0].toLowerCase());
      } else {
        // M default
        multiplier *= 1000 ** 2;
      }

      if (split[split.length - 1] !== 'B') {
        multiplier /= 8;
      }
    } else {
      // Mb default
      multiplier *= 1000 ** 2;
      multiplier /= 8;
    }

    if (unit2) {
      const timeUnits = ['s', 'm', 'h'];
      const split = unit2.split('');
      if (timeUnits.includes(split[0].toLowerCase())) {
        multiplier /= 60 ** timeUnits.indexOf(split[0].toLowerCase());
      }
    }
    return float * multiplier;
  }

  static getSpeedString(speed, useBits = false) {
    if (speed === -1) {
      return '∞ M' + (useBits ? 'bps' : 'B/s');
    }

    let unit = '';
    let value = speed;
    if (useBits) {
      speed *= 8;
    }
    if (speed >= 1000) {
      unit = 'K';
      value = speed / 1000;
    }
    if (speed >= 1000000) {
      unit = 'M';
      value = speed / 1000000;
    }
    if (speed >= 1000000000) {
      unit = 'G';
      value = speed / 1000000000;
    }
    if (speed >= 1000000000000) {
      unit = 'T';
      value = speed / 1000000000000;
    }
    if (useBits) {
      unit += 'bps';
    } else {
      unit += 'B/s';
    }
    return Math.round(value * 100) / 100 + ' ' + unit;
  }

  static getSizeString(size) {
    if (size=== -1) {
      return '∞ GB';
    }

    let unit = 'B';
    if (size >= 1000) {
      unit = 'KB';
      size /= 1000;
    }
    if (size >= 1000) {
      unit = 'MB';
      size /= 1000;
    }
    if (size >= 1000) {
      unit = 'GB';
      size /= 1000;
    }
    if (size >= 1000) {
      unit = 'TB';
      size /= 1000;
    }
    return Math.round(size * 100) / 100 + ' ' + unit;
  }

  static getSizeValue(sizeStr) {
    const float = parseFloat(sizeStr);
    const unit = sizeStr.replace(float, '').trim();
    if (
      isNaN(float) ||
      float < 0 ||
      float === Infinity
    ) {
      return -1;
    }

    // Unit can be MB, Mb, etc...
    const match = unit.match(/([a-oq-zA-Z]+)/);
    const unit1 = match?.[1];

    let multiplier = 1;

    // Convert to bytes
    if (unit1) {
      const sci = ['b', 'k', 'm', 'g', 't', 'p', 'e', 'z', 'y'];
      const split = unit1.split('');
      if (sci.includes(split[0].toLowerCase())) {
        multiplier *= 1000 ** sci.indexOf(split[0].toLowerCase());
      } else {
        // M default
        multiplier *= 1000 ** 2;
      }
    }

    return float * multiplier;
  }

  static parseHTTPRange(range) {
    const match = range.match(/(\d+)-(\d+)?/);
    if (!match) return [undefined, undefined];
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    return [start, end];
  }
}
