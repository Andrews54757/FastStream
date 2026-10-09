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
    // An empty regex matches every string
    if (!regex) {
      throw new Error('Empty regex for ' + output);
    }

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

      // Named groups: a pattern's own capture groups would shift group positions
      const joinedRegexes = [];
      const outputs = new Map();
      regexesByOutput.forEach((regexes, output) => {
        const groupName = '__fsOutput' + outputs.size;
        joinedRegexes.push(`(?<${groupName}>` + regexes.join('|') + ')');
        outputs.set(groupName, output);
      });

      this.compiledRegexes.push({
        regex: new RegExp(joinedRegexes.join('|'), flags),
        outputs,
      });
    });
  }

  match(str) {
    for (const {regex, outputs} of this.compiledRegexes) {
      // exec() from the start: str.match() gives no groups for a g regex,
      // and g or y would carry lastIndex over from the previous call
      regex.lastIndex = 0;
      const match = regex.exec(str);
      if (match) {
        for (const [groupName, output] of outputs) {
          if (match.groups[groupName] !== undefined) {
            return output;
          }
        }
      }
    }
    return null;
  }
}
