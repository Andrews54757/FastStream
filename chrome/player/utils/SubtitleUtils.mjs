export class SubtitleUtils {
  static translateXMLEntities(str) {
    const entitiesList = {
      '&amp;': '&',
      '&gt;': '>',
      '&lt;': '<',
      '&quot;': '"',
      '&apos;': '\'',
    };

    const entitySplit = str.split(/(&[#a-zA-Z0-9]+;)/);
    if (entitySplit.length <= 1) { // No entities. Skip the rest of the function.
      return str;
    }

    for (let i = 1; i < entitySplit.length; i += 2) {
      const reference = entitySplit[i];
      if (reference.charAt(1) === '#') {
        let code;
        if (reference.charAt(2) === 'x') { // Hexadecimal
          code = parseInt(reference.substring(3, reference.length - 1), 16);
        } else { // Decimal
          code = parseInt(reference.substring(2, reference.length - 1), 10);
        }

        // Translate into string according to ISO/IEC 10646
        if (!isNaN(code) && code >= 0 && code <= 0x10FFFF) {
          entitySplit[i] = String.fromCodePoint(code);
        }
      } else if (entitiesList.hasOwnProperty(reference)) {
        entitySplit[i] = entitiesList[reference];
      }
    }

    return entitySplit.join('');
  }

  static srt2webvtt(data) {
    // remove dos newlines
    let srt = data.replace(/\r+/g, '');
    // trim white space start and end
    srt = srt.replace(/^\s+|\s+$/g, '');
    // get cues
    const cuelist = srt.split('\n\n');
    let result = '';
    if (cuelist.length > 0) {
      result += 'WEBVTT\n\n';
      for (let i = 0; i < cuelist.length; i = i + 1) {
        result += this.convertSrtCue(cuelist[i]);
      }
    }
    return result;
  }

  static xml2vtt(data) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(data, 'text/xml');
    const cues = xml.getElementsByTagName('text');
    const result = ['WEBVTT'];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const start = parseFloat(cue.getAttribute('start'));
      const dur = parseFloat(cue.getAttribute('dur'));
      const end = start + dur;
      const text = this.translateXMLEntities(cue.textContent);
      result.push((i + 1) + '\n' + this.vttTimeFormat(start) + ' --> ' + this.vttTimeFormat(end) + '\n' + text);
    }
    return result.join('\n\n');
  }

  static vttTimeFormat(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec / 60) % 60;
    const s = Math.floor(sec % 60);
    const ms = Math.floor(sec * 1000) % 1000;

    const hh = (100 + h).toString().substring(1);
    const mm = (100 + m).toString().substring(1);
    const ss = (100 + s).toString().substring(1);
    const msms = (1000 + ms).toString().substring(1);
    // HH:MM:SS,MS
    return hh + ':' + mm + ':' + ss + '.' + msms;
  }

  static srtTimeFormat(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec / 60) % 60;
    const s = Math.floor(sec % 60);
    const ms = Math.floor(sec * 1000) % 1000;

    const hh = (100 + h).toString().substring(1);
    const mm = (100 + m).toString().substring(1);
    const ss = (100 + s).toString().substring(1);
    const msms = (1000 + ms).toString().substring(1);
    // HH:MM:SS,MS
    return hh + ':' + mm + ':' + ss + ',' + msms;
  }

  static cuesToSrt(cues) {
    const result = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const start = this.srtTimeFormat(cue.startTime);
      const end = this.srtTimeFormat(cue.endTime);
      const text = cue.text;
      result.push((i + 1) + '\n' + start + ' --> ' + end + '\n' + text);
    }
    return result.join('\n\n');
  }

  static convertSrtCue(caption) {
    // remove all html tags for security reasons
    // srt = srt.replace(/<[a-zA-Z\/][^>]*>/g, '');
    let cue = '';
    const s = caption.split(/\n/);
    if (s.length < 2) {
      // file format error or comment lines
      return '';
    }
    // concatenate muilt-line string separated in array into one
    while (s.length > 3) {
      for (let i = 3; i < s.length; i++) {
        s[2] += '\n' + s[i];
      }
      s.splice(3, s.length - 3);
    }
    let line = 0;
    // detect identifier
    if (!s[0].match(/\d+:\d+:\d+/) && s[1].match(/\d+:\d+:\d+/)) {
      cue += s[0].match(/\w+/) + '\n';
      line += 1;
    }
    // get time strings
    if (s[line].match(/\d+:\d+:\d+/)) {
      // convert time string
      const m = s[1].match(/(\d+):(\d+):(\d+)(?:,(\d+))?\s*--?>\s*(\d+):(\d+):(\d+)(?:,(\d+))?/);
      if (m) {
        cue += m[1] + ':' + m[2] + ':' + m[3] + '.' + m[4] + ' --> ' +
                    m[5] + ':' + m[6] + ':' + m[7] + '.' + m[8] + '\n';
        line += 1;
      } else {
        // Unrecognized timestring
        return '';
      }
    } else {
      // file format error or comment lines
      return '';
    }
    // get cue text
    if (s[line]) {
      cue += s[line] + '\n\n';
    }
    return cue;
  }

  static convertSubtitleFormatting(text) {
    return text
        .replace(/\{\\([ibu])1\}/g, '<$1>') // convert {\b1}, {\i1}, {\u1} to <b>, <i>, <u>
        .replace(/\{\\([ibu])\}/g, '</$1>') // convert {\b}, {\i}, {\u} to </b>, </i>, </u>
        .replace(/\{([ibu])\}/g, '<$1>') // convert {b}, {i}, {u} to <b>, <i>, <u>
        .replace(/\{\/([ibu])\}/g, '</$1>') // convert {/b}, {/i}, {/u} to </b>, </i>, </u>
        .replace(/(\r\n|\n)\{\\an8\}/g, ' line:5%\n'); // handle top positioning
  }
}
