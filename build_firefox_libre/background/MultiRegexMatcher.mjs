export class MultiRegexMatcher {
  constructor() {
    this.compiledRegexes = [];
    this.uncompiledRegexes = [];
  }
  clear() {
    this.compiledRegexes.length = 0;
    this.uncompiledRegexes.length = 0;
  }
  addRegex(regex, flags, output) {
    // check if regex is valid
    try {
      new RegExp(regex, flags);
    } catch (e) {
      throw new Error('Invalid regex: ' + regex);
    }
    // check if regex is already added
    for (const {regex: existingRegex, flags: existingFlags, output: existingOutput} of this.uncompiledRegexes) {
      if (existingRegex === regex && existingFlags === flags && existingOutput === output) {
        return;
      }
    }
    // add regex
    this.uncompiledRegexes.push({regex, flags, output});
  }
  compile() {
    const regexesByFlags = new Map();
    for (const {regex, flags, output} of this.uncompiledRegexes) {
      if (!regexesByFlags.has(flags)) {
        regexesByFlags.set(flags, []);
      }
      regexesByFlags.get(flags).push({regex, output});
    }
    this.compiledRegexes.length = 0;
    regexesByFlags.forEach((regexes, flags) => {
      const regexesByOutput = new Map();
      for (const {regex, output} of regexes) {
        if (!regexesByOutput.has(output)) {
          regexesByOutput.set(output, []);
        }
        regexesByOutput.get(output).push(regex);
      }
      const joinedRegexes = [];
      const outputs = [];
      regexesByOutput.forEach((regexes, output) => {
        joinedRegexes.push('(' + regexes.join('|') + ')');
        outputs.push(output);
      });
      this.compiledRegexes.push({
        regex: new RegExp(joinedRegexes.join('|'), flags),
        outputs,
      });
    });
  }
  match(str) {
    for (const {regex, outputs} of this.compiledRegexes) {
      const match = str.match(regex);
      if (match) {
        return outputs[match.findIndex((v, i) => i > 0 && v) - 1];
      }
    }
    return null;
  }
}
