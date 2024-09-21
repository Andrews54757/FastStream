export class TimeStampFixer {
  constructor() {
    this.lastPts = null;
  }

  unwrapPts(value, reference) {
    let offset;
    if (reference === null) {
      return value;
    }
    if (reference < value) {
      // - 2^33
      offset = -8589934592;
    } else {
      // + 2^33
      offset = 8589934592;
    }
    /* PTS is 33bit (from 0 to 2^33 -1)
      if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
      PTS looping occured. fill the gap */
    while (Math.abs(value - reference) > 4294967296) {
      value += offset;
    }
    return value;
  }

  fix(samples) {
    // First, fix wrapping of PTS values
    for (const sample of samples) {
      if (sample.pts !== null) {
        if (this.lastPts === null) {
          this.lastPts = sample.pts;
        } else {
          sample.pts = this.unwrapPts(sample.pts, this.lastPts);
          this.lastPts = sample.pts;
        }
      }
    }

    // Fix null values by interpolating from previous and next values
    // Null can be given by webm files with interlacing.
    const prevPtsValue = null;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (sample.pts === null) {
        if (prevPtsValue === null) {
          continue; // Can't interpolate without a previous value
        }

        let nextPtsIndex = i + 1;
        while (nextPtsIndex < samples.length && samples[nextPtsIndex].pts === -1) {
          nextPtsIndex++;
        }

        if (nextPtsIndex === samples.length) {
          break; // Can't interpolate without a next value
        }

        const nextPtsValue = samples[nextPtsIndex].pts;
        const deltaPts = nextPtsValue - prevPtsValue;
        const deltaSamples = nextPtsIndex - i + 2;
        const delta = deltaPts / deltaSamples;
        const startInterpolatingIndex = i;
        for (; i < nextPtsIndex; i++) {
          sample.pts = prevPtsValue + delta * (1 + i - startInterpolatingIndex);
        }
        prevPtsValue = nextPtsValue;
      } else {
        prevPtsValue = sample.pts;
      }
    }

    // Fix the first, last couple of samples if they are null by assuming a constant delta
    let firstPtsValue = null;
    let lastPtsValue = null;
    let firstPtsIndex = null;
    let lastPtsIndex = null;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (sample.pts !== null) {
        firstPtsValue = sample.pts;
        firstPtsIndex = i;
        break;
      }
    }

    for (let i = samples.length - 1; i >= 0; i--) {
      const sample = samples[i];
      if (sample.pts !== null) {
        lastPtsValue = sample.pts;
        lastPtsIndex = i;
        break;
      }
    }

    if (firstPtsValue !== null && lastPtsValue !== null) {
      const deltaPts = lastPtsValue - firstPtsValue;
      const deltaSamples = lastPtsIndex - firstPtsIndex + 1;
      const delta = deltaPts / deltaSamples;

      for (let i = 0; i < firstPtsIndex; i++) {
        samples[i].pts = firstPtsValue - delta * (firstPtsIndex - i);
      }

      for (let i = lastPtsIndex + 1; i < samples.length; i++) {
        samples[i].pts = lastPtsValue + delta * (i - lastPtsIndex);
      }

      this.lastPts = samples[samples.length - 1].pts;
    } else {
      // If we have no samples with valid PTS values, just set them to 0
      for (let i = 0; i < samples.length; i++) {
        samples[i].pts = this.lastPts || 0;
      }
      console.warn('No samples with valid PTS values');
    }
  }
}
