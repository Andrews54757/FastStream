/**
 * SubtitleTranslator.mjs
 * "Interactive" Version: Opens the specific API URL to force the CAPTCHA check.
 */
export class SubtitleTranslator {
  constructor() {
    this.apis = [
      {
        name: "gtx",
        url: "https://translate.googleapis.com/translate_a/single",
        params: { client: "gtx", dt: "t" },
        batchSize: 8,
        delay: 3000
      },
      {
        name: "clients5",
        url: "https://clients5.google.com/translate_a/t",
        params: { client: "dict-chrome-ex" },
        batchSize: 12, 
        delay: 3000
      }
    ];
    this.currentApiIndex = 0;
  }

  async translateStream(cues, targetLang, onProgress) {
    if (!cues || cues.length === 0) throw new Error("No cues found.");

    let api = this.apis[this.currentApiIndex];
    
    // FIX: Use double newline. This forces Google to treat cues as separate paragraphs.
    // Single newlines cause Japanese/Chinese lines to merge during translation.
    let delimiter = "\n\n"; 

    for (let i = 0; i < cues.length; i += api.batchSize) {
      api = this.apis[this.currentApiIndex];
      
      const batch = cues.slice(i, i + api.batchSize);
      const texts = batch.map(c => c.text.replace(/\r?\n|\r/g, " ").trim());
      
      try {
        const translatedTexts = await this.fetchWithRetry(texts, targetLang, delimiter, api);
        
        const segmentCues = [];
        batch.forEach((cue, index) => {
          // Safety check: ensure we have a translation for this index
          if (translatedTexts[index]) {
            segmentCues.push({
              startTime: cue.startTime,
              endTime: cue.endTime,
              text: translatedTexts[index]
            });
          }
        });

        if (onProgress) onProgress(segmentCues, null);
        await this.delay(api.delay);

      } catch (e) {
        console.warn(`[FastStream] API ${api.name} error:`, e);

        // CHECK FOR BAN
        if (e.message.includes("429") || e.message.includes("Rate Limit")) {
            if (onProgress) onProgress([], "⚠️ Google Ban Detected. Opening Unblocker...");
            
            // CONSTRUCT THE EXACT URL THAT IS BLOCKED
            const testUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${targetLang}&q=Hello%20World`;
            
            // 1. Open the specific API URL
            window.open(testUrl, "_blank");
            
            // 2. Pause and ask user
            const resolved = confirm(
                "Google has temporarily blocked the translation signal.\n\n" +
                "1. A new tab has opened with a weird code page.\n" +
                "2. IF you see a CAPTCHA ('I am not a robot'), solve it.\n" +
                "3. IF you just see text code (JSON), close the tab.\n\n" +
                "Click OK when you are done to resume."
            );

            if (resolved) {
                if (onProgress) onProgress([], "Resuming...");
                // Wait 5 seconds for the unblock to register
                await this.delay(5000);
                i -= api.batchSize; // Retry batch
                continue;
            } else {
                throw new Error("Translation stopped by user.");
            }
        }

        // Normal rotation for other errors
        this.currentApiIndex = (this.currentApiIndex + 1) % this.apis.length;
        api = this.apis[this.currentApiIndex];
        i -= api.batchSize; 
        await this.delay(2000);
      }
    }
  }

  async fetchWithRetry(texts, targetLang, delimiter, api) {
    const combinedText = texts.join(delimiter);
    const params = new URLSearchParams({
      ...api.params,
      sl: "auto",
      tl: targetLang,
      q: combinedText
    });

    const response = await fetch(`${api.url}?${params.toString()}`);

    // If 429 or redirected to the "Sorry" page
    if (response.status === 429 || response.url.includes("google.com/sorry")) {
        throw new Error("429 Rate Limit");
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    let fullText = "";

    if (api.name === "clients5") {
        if (Array.isArray(data)) {
            if (typeof data[0] === 'string') fullText = data[0];
            else data.forEach(item => { if (item && item[0]) fullText += item[0]; });
        }
    } else {
        if (data && data[0]) {
            data[0].forEach(segment => {
                if (segment[0]) fullText += segment[0];
            });
        }
    }

    // Split by the double newline to get original segments back
    return fullText.split(delimiter).map(s => s.trim());
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}