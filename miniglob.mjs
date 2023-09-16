//
// miniglob is a port of golang path/filepath
//
// Original Go source code Copyright (c) 2009 The Go Authors.
// All rights reserved. See LICENSE-go for complete license.
//
// This code licensed under MIT, Copyright (c) 2018 Rasmus Andersson.
// See LICENSE for complete license.
//
import {readdirSync, statSync} from 'fs';

const DIRSEP = (() => {
  try {
    return require('path').sep;
  } catch (_) {
    return '/';
  }
})();
const DIRSEP_BYTE = DIRSEP.charCodeAt(0);
const DIRSEP_RE_PG = DIRSEP == ':' ? /\:+/g : DIRSEP == '\\' ? /\\+/g : /\/+/g;
const WIN32 = process.platform == 'win32';


export class PatternError extends Error {
  constructor() {
    super('bad pattern');
  }
}


export function glob(pattern) {
  if (pattern.indexOf('**') < 0) {
    return glob0(pattern);
  }
  const matches = [];
  const filesVisited = new Set();
  deepglob('', pattern.split(/\*{2,}/), 0, matches, filesVisited);
  return matches;
}


function log() {
  // console.log.apply(console, arguments)
}


// volumeNameLen returns length of the leading volume name on Windows.
// It returns 0 elsewhere.
const volumeNameLen = WIN32 ? (path) => {
  if (path.length < 2) {
    return 0;
  }
  // with drive letter
  const c = path[0];
  if (path[1] == ':' && ('a' <= c && c <= 'z' || 'A' <= c && c <= 'Z')) {
    return 2;
  }
  // TODO: check for UNC
  return 0;
} : (path) => 0;


// cleanGlobPath prepares path for glob matching.
// cleanGlobPath(path :string) : [prefixLen int, cleaned string]
//
const cleanGlobPath = (
  WIN32 ? (path, volumeNameLen) => { // (prefixLen int, cleaned string)
    let vollen = volumeNameLen(path);
    if (path == '') {
      return [0, '.'];
    }
    if (vollen+1 == path.length && isPathSep(path, path.length-1)) {
      // /, \, C:\ and C:/ -- do nothing to the path
      return [vollen + 1, path];
    }
    if (vollen == path.length && path.length == 2) { // C:
      return [vollen, path + '.']; // convert C: into C:.
    }
    if (vollen >= path.length) {
      vollen = path.length - 1;
    }
    return [vollen, path.substr(0, path.length-1)]; // chop off trailing separator
  } : (path, volumeNameLen) => {
    if (path == '') {
      return [volumeNameLen, '.'];
    }
    if (path == DIRSEP) {
      // do nothing to the path
      return [volumeNameLen, path];
    }
    return [volumeNameLen, path.substr(0, path.length-1)]; // chop off trailing separator
  }
);


function isPathSep(s, i) {
  return s.charCodeAt(i) === DIRSEP_BYTE;
}


// ("/foo///") => "/foo"
function stripDirSepRight(s) {
  const e = s.length - 1; let p = e;
  while (s.charCodeAt(p) === DIRSEP_BYTE) {
    p--;
  }
  return p != e ? s.substr(0, p + 1) : s;
}

// ("///foo/") => "foo/"
function stripDirSepLeft(s) {
  const e = 0; let p = e;
  while (s.charCodeAt(p) === DIRSEP_BYTE) {
    p++;
  }
  return p != e ? s.substr(p) : s;
}


// deepglob(parts :string[]) string[] | null
//
function deepglob(dir, parts, partIndex, matches, filesVisited) {
  if (partIndex >= parts.length) {
    partIndex = parts.length - 1;
  }

  const part = parts[partIndex];
  let pattern = part;

  if (partIndex === 0) {
    // first part
    if (part.charCodeAt(part.length - 1) != DIRSEP_BYTE) {
      // e.g. input="part**"; part="part"; pattern="part*"
      pattern += '*';
    } // else e.g. input="part/**"
  } else if (partIndex === parts.length-1) {
    // last part
    if (part.charCodeAt(0) != DIRSEP_BYTE) {
      // e.g. input="**part"; part="part"; pattern="*part"
      pattern = '*' + pattern;
    } // else e.g. input="**/part"
  } else {
    // mid part
    if (part.charCodeAt(0) != DIRSEP_BYTE) {
      // e.g. input="**part**"; part="part"; pattern="*part"
      pattern = '*' + pattern;
    } // else e.g. input="**/part**"
    if (part.charCodeAt(part.length - 1) != DIRSEP_BYTE) {
      // e.g. input="**part**"; part="part"; pattern="part*"
      pattern += '*';
    } // else e.g. input="**part/**"
  }


  function markVisit(path) {
    if (filesVisited.has(path)) {
      return false;
    }
    filesVisited.add(path);
    return true;
  }


  function maybeAddFile(path) {
    let filename = path;
    const p = filename.lastIndexOf(DIRSEP);
    if (p != -1) {
      filename = filename.substr(p + 1);
    }

    const nextPartIndex = Math.min(partIndex + 1, parts.length - 1);
    let pat = parts.slice(nextPartIndex).join('*');

    if (pat.charCodeAt(0) == DIRSEP_BYTE) {
      pat = stripDirSepLeft(pat);
    } else if (pat[0] != '*') {
      pat = '*' + pat;
    }

    if (match(pat, filename)) {
      matches.push(path);
    }
  }

  if (dir) {
    if (pattern[0] != DIRSEP) {
      pattern = dir + DIRSEP + pattern;
    } else {
      pattern = dir + pattern;
    }
  }

  let isDirPattern = false;
  if (pattern.charCodeAt(pattern.length-1) === DIRSEP_BYTE) {
    isDirPattern = true;
    pattern = stripDirSepRight(pattern);
  }

  const paths = glob0(pattern);

  for (const path of paths) {
    const st = statSync(path);

    if (st.isDirectory()) {
      if (markVisit(path)) {
        walkdir(path, (path, st) => {
          if (markVisit(path)) {
            if (st.isDirectory()) {
              deepglob(path, parts, partIndex + 1, matches, filesVisited);
            } else {
              maybeAddFile(path);
            }
          }
        });
      }
    } else if (!isDirPattern && markVisit(path)) {
      maybeAddFile(path);
    }
  }

  return matches;
}


function walkdir(dir, callback) {
  dir = pclean(dir);
  const st = statSync(dir);
  if (st.isDirectory()) {
    _walkdir(dir, callback, new Set([st.ino]));
  }
}


function _walkdir(dir, callback, visitedInodes) {
  for (const name of readdirSync(dir)) {
    const path = pjoin(dir, name);
    const st = stat(path);
    const result = callback(path, st);
    if (
      (result || result === undefined) &&
      st && st.isDirectory() && !visitedInodes.has(st.ino)
    ) {
      visitedInodes.add(st.ino);
      _walkdir(path, callback, visitedInodes);
    }
  }
}


// Glob returns the names of all files matching pattern or null
// if there is no matching file. The syntax of patterns is the same
// as in Match. The pattern may describe hierarchical names such as
// /usr/*/bin/ed (assuming the Separator is '/').
//
// Glob ignores file system errors such as I/O errors reading directories.
// The only possible error is 'bad pattern', when pattern is malformed.
//
// glob(pattern :string) : string[] | null (matches)
function glob0(pattern) {
  const matches = [];

  if (!hasMeta(pattern)) {
    if (stat(pattern)) {
      return [pattern];
    }
    return matches;
  }

  // dirname, basename
  let volumeLen = volumeNameLen(pattern);
  let i = pattern.length - 1;
  while (i >= volumeLen && !isPathSep(pattern, i)) {
    i--;
  }
  let dir = pattern.substr(0, i+1);
  const file = pattern.substr(i+1)

  ;[volumeLen, dir] = cleanGlobPath(dir, volumeLen);

  if (!hasMeta(dir.substr(volumeLen))) {
    _glob(dir, file, matches);
  } else {
    // Prevent infinite recursion. See golang issue 15879.
    if (dir == pattern) {
      throw new PatternError();
    }
    const m = glob0(dir); // :string[]
    for (const d of m) {
      _glob(d, file, matches);
    }
  }

  return matches;
}


// glob searches for files matching pattern in the directory dir
// and appends them to matches. If the directory cannot be
// opened, it returns the existing matches. New matches are
// added in lexicographical order.
//
// _glob(dir :string, pattern :string, matches :string[])
//
function _glob(dir, pattern, matches) {
  const fi = stat(dir);
  if (fi === null) {
    return;
  }
  if (!fi.isDirectory()) {
    return;
  }

  let names;
  try {
    names = readdirSync(dir);
  } catch (_) {
    return;
  }
  names.sort();

  for (const n of names) {
    if (match(pattern, n)) {
      matches.push(pjoin(dir, n));
    }
  }
}


// hasMeta reports whether path contains any of the magic characters
// recognized by match.
function hasMeta(path /* string*/) /* bool*/ {
  for (let i = 0; i < path.length; ++i) {
    switch (path.charCodeAt(i)) {
      case 0x2A: // *
      case 0x3F: // ?
      case 0x5B: // [
      case 0x7B: // {
        return true;
    }
  }
  return false;
}


// strContainsCh(s :string, c :int) : bool
function strContainsCh(s, c) {
  for (let i = 0; i < s.length; ++i) {
    if (s.charCodeAt(i) === c) {
      return true;
    }
  }
  return false;
}


// Match reports whether name matches the shell file name pattern.
// The pattern syntax is:
//
//  pattern:
//    { term }
//  term:
//    '*'         matches any sequence of non-Separator characters
//    '?'         matches any single non-Separator character
//    '[' [ '^' ] { character-range } ']'
//                character class (must be non-empty)
//    c           matches character c (c != '*', '?', '\\', '[')
//    '\\' c      matches character c
//
//  character-range:
//    c           matches character c (c != '\\', '-', ']')
//    '\\' c      matches character c
//    lo '-' hi   matches character c for lo <= c <= hi
//
// Match requires pattern to match all of name, not just a substring.
// The only possible returned error is ErrBadPattern, when pattern
// is malformed.
//
// On Windows, escaping is disabled. Instead, '\\' is treated as
// path separator.
//
// match(pattern :string, name :string) : bool (matched)
//
export function match(pattern, name) {
  Pattern:
  while (pattern.length > 0) {
    let star = false; // :bool
    let chunk = ''; // :string

    const patternin = pattern
    ;[star, chunk, pattern] = scanChunk(pattern);
    log(`scanChunk(%o) => %o`, patternin, [star, chunk, pattern]);

    if (star && chunk == '') {
      log('ret');
      // Trailing * matches rest of string unless it has a /.
      return !strContainsCh(name, DIRSEP_BYTE);
    }

    // Look for match at current position.
    let [t, ok] = matchChunk(chunk, name);
    log(`matchChunk(%o, %o) => %o`, chunk, name, [t, ok]);

    // if we're the last chunk, make sure we've exhausted the name
    // otherwise we'll give a false result even if we could still match
    // using the star
    if (ok && (t.length == 0 || pattern.length > 0)) {
      name = t;
      continue;
    }

    if (star) {
      // Look for match skipping i+1 bytes.
      // Cannot skip /.
      for (let i = 0; i < name.length && name.charCodeAt(i) != DIRSEP_BYTE; i++) {
        ;[t, ok] = matchChunk(chunk, name.substr(i+1));
        if (ok) {
          // if we're the last chunk, make sure we exhausted the name
          if (pattern.length == 0 && t.length > 0) {
            continue;
          }
          name = t;
          continue Pattern;
        }
      }
    }

    return false;
  }

  return name.length == 0;
}


// scanChunk gets the next segment of pattern, which is a non-star string
// possibly preceded by a star.
//
// scanChunk(pattern :string) : [star bool, chunk string, rest string]
function scanChunk(pattern) {
  let star = false;
  while (pattern.length > 0 && pattern.charCodeAt(0) == 0x2A) { // *
    pattern = pattern.substr(1);
    star = true;
  }
  let inrange = false;
  let i = 0 >> 0; // int

  Scan:
  for (; i < pattern.length; i++) {
    switch (pattern.charCodeAt(i)) {
      case 0x5C: // \
        if (!WIN32) {
        // error check handled in matchChunk: bad pattern.
          if (i + 1 < pattern.length) {
            i++;
          }
        }
        break;
      case 0x5B: // [
        inrange = true;
        break;
      case 0x5D: // ]
        inrange = false;
        break;
      case 0x2A: // *
        if (!inrange) {
          break Scan;
        }
        break;
    }
  }
  return [star, pattern.substr(0, i), pattern.substr(i)];
}


// matchChunk checks whether chunk matches the beginning of s.
// If so, it returns the remainder of s (after the match).
// Chunk is all single-character operators: literals, char classes, and ?.
//
// matchChunk(chunk :string, s :string) [rest string, ok bool]
//
function matchChunk(chunk, s) {
  log('enter matchChunk(%o, %o)', chunk, s);

  while (chunk.length > 0) {
    if (s.length == 0) {
      return ['', false];
    }

    switch (chunk.charCodeAt(0)) {
      case 0x5B: { // [
      // character class
      // let [r, n] = utf8.DecodeRuneInString(s)
        const r = s.codePointAt(0);
        const n = r <= 0xFFFF ? 1 : 2;
        s = s.substr(n);
        chunk = chunk.substr(1);
        log('"[" s reduced to %o, chunk reduced to %o, r = 0x%s', s, chunk, r.toString(16));

        // We can't end right after '[', we're expecting at least
        // a closing bracket and possibly a caret.
        if (chunk.length == 0) {
          throw new PatternError();
        }
        // possibly negated
        const negated = chunk.charCodeAt(0) == 0x5E; // ^
        if (negated) {
          log('"[" negation from "^"');
          chunk = chunk.substr(1);
        }
        // parse all ranges
        let match = false;
        let nrange = 0;
        while (true) {
          if (chunk.length > 0 && chunk.charCodeAt(0) == 0x5D /* ]*/ && nrange > 0) {
            log('"[" loop break at A');
            chunk = chunk.substr(1);
            break;
          }

          let ok; let lo; // bool, unichar
          const debug_chunk = chunk
        ;[lo, chunk, ok] = getEsc(chunk); // [ok bool, r rune, nchunk string]
          log('"[" loop getEsc(%o) => %o', debug_chunk, [lo, chunk, ok]);
          if (!ok) {
            log('"[" loop return at B from failed getEsc');
            return ['', false];
          }

          let hi = lo;
          if (chunk.charCodeAt(0) == 0x2D /* -*/) {
            ;[hi, chunk, ok] = getEsc(chunk.substr(1));
            if (!ok) {
              return ['', false];
            }
          }

          if (lo <= r && r <= hi) {
            match = true;
          }

          nrange++;
        }
        if (match == negated) {
          return ['', false];
        }
        break;
      }

      case 0x3F: // ?
        if (s.charCodeAt(0) == DIRSEP_BYTE) {
          return ['', false];
        }
        // _, n := utf8.DecodeRuneInString(s)
        const r = s.codePointAt(0);
        const n = r <= 0xFFFF ? 1 : 2;
        s = s.substr(n);
        chunk = chunk.substr(1);
        break;

      case 0x5C: // \
        if (!WIN32) {
          log('"\\" consume');
          chunk = chunk.substr(1);
          if (chunk.length == 0) {
            throw new PatternError();
          }
        }
        // fallthrough

      default:
        if (chunk.charCodeAt(0) != s.charCodeAt(0)) {
          log('[def] chunk[0] != s[0] (%o != %o) (0x%s != 0x%s) -- return',
              chunk[0], s[0], chunk.charCodeAt(0).toString(16), s.charCodeAt(0).toString(16));
          return ['', false];
        }
        s = s.substr(1);
        chunk = chunk.substr(1);
        log('[def] s reduced to %o, chunk reduced to %o', s, chunk);
        break;
    }
  }

  return [s, true];
}


// getEsc gets a possibly-escaped character from chunk, for a character class.
//
// getEsc(chunk :string) : [ r rune, nchunk string, ok bool ]
//
function getEsc(chunk) {
  let r = 0;
  let nchunk = '';
  const c = chunk.charCodeAt(0);
  if (chunk.length == 0 || c == 0x2D /* -*/ || c == 0x5D /* ]*/) {
    throw new PatternError();
  }
  if (c == 0x5C /* \*/ && !WIN32) {
    chunk = chunk.substr(1);
    if (chunk.length == 0) {
      throw new PatternError();
    }
  }
  r = chunk.codePointAt(0);
  const n = r <= 0xFFFF ? 1 : 2;
  if (r == 0xFFFF && n == 1) {
    throw new PatternError();
  }
  nchunk = chunk.substr(n);
  if (nchunk.length == 0) {
    throw new PatternError();
  }
  return [r, nchunk, true];
}


function stat(path) {
  try {
    return statSync(path);
  } catch (_) {}
  return null;
}


function pjoin(path1, path2) {
  return (path1 == '.' || path1 == '') ? path2 : path1 + DIRSEP + path2;
}


// pclean("foo//bar//") => "foo/bar"
function pclean(path) {
  const endi = path.length - 1; let i = endi;
  while (i && path.charCodeAt(i) === DIRSEP_BYTE) {
    --i;
  }
  if (i != endi) {
    path = path.substr(0, i + 1);
  }
  return path.split(DIRSEP_RE_PG).join(DIRSEP);
}
