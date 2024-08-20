/*
  From BGUtils

  MIT License

  Copyright (c) 2024 LuanRT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import {EnvUtils} from '../../utils/EnvUtils.mjs';
import {SandboxedEvaluator} from '../../utils/SandboxedEvaluator.mjs';
import {Proto, Utils} from '../../modules/yt.mjs';

const BASE_URL = 'https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa';
const CREATE_CHALLENGE_URL = BASE_URL + '/Create';
const GENERATE_IT_URL = BASE_URL + '/GenerateIT';
const DEFAULT_API_KEY = atob('QUl6YVN5RHlUNVcwSmg0OUYzMFBxcXR5ZmRmN3BETEZLTEpvQW53');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)';
const DEFAULT_REQUEST_TOKEN = atob('TzQzejBkcGpoZ1gyMFNDeDRLQW8=');

export class BgUtils {
  static base64ToU8(base64) {
    const base64urlToBase64Map = {
      '-': '+',
      '_': '/',
      '.': '=',
    };

    let base64Mod;

    if ((/[-_.]/g).test(base64)) {
      base64Mod = base64.replace(base64urlCharRegex, function(match) {
        return base64urlToBase64Map[match];
      });
    } else {
      base64Mod = base64;
    }

    base64Mod = atob(base64Mod);

    const result = new Uint8Array(
        [...base64Mod].map(
            (char) => char.charCodeAt(0),
        ),
    );

    return result;
  }

  static u8ToBase64(u8, base64url = false) {
    const result = btoa(String.fromCharCode(...u8));

    if (base64url) {
      return result
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
    }

    return result;
  }

  static async createChallenge(requestToken, interpreterHash, apiKey) {
    const payload = [requestToken];

    if (interpreterHash) {
      payload.push(interpreterHash);
    }

    const response = await BgUtils.fetch(CREATE_CHALLENGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'User-Agent': USER_AGENT,
        'x-goog-api-key': apiKey,
        'x-user-agent': 'grpc-web-javascript/0.1',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`[Challenge]: Failed to fetch challenge: ${response.status}`);
    }

    const challenge = await response.json();

    if (challenge.length > 1 && challenge[1]) {
      const parsedChallenge = BgUtils.parseChallenge(challenge[1]);
      if (parsedChallenge) {
        return parsedChallenge;
      }
    }
  }

  static parseChallenge(challenge) {
    const buffer = BgUtils.base64ToU8(challenge);

    if (buffer.length) {
      const shifted = new TextDecoder().decode(buffer.map((b) => b + 97));
      const [messageId, script, , interpreterHash, challenge, globalName] = JSON.parse(shifted);

      return {
        script,
        interpreterHash,
        globalName,
        challenge,
        messageId,
      };
    }
  }

  static async fetch(input, init) {
    // url
    const url = typeof input === 'string' ?
                  new URL(input) :
                  input instanceof URL ?
                      input :
                      new URL(input.url);

    const headers = init?.headers ?
                  new Headers(init.headers) :
                  input instanceof Request ?
                      input.headers :
                      new Headers();

    const redirectHeaders = [
      'user-agent',
    ];

    const removeHeaders = [
      'user-agent',
      'origin',
      'referer',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'x-client-data',
      'priority',
      'accept',
      'accept-encoding',
      'accept-language',
      'cache-control',
      'pragma',
    ];

    // now serialize the headers
    let headersArr = [...headers];
    const customHeaderCommands = [];
    headersArr = headersArr.filter((header) => {
      const name = header[0];
      const value = header[1];
      if (redirectHeaders.includes(name.toLowerCase())) {
        customHeaderCommands.push({
          operation: 'set',
          header: name,
          value,
        });
        return false;
      } else if (removeHeaders.includes(name.toLowerCase())) {
        removeHeaders.splice(removeHeaders.indexOf(name.toLowerCase()), 1);
        return false;
      }
      return true;
    });

    const newHeaders = new Headers(headersArr);

    removeHeaders.forEach((header) => {
      customHeaderCommands.push({
        operation: 'remove',
        header: header,
      });
    });

    if (EnvUtils.isExtension()) {
      await chrome.runtime.sendMessage({
        type: 'header_commands',
        url: url.toString(),
        commands: customHeaderCommands,
      });
    }
    // fetch the url
    return fetch(input, init ? {
      ...init,
      headers: newHeaders,
    } : {
      headers: newHeaders,
    });
  }

  static getRunnerFn1() {
    const fn1 =
    `(script, challenge) => {
      const invoke = async () => {
        new Function(script)();
        const vm = window[challenge.globalName];

        if (!vm) {
          throw new Error('[BG]: VM not found in the global object');
        }

        const attFunctions = {fn1: null, fn2: null, fn3: null, fn4: null};
        function attFunctionsCallback(fn1, fn2, fn3, fn4) {
          attFunctions.fn1 = fn1;
          attFunctions.fn2 = fn2;
          attFunctions.fn3 = fn3;
          attFunctions.fn4 = fn4;
        }

        if (!vm.a) {
          throw new Error('[BG]: Init failed');
        }

        try {
          await vm.a(challenge.challenge, attFunctionsCallback, true, undefined, (...args) => {
          });
        } catch (err) {
          throw new Error(\`[BG]: Failed to load program: \${err.message}\`);
        }

        if (!attFunctions.fn1) {
          throw new Error('[BG]: Att function 1 unavailable. Cannot proceed.');
        }

        let bgResponse = null;
        const postProcessFunctions = [];

        await attFunctions.fn1((response) => {
          bgResponse = response;
        }, [, , postProcessFunctions]);


        if (!bgResponse) {
          throw new Error('[BG]: No response');
        }

        if (!postProcessFunctions.length) {
          throw new Error('[BG]: Got response but no post-process functions');
        }

        window.postProcessFunctions = postProcessFunctions;

        return bgResponse;
      };

      return invoke();
    }`;

    return SandboxedEvaluator.extractFnBodyAndArgs(fn1);
  }

  static getRunnerFn2() {
    const fn2 =
      `(integrityToken, visitorData) => {
      const postProcessor = window.postProcessFunctions[0];
      if (!postProcessor) {
        throw new Error('PMD:Undefined');
      }


      const base64ToU8 = (base64) => {
        const base64urlToBase64Map = {
          '-': '+',
          '_': '/',
          '.': '=',
        };

        let base64Mod;

        if ((/[-_.]/g).test(base64)) {
          base64Mod = base64.replace(base64urlCharRegex, function(match) {
            return base64urlToBase64Map[match];
          });
        } else {
          base64Mod = base64;
        }

        base64Mod = atob(base64Mod);

        const result = new Uint8Array(
            [...base64Mod].map(
                (char) => char.charCodeAt(0),
            ),
        );

        return result;
      };


      const u8ToBase64 = (u8, base64url = false) => {
        const result = btoa(String.fromCharCode(...u8));

        if (base64url) {
          return result
              .replace(/\\+/g, '-')
              .replace(/\\//g, '_');
        }

        return result;
      };

      const invoke = async () =>{
        const acquirePo = await postProcessor(base64ToU8(integrityToken));

        if (typeof acquirePo !== 'function') {
          throw new Error('APF:Failed');
        }

        const buffer = await acquirePo(new TextEncoder().encode(visitorData));

        const poToken = u8ToBase64(buffer, true);

        if (poToken.length > 80) {
          return poToken;
        } else {
          throw new Error('Small PoToken');
        }
      };

      return invoke();
    }`;
    return SandboxedEvaluator.extractFnBodyAndArgs(fn2);
  }

  static async getTokens(visitorData, requestToken, apiKey, debug = false) {
    if (!requestToken) {
      requestToken = DEFAULT_REQUEST_TOKEN;
    }

    if (!apiKey) {
      apiKey = DEFAULT_API_KEY;
    }

    if (!visitorData) {
      visitorData = Proto.encodeVisitorData(Utils.generateRandomString(11), Math.floor(Date.now() / 1000));
    }

    const evaluator = new SandboxedEvaluator();
    let poToken = null;
    let ttl = null;
    let refresh = null;
    try {
      if (!debug) evaluator.setTimeout(5000);
      await evaluator.load();
      if (!debug) evaluator.setTimeout(null);

      const challenge = await BgUtils.createChallenge(requestToken, null, apiKey);

      if (!challenge) {
        throw new Error('Could not get challenge');
      }

      if (!challenge.script) {
        throw new Error('Could not get challenge script');
      }

      const script = challenge.script.find((sc) => sc !== null);
      if (!script) {
        throw new Error('Could not get non-null challenge script');
      }

      if (!debug) evaluator.setTimeout(5000);
      const fn1 = this.getRunnerFn1();
      const response = await evaluator.evaluate(fn1.body, fn1.argNames, [script, challenge]);
      if (!debug) evaluator.setTimeout(null);

      const payload = [requestToken, response];
      const response2 = await BgUtils.fetch(GENERATE_IT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json+protobuf',
          'x-goog-api-key': apiKey,
          'x-user-agent': 'grpc-web-javascript/0.1',
          'User-Agent': USER_AGENT,
          'Accept': '*/*',
        },
        body: JSON.stringify(payload),
      });

      if (!response2.ok) {
        throw new Error('[GenerateIT]: Failed to generate integrity token');
      }

      const tokenData = await response2.json();

      if (!tokenData.length || !tokenData[0]) {
        throw new Error('[GenerateIT]: Expected an integrity token but got none');
      }

      const integrityToken = tokenData[0];
      ttl = tokenData[1];
      refresh = tokenData[2];
      if (!debug) evaluator.setTimeout(5000);
      const fn2 = this.getRunnerFn2();
      poToken = await evaluator.evaluate(fn2.body, fn2.argNames, [integrityToken, visitorData]);

      if (!debug) evaluator.close();
    } catch (err) {
      if (!debug) evaluator.close();
      throw err;
    }
    return {poToken, visitorData, requestToken, ttl, refresh};
  }
}
