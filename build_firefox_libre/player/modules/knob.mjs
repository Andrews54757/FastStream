/* eslint-disable */
// https://github.com/jherrm/knobs
/**
   *   Default
   * Orientation
   *      90
   *  180  +  0
   *      270
   **/
export const Knob = function(inputEl, callback) {
  this.__callback = callback;
  this.element = inputEl;
  if (!this.element) {
    throw new Error('No input element specified for knob.');
  }
  this.options = {
    /** Enable turning of the knob in a circular motion */
    gestureSpinEnabled: true,
    /** Enable turning of the knob in a horizontal sliding motion */
    gestureSlideXEnabled: true,
    /** Enable turning of the knob with a vertical sliding motion */
    gestureSlideYEnabled: true,
    /** Enable turning of the knob with a mouse scroll */
    gestureScrollEnabled: true,
    /** During spin gestures, point the indicator to the finger as it spins */
    // followFinger: true,
    /** Setting this will prevent the knob from turning below this angle */
    angleStart: Number.NEGATIVE_INFINITY,
    /** Setting this will prevent the knob from turning past this angle */
    angleEnd: Number.POSITIVE_INFINITY,
    /** The minimum value the knob can go down to */
    valueMin: 0, // default for html sliders
    /** The maximum value the knob can go up to */
    valueMax: 100, // default for html sliders
    // valueMax: 11, // This one goes to eleven.
    /** The current value of the knob */
    value: 0,
    /**
       * How much the value increases per degree turned.
       * Only used if both angleStart/End and valueMax/valueMin
       * are NOT +/- Infinity.
       **/
    angleValueRatio: 0.1,
    /** How much the angle increases per pixel moved during the slide */
    angleSlideRatio: 2.0,
    /** How much the angle increases per pixel moved during the scroll */
    angleScrollRatio: 0.5,
    /** Number of pixels the rotational center of the knob is shifted from element's center along the X axis */
    centerOffsetX: 0,
    /** Number of pixels the rotational center of the knob is shifted from element's center along the Y axis */
    centerOffsetY: 0,
    /*
      ---------------------------------------------------------------------------
        INDICATOR OPTIONS
      ---------------------------------------------------------------------------
      */
    /** Angle the indicator is at when first rendered */
    indicatorStartAngle: 0,
    /** Automatically rotate the indicator based on the angle */
    indicatorAutoRotate: false,
    /** Automatically position the indicator around the rotational center */
    indicatorAutoPosition: false,
    /**
       * The distance of the indicator from the rotational center.
       * Only used when indicatorAutoPosition is true.
       **/
    indicatorRadius: 0,
    /*
      ---------------------------------------------------------------------------
        SPRITE OPTIONS
      ---------------------------------------------------------------------------
      */
    /** Width of the image or individual images in the sprite */
    spriteWidth: 67, /* (default to Apple's standard size in GarageBand) */
    /** Height of the image or individual images in the sprite */
    spriteHeight: 67, /* (default to Apple's standard size in GarageBand) */
    /** Number of images in the sprite */
    spriteCount: 1,
    /** Which way the images turn when viewing left to right in the sprite */
    spriteDirection: 'ccw', /* cw = clockwise, ccw = counter-clockwise */
    /** Angle of the 1st sprite image relative to the default orientation */
    spriteStartAngle: 0,
    /** Number of degrees turned between each image in the sprite */
    spriteSeparationAngle: 3,
    /** The thickness of the gap surrounding images in the sprite */
    spriteSeparationGap: 0,
  };
};
/*
  ---------------------------------------------------------------------------
    PRIVATE FUNCTIONS
  ---------------------------------------------------------------------------
  */
/**
   * Convenience function to map a variable from one coordinate space
   * to another.
   * Thanks to http://www.trembl.org/codec/737/
   *
   * @param value {Number} value
   * @param istart {Number} Lower boundary of first coordinate space
   * @param istop {Number} Higher boundary of first coordinate space
   * @param ostart {Number} Lower boundary of second coordinate space
   * @param ostop {Number} Higher boundary of second coordinate space
   *
   * @return {Number} The value mapped from the first coordinate space
   * to the latter.
   */
function map(value, istart, istop, ostart, ostop) {
  return ostart + (ostop - ostart) * ((value - istart)/(istop - istart));
}
/**
   * Convenience function to constrain a value between two numbers.
   *
   * @param value {Number} value
   * @param low {Number} Lower number boundary
   * @param high {Number} Higher number boundary
   *
   * @return {Number} A number from low to high.
   */
function constrain(value, low, high) {
  if (low > high) {
    const tmp = low;
    low = high;
    high = tmp;
  }
  return (value < low) ? low : ((value > high) ? high : value);
};
/**
   * Convert degrees to radians.
   *
   * @param degrees {Number} Angle in degrees
   *
   * @return {Number} Angle in radians
   **/
function toRadians(degrees) {
  return degrees*(Math.PI/180);
};
/**
   * Convert radians to degrees.
   *
   * @param radians {Number} Angle in radians
   *
   * @return {Number} Angle in degrees
   **/
function toDegrees(radians) {
  return radians*(180/Math.PI);
};
/**
   * Get the smallest distance between two angles.
   *
   * @param angle1 {Number} First angle in degrees
   * @param angle2 {Number} Second angle in degrees
   *
   * @return {Number} Angle distance in degrees (0 >= angle <= 180)
   **/
function smallestAngleDistance(angle1, angle2) {
  const d = Math.abs(angle1 - angle2) % 360;
  return d > 180 ? 360 - d : d;
}
/**
   * Get the raw distance between two angles.
   *
   * @param angle1 {Number} First angle in degrees
   * @param angle2 {Number} Second angle in degrees
   *
   * @return {Number} Angle distance in degrees
   **/
function angleDistance(angle1, angle2) {
  return angle1 % 360 - angle2 % 360;
}
/**
   * Get the angle from x and y coordinates using
   * the specified origin.
   *
   * @param x {Number}
   * @param y {Number}
   *
   * @return {Number} Angle distance in degrees
   **/
function angleFromCoord(x, y, originX, originY) {
  const ny = originY - y;
  const nx = x - originX;
  // http://stackoverflow.com/questions/1311049/how-to-map-atan2-to-degrees-0-360
  return toDegrees(Math.atan2(-ny, -nx)+Math.PI);
}
function pointDistance(x0, y0, x1, y1) {
  return Math.sqrt((x0 -= x1) * x0 + (y0 -= y1) * y0);
}
/**
   * Returns true if angle is increasing.
   * An angle is increasing if going from a lower
   * number to a higher number or if the angle
   * crosses bottom to top (e.g. 358 -> 2).
   *
   * @param prevAngle {Number} Previous angle in degrees
   * @param nextAngle {Number} Next angle in degrees
   *
   * @return {Boolean} True if the angle is increasing
   **/
function isAngleIncreasing(prevAngle, nextAngle) {
  const lowerBound = 30;
  const upperBound = 360 - lowerBound;
  if (prevAngle < lowerBound && nextAngle > upperBound) {
    return false;
  } else if (prevAngle > upperBound && nextAngle < lowerBound) {
    return true;
  } else {
    return prevAngle < nextAngle;
  }
}
/**
   * Normalize the angle to 0 - 360.
   *
   * @param angle {Number} Angle in degrees
   *
   * @return {Number} Normalized angle
   **/
function normalizeAngle(angle) {
  // get normalized base angles by chopping off any previous turns
  let normalized = angle % 360;
  // ensure the normalized angle is positive
  while (normalized < 0) {
    normalized += 360;
  }
  return normalized;
};
const members = {
  /*
    ---------------------------------------------------------------------------
      INTERNAL FIELDS ::
    ---------------------------------------------------------------------------
    */
  /** {Number} Current angle of the knob */
  __angle: 0,
  /** {Number} Current value of the knob */
  __value: 0,
  /** {Number} Center of the knob in the context of the page */
  __centerPageX: 0,
  /** {Number} Center of the knob in the context of the page */
  __centerPageY: 0,
  /** {Boolean} Whether only a single finger is used in touch handling */
  __isSingleTouch: false,
  /** {Boolean} Whether a touch event sequence is in progress */
  __isTracking: false,
  /**
     * {Boolean} Whether the user has moved by such a distance that we have enabled
     * spinning mode. Hint: It's only enabled after some pixels of movement to
     * not interrupt with clicks etc.
     */
  __isTurning: false,
  /*
    ---------------------------------------------------------------------------
      INTERNAL FIELDS :: INITIAL POSITIONS
    ---------------------------------------------------------------------------
    */
  /** {Number} Left position of finger at start */
  __initialTouchLeft: null,
  /** {Number} Top position of finger at start */
  __initialTouchTop: null,
  /**
     * {Number} Position of finger relative to center at start along X axis.
     * Possible values are "left" and "right".
     **/
  __initialTouchLocationX: null,
  /**
     * {Number} Position of finger relative to center at start along Y axis.
     * Possible values are "top" and "bottom".
     **/
  __initialTouchLocationY: null,
  /** {Boolean} Flag used for locking */
  __slideXDetected: false,
  /** {Boolean} Flag used for locking */
  __slideYDetected: false,
  /** {Boolean} Flag used for locking */
  __spinDetected: false,
  /*
    ---------------------------------------------------------------------------
      INTERNAL FIELDS :: LAST POSITIONS
    ---------------------------------------------------------------------------
    */
  /** {Number} The previous left position of finger */
  __lastTouchLeft: null,
  /** {Number} The previous top position of finger */
  __lastTouchTop: null,
  /** {Date} Timestamp of last move of finger. Used to limit tracking range for deceleration speed. */
  __lastTouchMove: null,
  /** {Array} List of positions, uses three indexes for each state: left, top, timestamp */
  __positions: null,
  /*
    ---------------------------------------------------------------------------
      INTERNAL FIELDS :: DIMENSIONS
    ---------------------------------------------------------------------------
    */
  /** {Integer} Available outer left position (from document perspective) */
  __clientLeft: 0,
  /** {Integer} Available outer top position (from document perspective) */
  __clientTop: 0,
  /** {Integer} Available outer width */
  __clientWidth: 0,
  /** {Integer} Available outer height */
  __clientHeight: 0,
  /*
    ---------------------------------------------------------------------------
      PUBLIC API
    ---------------------------------------------------------------------------
    */
  /**
     * Set the width and height of the knob.
     *
     * All values which are falsy (null or zero etc.) are ignored and the old value is kept.
     *
     * @param clientWidth {Integer ? null} Inner width of outer element
     * @param clientHeight {Integer ? null} Inner height of outer element
     */
  setDimensions: function(clientWidth, clientHeight) {
    const self = this;
    // Only update values which are defined
    if (clientWidth) {
      self.__clientWidth = clientWidth;
    }
    if (clientHeight) {
      self.__clientHeight = clientHeight;
    }
    self.__updateCenterLocation();
    self.__publish();
  },
  /**
     * Sets the client coordinates in relation to the document.
     *
     * @param left {Integer ? 0} Left position of outer element
     * @param top {Integer ? 0} Top position of outer element
     */
  setPosition: function(left, top) {
    const self = this;
    self.__clientLeft = left || 0;
    self.__clientTop = top || 0;
    self.__updateCenterLocation();
    self.__publish();
  },
  /**
     * Gets or sets the knob value.
     *
     * @return {Number} `value`
     */
  val: function(value) {
    if (value !== undefined) {
      this.__validateAndPublishValue(value, true);
    }
    return this.__value;
  },
  /**
     * Gets or sets the knob angle.
     *
     * @return {Number} `angle`
     */
  angle: function(angle) {
    if (angle) {
      this.__validateAndPublishAngle(angle, true);
    }
    return this.__angle;
  },
  // turnByValue: function(value) {
  // },
  // turnByAngle: function(angle) {
  // },
  /*
    ---------------------------------------------------------------------------
      EVENT CALLBACKS
    ---------------------------------------------------------------------------
    */
  /**
     * Mouse wheel/scroll handler for knob turning support
     */
  doMouseScroll: function(wheelDelta, timeStamp, pageX, pageY) {
    const self = this;
    if (!self.options.gestureScrollEnabled) return;
    // Figure out where the touch was relative to the center
    let change = constrain(wheelDelta, -20, 20);
    change = (pageX >= self.__centerPageX) ? -change : change;
    change *= self.options.angleScrollRatio;
    self.__validateAndPublishAngle(self.__angle + change);
  },
  /**
     * Touch start handler for knob turning support
     */
  doTouchStart: function(touches, timeStamp) {
    // Array-like check is enough here
    if (touches.length == null) {
      throw new Error('Invalid touch list: ' + touches);
    }
    if (typeof timeStamp !== 'number') {
      throw new Error('Invalid timestamp value: ' + timeStamp);
    }
    const self = this;
    const isSingleTouch = touches.length === 1;
    const currentTouchLeft = touches[0].pageX;
    const currentTouchTop = touches[0].pageY;
    // Store initial positions
    self.__initialTouchLeft = currentTouchLeft;
    self.__initialTouchTop = currentTouchTop;
    self.__initialAngle = angleFromCoord(self.__initialTouchLeft, self.__initialTouchTop, self.__centerPageX, self.__centerPageY);
    self.__initialAngleDiff = angleDistance(self.__initialAngle, self.__angle);
    // Store initial touch positions
    self.__lastTouchLeft = currentTouchLeft;
    self.__lastTouchTop = currentTouchTop;
    // Store initial move time stamp
    self.__lastTouchMove = timeStamp;
    // Reset locking flags
    self.__slideXDetected = !isSingleTouch && self.options.gestureSlideXEnabled;
    self.__slideYDetected = !isSingleTouch && self.options.gestureSlideYEnabled;
    // Figure out where the touch was relative to the center
    self.__initialTouchLocationX = (currentTouchLeft >= self.__centerPageX) ? 'right' : 'left';
    self.__initialTouchLocationY = (currentTouchTop >= self.__centerPageY) ? 'bottom' : 'top';
    // Reset tracking flag
    self.__isTracking = true;
    // Spinning starts directly with two fingers, otherwise lazy with an offset
    self.__isTurning = !isSingleTouch;
    self.__spinDetected = self.options.gestureSpinEnabled;
    self.__totalDistance = 0;
    // Some features are disabled in multi touch scenarios
    self.__isSingleTouch = isSingleTouch;
    // Reset locking flag
    self.__isGestureLocked = false;
    // Clearing data structure
    self.__positions = [];
  },
  /**
     * Touch move handler for knob turning support
     */
  doTouchMove: function(touches, timeStamp, scale) {
    // Array-like check is enough here
    if (touches.length == null) {
      throw new Error('Invalid touch list: ' + touches);
    }
    if (typeof timeStamp !== 'number') {
      throw new Error('Invalid timestamp value: ' + timeStamp);
    }
    const self = this;
    // Ignore event when tracking is not enabled (event might be outside of element)
    if (!self.__isTracking) {
      return;
    }
    const currentTouchLeft = touches[0].pageX;
    const currentTouchTop = touches[0].pageY;
    const positions = self.__positions;
    self.__validateAndPublishAngle(self.__getAngleFromGesture(currentTouchLeft, currentTouchTop));
    self.__isTurning = true;
    if (!self.__isGestureLocked) {
      const minimumTrackingForChange = 35;
      const minimumDistanceForLocking = 40;
      const maximumSlideVariance = 5;
      const distanceX = Math.abs(currentTouchLeft - self.__initialTouchLeft);
      const distanceY = Math.abs(currentTouchTop - self.__initialTouchTop);
      self.__slideXDetected = self.options.gestureSlideXEnabled && distanceX >= minimumTrackingForChange && distanceY < maximumSlideVariance;
      self.__slideYDetected = self.options.gestureSlideYEnabled && distanceY >= minimumTrackingForChange && distanceX < maximumSlideVariance;
      // if(self.__isTurning && !self.__isGestureLocked) {
      //   if(self.__spinDetected)   { console.log("spinning") }
      //   if(self.__slideXDetected) { console.log("sliding left/right") }
      //   if(self.__slideYDetected) { console.log("sliding up/down") }
      // }
      if (self.__totalDistance > minimumDistanceForLocking) {
        self.__isGestureLocked = true;
        if (self.__slideXDetected && self.__slideYDetected) {
          // gesture isn't definitively in one direction or another,
          // so clear the slides and lock in the spin
          self.__slideXDetected = self.__slideYDetected = false;
          self.__spinDetected = self.options.gestureSpinEnabled;
        } else if (self.__slideXDetected) {
          // lock in the slide X
          self.__spinDetected = self.__slideYDetected = false;
        } else if (self.__slideYDetected) {
          // lock in the slide Y
          self.__spinDetected = self.__slideXDetected = false;
        }
      }
      self.__totalDistance += pointDistance(self.__lastTouchLeft, self.__lastTouchTop, currentTouchLeft, currentTouchTop);
    }
    // Keep list from growing infinitely (holding min 10, max 20 measure points)
    if (positions.length > 60) {
      positions.splice(0, 30);
    }
    // Track scroll movement for deceleration
    positions.push({
      left: currentTouchLeft,
      top: currentTouchTop,
      time: timeStamp,
    });
    // Update last touch positions and time stamp for next event
    self.__lastTouchLeft = currentTouchLeft;
    self.__lastTouchTop = currentTouchTop;
    self.__lastTouchMove = timeStamp;
  },
  /**
     * Touch end handler for knob turning support
     */
  doTouchEnd: function(timeStamp) {
    if (typeof timeStamp !== 'number') {
      throw new Error('Invalid timestamp value: ' + timeStamp);
    }
    const self = this;
    // Ignore event when tracking is not enabled (no touchstart event on element)
    // This is required as this listener ('touchmove') sits on the document and not on the element itself.
    if (!self.__isTracking) {
      return;
    }
    // Not touching anymore (when two finger hit the screen there are two touch end events)
    // *** Temporarily commented out due to problems with multitouch
    // *** Touch end on one knob causes all knobs to stop
    // self.__isTracking = false;
    // Reset turning flag
    self.__isTurning = false;
    // Fully cleanup list
    self.__positions.length = 0;
  },
  /*
    ---------------------------------------------------------------------------
      PRIVATE API
    ---------------------------------------------------------------------------
    */
  __validateAndPublishAngle: function(angle, forcePublish) {
    const self = this;
    let diff;
    if (forcePublish) {
      this.__angle = self.__validateAngle(angle, true);
    }
    const prevAngle = self.__angle;
    const nPreviousAngle = normalizeAngle(prevAngle);
    const nCurrentAngle = normalizeAngle(angle);
    diff = smallestAngleDistance(nPreviousAngle, nCurrentAngle);
    diff = isAngleIncreasing(nPreviousAngle, nCurrentAngle) ? diff : -diff;
    const nextAngle = self.__validateAngle(self.__angle + diff);
    self.__angle = nextAngle;
    self.__value = self.__valueFromAngles(forcePublish ? nextAngle : prevAngle, nextAngle);
    self.__publish();
  },
  __validateAndPublishValue: function(value, forcePublish) {
    const self = this;
    // if(forcePublish) {
    self.__value = self.__validateValue(value, true);
    // }
    self.__angle = self.__angleFromValue(self.__value);
    self.__publish();
  },
  /**
     * Returns an angle with the angleStart angleEnd constraints applied.
     *
     * @param angle {Number} Angle to validate
     */
  __validateAngle: function(angle, force) {
    const self = this;
    angle = constrain(angle, self.options.angleStart, self.options.angleEnd);
    if (!force) {
      // if prevAngle was at a boundary, only allow a legal natural move to change the existing angle.
      const threshold = 30;
      if (self.__angle == self.options.angleStart && Math.abs(angle-self.__angle) > threshold ) {
        angle = self.options.angleStart;
      }
      if (self.__angle == self.options.angleEnd && Math.abs(angle-self.__angle) > threshold) {
        angle = self.options.angleEnd;
      }
    }
    return angle;
  },
  /**
     * Returns a value with the valueMin and valueMax constraints applied.
     *
     * @param value {Number} Value to validate
     */
  __validateValue: function(value, force) {
    const self = this;
    return constrain(value, self.options.valueMin, self.options.valueMax);
  },
  /**
     * Returns a value with the valueMin valueMax constraints applied from the given angles.
     *
     * @param prevAngle {Number} previous angle of the knob
     * @param nextAngle {Number} next angle of the knob
     */
  __valueFromAngles: function(prevAngle, nextAngle) {
    const self = this;
    // If angle and value bounds are real, map angle directly to value
    if (isFinite(self.options.angleStart) &&
        isFinite(self.options.angleEnd) &&
        self.options.valueMin != Number.NEGATIVE_INFINITY &&
        self.options.valueMax != Number.POSITIVE_INFINITY) {
      // mapping angleStart->valueMax and angleEnd->valueMin to increase the value as the knob turns clockwise
      return map(nextAngle, self.options.angleStart, self.options.angleEnd, self.options.valueMax, self.options.valueMin);
    }
    // If bounds aren't real, just increase/decrease value based on the change in angle.
    // it's prevAngle - nextAngle to increase the value as the knob turns clockwise
    const value = self.__value + (prevAngle - nextAngle) * self.options.angleValueRatio;
    return self.__validateValue(value);
  },
  /**
     * Returns the angle that corresponds to the given value.
     *
     * @param value {Number} angle represented by the value
     */
  __angleFromValue: function(value) {
    const self = this;
    // If angle and value bounds are real, map angle directly to value
    if (isFinite(self.options.valueMin) &&
        isFinite(self.options.valueMax) &&
        self.options.angleStart != Number.NEGATIVE_INFINITY &&
        self.options.angleEnd != Number.POSITIVE_INFINITY) {
      return map(value, self.options.valueMax, self.options.valueMin, self.options.angleStart, self.options.angleEnd);
    }
    // If bounds aren't real, just increase/decrease angle based on the change in value.
    const angle = self.__angle + (value - self.__value) / self.options.angleValueRatio;
    return self.__validateAngle(angle, true);
  },
  /**
     * Applies the values to the callback function.
     */
  __publish: function() {
    const self = this;
    const indicator = self.__getIndicator(self.__angle);
    const spriteOffset = self.__getSpriteOffset(self.__angle);
    // Set the input element's value
    self.element.value = self.__value;
    self.element.dispatchEvent(new CustomEvent('change'));
    // Push values out
    if (self.__callback) {
      self.__callback(self, indicator, spriteOffset);
    }
  },
  /**
     * Returns the indicator position and rotation information.
     *
     * @param angle {Number} angle
     *
     * @return {Map} `x` and `y` position and `angle`
     */
  __getIndicator: function(angle) {
    const self = this;
    const indicator = {};
    if (self.options.indicatorAutoPosition) {
      const rads = toRadians(angle);
      // Subtract Y component because of canvas's inverted Y coordinate compared to output of sin.
      indicator.x = self.__centerPageX - self.__clientLeft + self.options.indicatorRadius * Math.cos(rads),
      indicator.y = self.__centerPageY - self.__clientTop - self.options.indicatorRadius * Math.sin(rads);
    } else {
      // If not positioning, set x & y to the center of the knob
      indicator.x = self.__centerPageX - self.__clientLeft,
      indicator.y = self.__centerPageY - self.__clientTop;
    }
    if (self.options.indicatorAutoRotate) {
      indicator.angle = angle - self.options.indicatorStartAngle;
    } else {
      indicator.angle = 0;
    }
    return indicator;
  },
  /**
     * Returns the offset for the image within the sprite.
     *
     * @param angle {Number} angle
     *
     * @return {Map} `x`, `y` offset of image within sprite
     */
  __getSpriteOffset: function(angle) {
    const self = this;
    let offset = 0;
    // If there are multiple images (using sprites), figure out which image to show.
    if (self.options.spriteCount > 1) {
      let spriteAngle = self.options.spriteDirection === 'ccw' ? angle : -angle;
      // Align the background image for sprites
      spriteAngle += self.options.spriteStartAngle;
      let imageIndex = (Math.floor(spriteAngle / self.options.spriteSeparationAngle) % self.options.spriteCount);
      if (imageIndex < 0) {
        imageIndex += self.options.spriteCount;
      }
      offset = (self.options.spriteSeparationGap * (imageIndex+1)) + (self.options.spriteWidth * imageIndex);
    }
    return {
      x: offset,
      y: self.options.spriteSeparationGap,
    };
  },
  /**
     * Return the angle based on the detected gesture.
     *
     * @param currentTouchLeft {Number} pageX of the current touch
     * @param currentTouchTop  {Number} pageY of the current touch
     *
     * @return {Number} angle
     */
  __getAngleFromGesture: function(currentTouchLeft, currentTouchTop) {
    const self = this;
    let angle = self.__angle;
    // handle spin, then handle slides
    if (self.__spinDetected) {
      angle = angleFromCoord(currentTouchLeft, currentTouchTop, self.__centerPageX, self.__centerPageY);
      // TODO: slowly decrease the initialAngleDiff so the indicator eventually matches the finger as it spins (like garageband)
      angle -= self.__initialAngleDiff;
    } else {
      if (self.__slideXDetected) {
        const change = (currentTouchLeft - self.__lastTouchLeft) * self.options.angleSlideRatio;
        angle += (self.__initialTouchLocationY === 'top') ? -change : change;
      }
      if (self.__slideYDetected) {
        const change = (currentTouchTop - self.__lastTouchTop) * self.options.angleSlideRatio;
        angle += (self.__initialTouchLocationX === 'right') ? -change : change;
      }
    }
    return angle;
  },
  /**
     * Update the page based center of the knob.
     */
  __updateCenterLocation: function() {
    const self = this;
    // Get the center of knob to base interactions from
    self.__centerPageX = self.__clientLeft + self.__clientWidth/2 + self.options.centerOffsetX;
    self.__centerPageY = self.__clientTop + self.__clientHeight/2 + self.options.centerOffsetY;
  },
};
for (const key in members) {
  Knob.prototype[key] = members[key];
}
