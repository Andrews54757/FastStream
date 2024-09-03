/* !
* sweetalert2 v11.12.4
* Released under the MIT License.
*/
let swl;
(function(global, factory) {
  swl = factory();
})(this, (function() {
  'use strict';

  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _arrayWithoutHoles(r) {
    if (Array.isArray(r)) return _arrayLikeToArray(r);
  }
  function _assertClassBrand(e, t, n) {
    if ('function' == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n;
    throw new TypeError('Private element is not present on this object');
  }
  function _assertThisInitialized(e) {
    if (void 0 === e) throw new ReferenceError('this hasn\'t been initialised - super() hasn\'t been called');
    return e;
  }
  function _callSuper(t, o, e) {
    return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e));
  }
  function _checkPrivateRedeclaration(e, t) {
    if (t.has(e)) throw new TypeError('Cannot initialize the same private elements twice on an object');
  }
  function _classCallCheck(a, n) {
    if (!(a instanceof n)) throw new TypeError('Cannot call a class as a function');
  }
  function _classPrivateFieldGet2(s, a) {
    return s.get(_assertClassBrand(s, a));
  }
  function _classPrivateFieldInitSpec(e, t, a) {
    _checkPrivateRedeclaration(e, t), t.set(e, a);
  }
  function _classPrivateFieldSet2(s, a, r) {
    return s.set(_assertClassBrand(s, a), r), r;
  }
  function _construct(t, e, r) {
    if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments);
    const o = [null];
    o.push.apply(o, e);
    const p = new (t.bind.apply(t, o))();
    return p;
  }
  function _defineProperties(e, r) {
    for (let t = 0; t < r.length; t++) {
      const o = r[t];
      o.enumerable = o.enumerable || !1, o.configurable = !0, 'value' in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o);
    }
  }
  function _createClass(e, r, t) {
    return r && _defineProperties(e.prototype, r), Object.defineProperty(e, 'prototype', {
      writable: !1,
    }), e;
  }
  function _createForOfIteratorHelper(r, e) {
    let t = 'undefined' != typeof Symbol && r[Symbol.iterator] || r['@@iterator'];
    if (!t) {
      if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e) {
        t && (r = t);
        let n = 0;
        const F = function() {};
        return {
          s: F,
          n: function() {
            return n >= r.length ? {
              done: !0,
            } : {
              done: !1,
              value: r[n++],
            };
          },
          e: function(r) {
            throw r;
          },
          f: F,
        };
      }
      throw new TypeError('Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.');
    }
    let o;
    let a = !0;
    let u = !1;
    return {
      s: function() {
        t = t.call(r);
      },
      n: function() {
        const r = t.next();
        return a = r.done, r;
      },
      e: function(r) {
        u = !0, o = r;
      },
      f: function() {
        try {
          a || null == t.return || t.return();
        } finally {
          if (u) throw o;
        }
      },
    };
  }
  function _get() {
    return _get = 'undefined' != typeof Reflect && Reflect.get ? Reflect.get.bind() : function(e, t, r) {
      const p = _superPropBase(e, t);
      if (p) {
        const n = Object.getOwnPropertyDescriptor(p, t);
        return n.get ? n.get.call(arguments.length < 3 ? e : r) : n.value;
      }
    }, _get.apply(null, arguments);
  }
  function _getPrototypeOf(t) {
    return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t) {
      return t.__proto__ || Object.getPrototypeOf(t);
    }, _getPrototypeOf(t);
  }
  function _inherits(t, e) {
    if ('function' != typeof e && null !== e) throw new TypeError('Super expression must either be null or a function');
    t.prototype = Object.create(e && e.prototype, {
      constructor: {
        value: t,
        writable: !0,
        configurable: !0,
      },
    }), Object.defineProperty(t, 'prototype', {
      writable: !1,
    }), e && _setPrototypeOf(t, e);
  }
  function _isNativeReflectConstruct() {
    try {
      var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (t) {}
    return (_isNativeReflectConstruct = function() {
      return !!t;
    })();
  }
  function _iterableToArray(r) {
    if ('undefined' != typeof Symbol && null != r[Symbol.iterator] || null != r['@@iterator']) return Array.from(r);
  }
  function _iterableToArrayLimit(r, l) {
    let t = null == r ? null : 'undefined' != typeof Symbol && r[Symbol.iterator] || r['@@iterator'];
    if (null != t) {
      let e;
      let n;
      let i;
      let u;
      const a = [];
      let f = !0;
      let o = !1;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ; else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
      } catch (r) {
        o = !0, n = r;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError('Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.');
  }
  function _nonIterableSpread() {
    throw new TypeError('Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.');
  }
  function _possibleConstructorReturn(t, e) {
    if (e && ('object' == typeof e || 'function' == typeof e)) return e;
    if (void 0 !== e) throw new TypeError('Derived constructors may only return object or undefined');
    return _assertThisInitialized(t);
  }
  function _setPrototypeOf(t, e) {
    return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t, e) {
      return t.__proto__ = e, t;
    }, _setPrototypeOf(t, e);
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _superPropBase(t, o) {
    for (; !{}.hasOwnProperty.call(t, o) && null !== (t = _getPrototypeOf(t)););
    return t;
  }
  function _superPropGet(t, e, r, o) {
    const p = _get(_getPrototypeOf(t.prototype ), e, r);
    return function(t) {
      return p.apply(r, t);
    };
  }
  function _toConsumableArray(r) {
    return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
  }
  function _toPrimitive(t, r) {
    if ('object' != typeof t || !t) return t;
    const e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      const i = e.call(t, r);
      if ('object' != typeof i) return i;
      throw new TypeError('@@toPrimitive must return a primitive value.');
    }
    return (String )(t);
  }
  function _toPropertyKey(t) {
    const i = _toPrimitive(t, 'string');
    return 'symbol' == typeof i ? i : i + '';
  }
  function _typeof(o) {
    '@babel/helpers - typeof';

    return _typeof = 'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator ? function(o) {
      return typeof o;
    } : function(o) {
      return o && 'function' == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? 'symbol' : typeof o;
    }, _typeof(o);
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ('string' == typeof r) return _arrayLikeToArray(r, a);
      let t = {}.toString.call(r).slice(8, -1);
      return 'Object' === t && r.constructor && (t = r.constructor.name), 'Map' === t || 'Set' === t ? Array.from(r) : 'Arguments' === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }

  const RESTORE_FOCUS_TIMEOUT = 100;

  /** @type {GlobalState} */
  const globalState = {};
  const focusPreviousActiveElement = function focusPreviousActiveElement() {
    if (globalState.previousActiveElement instanceof HTMLElement) {
      globalState.previousActiveElement.focus();
      globalState.previousActiveElement = null;
    } else if (document.body) {
      document.body.focus();
    }
  };

  /**
     * Restore previous active (focused) element
     *
     * @param {boolean} returnFocus
     * @return {Promise<void>}
     */
  const restoreActiveElement = function restoreActiveElement(returnFocus) {
    return new Promise(function(resolve) {
      if (!returnFocus) {
        return resolve();
      }
      const x = window.scrollX;
      const y = window.scrollY;
      globalState.restoreFocusTimeout = setTimeout(function() {
        focusPreviousActiveElement();
        resolve();
      }, RESTORE_FOCUS_TIMEOUT); // issues/900

      window.scrollTo(x, y);
    });
  };

  const swalPrefix = 'swal2-';

  /**
     * @typedef {Record<SwalClass, string>} SwalClasses
     */

  /**
     * @typedef {'success' | 'warning' | 'info' | 'question' | 'error'} SwalIcon
     * @typedef {Record<SwalIcon, string>} SwalIcons
     */

  /** @type {SwalClass[]} */
  const classNames = ['container', 'shown', 'height-auto', 'iosfix', 'popup', 'modal', 'no-backdrop', 'no-transition', 'toast', 'toast-shown', 'show', 'hide', 'close', 'title', 'html-container', 'actions', 'confirm', 'deny', 'cancel', 'default-outline', 'footer', 'icon', 'icon-content', 'image', 'input', 'file', 'range', 'select', 'radio', 'checkbox', 'label', 'textarea', 'inputerror', 'input-label', 'validation-message', 'progress-steps', 'active-progress-step', 'progress-step', 'progress-step-line', 'loader', 'loading', 'styled', 'top', 'top-start', 'top-end', 'top-left', 'top-right', 'center', 'center-start', 'center-end', 'center-left', 'center-right', 'bottom', 'bottom-start', 'bottom-end', 'bottom-left', 'bottom-right', 'grow-row', 'grow-column', 'grow-fullscreen', 'rtl', 'timer-progress-bar', 'timer-progress-bar-container', 'scrollbar-measure', 'icon-success', 'icon-warning', 'icon-info', 'icon-question', 'icon-error'];
  const swalClasses = classNames.reduce(function(acc, className) {
    acc[className] = swalPrefix + className;
    return acc;
  }, /** @type {SwalClasses} */{});

  /** @type {SwalIcon[]} */
  const icons = ['success', 'warning', 'info', 'question', 'error'];
  const iconTypes = icons.reduce(function(acc, icon) {
    acc[icon] = swalPrefix + icon;
    return acc;
  }, /** @type {SwalIcons} */{});

  const consolePrefix = 'SweetAlert2:';

  /**
     * Capitalize the first letter of a string
     *
     * @param {string} str
     * @return {string}
     */
  const capitalizeFirstLetter = function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  /**
     * Standardize console warnings
     *
     * @param {string | string[]} message
     */
  const warn = function warn(message) {
    console.warn(''.concat(consolePrefix, ' ').concat(_typeof(message) === 'object' ? message.join(' ') : message));
  };

  /**
     * Standardize console errors
     *
     * @param {string} message
     */
  const error = function error(message) {
    console.error(''.concat(consolePrefix, ' ').concat(message));
  };

  /**
     * Private global state for `warnOnce`
     *
     * @type {string[]}
     * @private
     */
  const previousWarnOnceMessages = [];

  /**
     * Show a console warning, but only if it hasn't already been shown
     *
     * @param {string} message
     */
  const warnOnce = function warnOnce(message) {
    if (!previousWarnOnceMessages.includes(message)) {
      previousWarnOnceMessages.push(message);
      warn(message);
    }
  };

  /**
     * Show a one-time console warning about deprecated params/methods
     *
     * @param {string} deprecatedParam
     * @param {string?} useInstead
     */
  const warnAboutDeprecation = function warnAboutDeprecation(deprecatedParam) {
    const useInstead = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    warnOnce('"'.concat(deprecatedParam, '" is deprecated and will be removed in the next major release.').concat(useInstead ? ' Use "'.concat(useInstead, '" instead.') : ''));
  };

  /**
     * If `arg` is a function, call it (with no arguments or context) and return the result.
     * Otherwise, just pass the value through
     *
     * @param {Function | any} arg
     * @return {any}
     */
  const callIfFunction = function callIfFunction(arg) {
    return typeof arg === 'function' ? arg() : arg;
  };

  /**
     * @param {any} arg
     * @return {boolean}
     */
  const hasToPromiseFn = function hasToPromiseFn(arg) {
    return arg && typeof arg.toPromise === 'function';
  };

  /**
     * @param {any} arg
     * @return {Promise<any>}
     */
  const asPromise = function asPromise(arg) {
    return hasToPromiseFn(arg) ? arg.toPromise() : Promise.resolve(arg);
  };

  /**
     * @param {any} arg
     * @return {boolean}
     */
  const isPromise = function isPromise(arg) {
    return arg && Promise.resolve(arg) === arg;
  };

  /**
     * Gets the popup container which contains the backdrop and the popup itself.
     *
     * @return {HTMLElement | null}
     */
  const getContainer = function getContainer() {
    return document.body.querySelector('.'.concat(swalClasses.container));
  };

  /**
     * @param {string} selectorString
     * @return {HTMLElement | null}
     */
  const elementBySelector = function elementBySelector(selectorString) {
    const container = getContainer();
    return container ? container.querySelector(selectorString) : null;
  };

  /**
     * @param {string} className
     * @return {HTMLElement | null}
     */
  const elementByClass = function elementByClass(className) {
    return elementBySelector('.'.concat(className));
  };

  /**
     * @return {HTMLElement | null}
     */
  const getPopup = function getPopup() {
    return elementByClass(swalClasses.popup);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getIcon = function getIcon() {
    return elementByClass(swalClasses.icon);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getIconContent = function getIconContent() {
    return elementByClass(swalClasses['icon-content']);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getTitle = function getTitle() {
    return elementByClass(swalClasses.title);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getHtmlContainer = function getHtmlContainer() {
    return elementByClass(swalClasses['html-container']);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getImage = function getImage() {
    return elementByClass(swalClasses.image);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getProgressSteps = function getProgressSteps() {
    return elementByClass(swalClasses['progress-steps']);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getValidationMessage = function getValidationMessage() {
    return elementByClass(swalClasses['validation-message']);
  };

  /**
     * @return {HTMLButtonElement | null}
     */
  const getConfirmButton = function getConfirmButton() {
    return /** @type {HTMLButtonElement} */elementBySelector('.'.concat(swalClasses.actions, ' .').concat(swalClasses.confirm));
  };

  /**
     * @return {HTMLButtonElement | null}
     */
  const getCancelButton = function getCancelButton() {
    return /** @type {HTMLButtonElement} */elementBySelector('.'.concat(swalClasses.actions, ' .').concat(swalClasses.cancel));
  };

  /**
     * @return {HTMLButtonElement | null}
     */
  const getDenyButton = function getDenyButton() {
    return /** @type {HTMLButtonElement} */elementBySelector('.'.concat(swalClasses.actions, ' .').concat(swalClasses.deny));
  };

  /**
     * @return {HTMLElement | null}
     */
  const getInputLabel = function getInputLabel() {
    return elementByClass(swalClasses['input-label']);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getLoader = function getLoader() {
    return elementBySelector('.'.concat(swalClasses.loader));
  };

  /**
     * @return {HTMLElement | null}
     */
  const getActions = function getActions() {
    return elementByClass(swalClasses.actions);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getFooter = function getFooter() {
    return elementByClass(swalClasses.footer);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getTimerProgressBar = function getTimerProgressBar() {
    return elementByClass(swalClasses['timer-progress-bar']);
  };

  /**
     * @return {HTMLElement | null}
     */
  const getCloseButton = function getCloseButton() {
    return elementByClass(swalClasses.close);
  };

  // https://github.com/jkup/focusable/blob/master/index.js
  const focusable = '\n  a[href],\n  area[href],\n  input:not([disabled]),\n  select:not([disabled]),\n  textarea:not([disabled]),\n  button:not([disabled]),\n  iframe,\n  object,\n  embed,\n  [tabindex="0"],\n  [contenteditable],\n  audio[controls],\n  video[controls],\n  summary\n';
  /**
     * @return {HTMLElement[]}
     */
  const getFocusableElements = function getFocusableElements() {
    const popup = getPopup();
    if (!popup) {
      return [];
    }
    /** @type {NodeListOf<HTMLElement>} */
    const focusableElementsWithTabindex = popup.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])');
    const focusableElementsWithTabindexSorted = Array.from(focusableElementsWithTabindex)
    // sort according to tabindex
        .sort(function(a, b) {
          const tabindexA = parseInt(a.getAttribute('tabindex') || '0');
          const tabindexB = parseInt(b.getAttribute('tabindex') || '0');
          if (tabindexA > tabindexB) {
            return 1;
          } else if (tabindexA < tabindexB) {
            return -1;
          }
          return 0;
        });

    /** @type {NodeListOf<HTMLElement>} */
    const otherFocusableElements = popup.querySelectorAll(focusable);
    const otherFocusableElementsFiltered = Array.from(otherFocusableElements).filter(function(el) {
      return el.getAttribute('tabindex') !== '-1';
    });
    return _toConsumableArray(new Set(focusableElementsWithTabindexSorted.concat(otherFocusableElementsFiltered))).filter(function(el) {
      return isVisible$1(el);
    });
  };

  /**
     * @return {boolean}
     */
  const isModal = function isModal() {
    return hasClass(document.body, swalClasses.shown) && !hasClass(document.body, swalClasses['toast-shown']) && !hasClass(document.body, swalClasses['no-backdrop']);
  };

  /**
     * @return {boolean}
     */
  const isToast = function isToast() {
    const popup = getPopup();
    if (!popup) {
      return false;
    }
    return hasClass(popup, swalClasses.toast);
  };

  /**
     * @return {boolean}
     */
  const isLoading = function isLoading() {
    const popup = getPopup();
    if (!popup) {
      return false;
    }
    return popup.hasAttribute('data-loading');
  };

  /**
     * Securely set innerHTML of an element
     * https://github.com/sweetalert2/sweetalert2/issues/1926
     *
     * @param {HTMLElement} elem
     * @param {string} html
     */
  const setInnerHtml = function setInnerHtml(elem, html) {
    elem.textContent = '';
    if (html) {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, 'text/html');
      const head = parsed.querySelector('head');
      if (head) {
        Array.from(head.childNodes).forEach(function(child) {
          elem.appendChild(child);
        });
      }
      const body = parsed.querySelector('body');
      if (body) {
        Array.from(body.childNodes).forEach(function(child) {
          if (child instanceof HTMLVideoElement || child instanceof HTMLAudioElement) {
            elem.appendChild(child.cloneNode(true)); // https://github.com/sweetalert2/sweetalert2/issues/2507
          } else {
            elem.appendChild(child);
          }
        });
      }
    }
  };

  /**
     * @param {HTMLElement} elem
     * @param {string} className
     * @return {boolean}
     */
  var hasClass = function hasClass(elem, className) {
    if (!className) {
      return false;
    }
    const classList = className.split(/\s+/);
    for (let i = 0; i < classList.length; i++) {
      if (!elem.classList.contains(classList[i])) {
        return false;
      }
    }
    return true;
  };

  /**
     * @param {HTMLElement} elem
     * @param {SweetAlertOptions} params
     */
  const removeCustomClasses = function removeCustomClasses(elem, params) {
    Array.from(elem.classList).forEach(function(className) {
      if (!Object.values(swalClasses).includes(className) && !Object.values(iconTypes).includes(className) && !Object.values(params.showClass || {}).includes(className)) {
        elem.classList.remove(className);
      }
    });
  };

  /**
     * @param {HTMLElement} elem
     * @param {SweetAlertOptions} params
     * @param {string} className
     */
  const applyCustomClass = function applyCustomClass(elem, params, className) {
    removeCustomClasses(elem, params);
    if (!params.customClass) {
      return;
    }
    const customClass = params.customClass[( /** @type {keyof SweetAlertCustomClass} */className)];
    if (!customClass) {
      return;
    }
    if (typeof customClass !== 'string' && !customClass.forEach) {
      warn('Invalid type of customClass.'.concat(className, '! Expected string or iterable object, got "').concat(_typeof(customClass), '"'));
      return;
    }
    addClass(elem, customClass);
  };

  /**
     * @param {HTMLElement} popup
     * @param {import('./renderers/renderInput').InputClass | SweetAlertInput} inputClass
     * @returns {HTMLInputElement | null}
     */
  const getInput$1 = function getInput(popup, inputClass) {
    if (!inputClass) {
      return null;
    }
    switch (inputClass) {
      case 'select':
      case 'textarea':
      case 'file':
        return popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses[inputClass]));
      case 'checkbox':
        return popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses.checkbox, ' input'));
      case 'radio':
        return popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses.radio, ' input:checked')) || popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses.radio, ' input:first-child'));
      case 'range':
        return popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses.range, ' input'));
      default:
        return popup.querySelector('.'.concat(swalClasses.popup, ' > .').concat(swalClasses.input));
    }
  };

  /**
     * @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} input
     */
  const focusInput = function focusInput(input) {
    input.focus();

    // place cursor at end of text in text input
    if (input.type !== 'file') {
      // http://stackoverflow.com/a/2345915
      const val = input.value;
      input.value = '';
      input.value = val;
    }
  };

  /**
     * @param {HTMLElement | HTMLElement[] | null} target
     * @param {string | string[] | readonly string[] | undefined} classList
     * @param {boolean} condition
     */
  const toggleClass = function toggleClass(target, classList, condition) {
    if (!target || !classList) {
      return;
    }
    if (typeof classList === 'string') {
      classList = classList.split(/\s+/).filter(Boolean);
    }
    classList.forEach(function(className) {
      if (Array.isArray(target)) {
        target.forEach(function(elem) {
          if (condition) {
            elem.classList.add(className);
          } else {
            elem.classList.remove(className);
          }
        });
      } else {
        if (condition) {
          target.classList.add(className);
        } else {
          target.classList.remove(className);
        }
      }
    });
  };

  /**
     * @param {HTMLElement | HTMLElement[] | null} target
     * @param {string | string[] | readonly string[] | undefined} classList
     */
  var addClass = function addClass(target, classList) {
    toggleClass(target, classList, true);
  };

  /**
     * @param {HTMLElement | HTMLElement[] | null} target
     * @param {string | string[] | readonly string[] | undefined} classList
     */
  const removeClass = function removeClass(target, classList) {
    toggleClass(target, classList, false);
  };

  /**
     * Get direct child of an element by class name
     *
     * @param {HTMLElement} elem
     * @param {string} className
     * @return {HTMLElement | undefined}
     */
  const getDirectChildByClass = function getDirectChildByClass(elem, className) {
    const children = Array.from(elem.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child instanceof HTMLElement && hasClass(child, className)) {
        return child;
      }
    }
  };

  /**
     * @param {HTMLElement} elem
     * @param {string} property
     * @param {*} value
     */
  const applyNumericalStyle = function applyNumericalStyle(elem, property, value) {
    if (value === ''.concat(parseInt(value))) {
      value = parseInt(value);
    }
    if (value || parseInt(value) === 0) {
      elem.style.setProperty(property, typeof value === 'number' ? ''.concat(value, 'px') : value);
    } else {
      elem.style.removeProperty(property);
    }
  };

  /**
     * @param {HTMLElement | null} elem
     * @param {string} display
     */
  const show = function show(elem) {
    const display = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'flex';
    if (!elem) {
      return;
    }
    elem.style.display = display;
  };

  /**
     * @param {HTMLElement | null} elem
     */
  const hide = function hide(elem) {
    if (!elem) {
      return;
    }
    elem.style.display = 'none';
  };

  /**
     * @param {HTMLElement | null} elem
     * @param {string} display
     */
  const showWhenInnerHtmlPresent = function showWhenInnerHtmlPresent(elem) {
    const display = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'block';
    if (!elem) {
      return;
    }
    new MutationObserver(function() {
      toggle(elem, elem.innerHTML, display);
    }).observe(elem, {
      childList: true,
      subtree: true,
    });
  };

  /**
     * @param {HTMLElement} parent
     * @param {string} selector
     * @param {string} property
     * @param {string} value
     */
  const setStyle = function setStyle(parent, selector, property, value) {
    /** @type {HTMLElement | null} */
    const el = parent.querySelector(selector);
    if (el) {
      el.style.setProperty(property, value);
    }
  };

  /**
     * @param {HTMLElement} elem
     * @param {any} condition
     * @param {string} display
     */
  var toggle = function toggle(elem, condition) {
    const display = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'flex';
    if (condition) {
      show(elem, display);
    } else {
      hide(elem);
    }
  };

  /**
     * borrowed from jquery $(elem).is(':visible') implementation
     *
     * @param {HTMLElement | null} elem
     * @return {boolean}
     */
  var isVisible$1 = function isVisible(elem) {
    return !!(elem && (elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length));
  };

  /**
     * @return {boolean}
     */
  const allButtonsAreHidden = function allButtonsAreHidden() {
    return !isVisible$1(getConfirmButton()) && !isVisible$1(getDenyButton()) && !isVisible$1(getCancelButton());
  };

  /**
     * @param {HTMLElement} elem
     * @return {boolean}
     */
  const isScrollable = function isScrollable(elem) {
    return !!(elem.scrollHeight > elem.clientHeight);
  };

  /**
     * borrowed from https://stackoverflow.com/a/46352119
     *
     * @param {HTMLElement} elem
     * @return {boolean}
     */
  const hasCssAnimation = function hasCssAnimation(elem) {
    const style = window.getComputedStyle(elem);
    const animDuration = parseFloat(style.getPropertyValue('animation-duration') || '0');
    const transDuration = parseFloat(style.getPropertyValue('transition-duration') || '0');
    return animDuration > 0 || transDuration > 0;
  };

  /**
     * @param {number} timer
     * @param {boolean} reset
     */
  const animateTimerProgressBar = function animateTimerProgressBar(timer) {
    const reset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    const timerProgressBar = getTimerProgressBar();
    if (!timerProgressBar) {
      return;
    }
    if (isVisible$1(timerProgressBar)) {
      if (reset) {
        timerProgressBar.style.transition = 'none';
        timerProgressBar.style.width = '100%';
      }
      setTimeout(function() {
        timerProgressBar.style.transition = 'width '.concat(timer / 1000, 's linear');
        timerProgressBar.style.width = '0%';
      }, 10);
    }
  };
  const stopTimerProgressBar = function stopTimerProgressBar() {
    const timerProgressBar = getTimerProgressBar();
    if (!timerProgressBar) {
      return;
    }
    const timerProgressBarWidth = parseInt(window.getComputedStyle(timerProgressBar).width);
    timerProgressBar.style.removeProperty('transition');
    timerProgressBar.style.width = '100%';
    const timerProgressBarFullWidth = parseInt(window.getComputedStyle(timerProgressBar).width);
    const timerProgressBarPercent = timerProgressBarWidth / timerProgressBarFullWidth * 100;
    timerProgressBar.style.width = ''.concat(timerProgressBarPercent, '%');
  };

  /**
     * Detect Node env
     *
     * @return {boolean}
     */
  const isNodeEnv = function isNodeEnv() {
    return typeof window === 'undefined' || typeof document === 'undefined';
  };

  const sweetHTML = '\n <div aria-labelledby="'.concat(swalClasses.title, '" aria-describedby="').concat(swalClasses['html-container'], '" class="').concat(swalClasses.popup, '" tabindex="-1">\n   <button type="button" class="').concat(swalClasses.close, '"></button>\n   <ul class="').concat(swalClasses['progress-steps'], '"></ul>\n   <div class="').concat(swalClasses.icon, '"></div>\n   <img class="').concat(swalClasses.image, '" />\n   <h2 class="').concat(swalClasses.title, '" id="').concat(swalClasses.title, '"></h2>\n   <div class="').concat(swalClasses['html-container'], '" id="').concat(swalClasses['html-container'], '"></div>\n   <input class="').concat(swalClasses.input, '" id="').concat(swalClasses.input, '" />\n   <input type="file" class="').concat(swalClasses.file, '" />\n   <div class="').concat(swalClasses.range, '">\n     <input type="range" />\n     <output></output>\n   </div>\n   <select class="').concat(swalClasses.select, '" id="').concat(swalClasses.select, '"></select>\n   <div class="').concat(swalClasses.radio, '"></div>\n   <label class="').concat(swalClasses.checkbox, '">\n     <input type="checkbox" id="').concat(swalClasses.checkbox, '" />\n     <span class="').concat(swalClasses.label, '"></span>\n   </label>\n   <textarea class="').concat(swalClasses.textarea, '" id="').concat(swalClasses.textarea, '"></textarea>\n   <div class="').concat(swalClasses['validation-message'], '" id="').concat(swalClasses['validation-message'], '"></div>\n   <div class="').concat(swalClasses.actions, '">\n     <div class="').concat(swalClasses.loader, '"></div>\n     <button type="button" class="').concat(swalClasses.confirm, '"></button>\n     <button type="button" class="').concat(swalClasses.deny, '"></button>\n     <button type="button" class="').concat(swalClasses.cancel, '"></button>\n   </div>\n   <div class="').concat(swalClasses.footer, '"></div>\n   <div class="').concat(swalClasses['timer-progress-bar-container'], '">\n     <div class="').concat(swalClasses['timer-progress-bar'], '"></div>\n   </div>\n </div>\n').replace(/(^|\n)\s*/g, '');

  /**
     * @return {boolean}
     */
  const resetOldContainer = function resetOldContainer() {
    const oldContainer = getContainer();
    if (!oldContainer) {
      return false;
    }
    oldContainer.remove();
    removeClass([document.documentElement, document.body], [swalClasses['no-backdrop'], swalClasses['toast-shown'], swalClasses['has-column']]);
    return true;
  };
  const resetValidationMessage$1 = function resetValidationMessage() {
    globalState.currentInstance.resetValidationMessage();
  };
  const addInputChangeListeners = function addInputChangeListeners() {
    const popup = getPopup();
    const input = getDirectChildByClass(popup, swalClasses.input);
    const file = getDirectChildByClass(popup, swalClasses.file);
    /** @type {HTMLInputElement} */
    const range = popup.querySelector('.'.concat(swalClasses.range, ' input'));
    /** @type {HTMLOutputElement} */
    const rangeOutput = popup.querySelector('.'.concat(swalClasses.range, ' output'));
    const select = getDirectChildByClass(popup, swalClasses.select);
    /** @type {HTMLInputElement} */
    const checkbox = popup.querySelector('.'.concat(swalClasses.checkbox, ' input'));
    const textarea = getDirectChildByClass(popup, swalClasses.textarea);
    input.oninput = resetValidationMessage$1;
    file.onchange = resetValidationMessage$1;
    select.onchange = resetValidationMessage$1;
    checkbox.onchange = resetValidationMessage$1;
    textarea.oninput = resetValidationMessage$1;
    range.oninput = function() {
      resetValidationMessage$1();
      rangeOutput.value = range.value;
    };
    range.onchange = function() {
      resetValidationMessage$1();
      rangeOutput.value = range.value;
    };
  };

  /**
     * @param {string | HTMLElement} target
     * @return {HTMLElement}
     */
  const getTarget = function getTarget(target) {
    return typeof target === 'string' ? document.querySelector(target) : target;
  };

  /**
     * @param {SweetAlertOptions} params
     */
  const setupAccessibility = function setupAccessibility(params) {
    const popup = getPopup();
    popup.setAttribute('role', params.toast ? 'alert' : 'dialog');
    popup.setAttribute('aria-live', params.toast ? 'polite' : 'assertive');
    if (!params.toast) {
      popup.setAttribute('aria-modal', 'true');
    }
  };

  /**
     * @param {HTMLElement} targetElement
     */
  const setupRTL = function setupRTL(targetElement) {
    if (window.getComputedStyle(targetElement).direction === 'rtl') {
      addClass(getContainer(), swalClasses.rtl);
    }
  };

  /**
     * Add modal + backdrop + no-war message for Russians to DOM
     *
     * @param {SweetAlertOptions} params
     */
  const init = function init(params) {
    // Clean up the old popup container if it exists
    const oldContainerExisted = resetOldContainer();
    if (isNodeEnv()) {
      error('SweetAlert2 requires document to initialize');
      return;
    }
    const container = document.createElement('div');
    container.className = swalClasses.container;
    if (oldContainerExisted) {
      addClass(container, swalClasses['no-transition']);
    }
    setInnerHtml(container, sweetHTML);
    const targetElement = getTarget(params.target);
    targetElement.appendChild(container);
    setupAccessibility(params);
    setupRTL(targetElement);
    addInputChangeListeners();
  };

  /**
     * @param {HTMLElement | object | string} param
     * @param {HTMLElement} target
     */
  const parseHtmlToContainer = function parseHtmlToContainer(param, target) {
    // DOM element
    if (param instanceof HTMLElement) {
      target.appendChild(param);
    }

    // Object
    else if (_typeof(param) === 'object') {
      handleObject(param, target);
    }

    // Plain string
    else if (param) {
      setInnerHtml(target, param);
    }
  };

  /**
     * @param {any} param
     * @param {HTMLElement} target
     */
  var handleObject = function handleObject(param, target) {
    // JQuery element(s)
    if (param.jquery) {
      handleJqueryElem(target, param);
    }

    // For other objects use their string representation
    else {
      setInnerHtml(target, param.toString());
    }
  };

  /**
     * @param {HTMLElement} target
     * @param {any} elem
     */
  var handleJqueryElem = function handleJqueryElem(target, elem) {
    target.textContent = '';
    if (0 in elem) {
      for (let i = 0; i in elem; i++) {
        target.appendChild(elem[i].cloneNode(true));
      }
    } else {
      target.appendChild(elem.cloneNode(true));
    }
  };

  /**
     * @returns {'webkitAnimationEnd' | 'animationend' | false}
     */
  const animationEndEvent = function() {
    // Prevent run in Node env
    if (isNodeEnv()) {
      return false;
    }
    const testEl = document.createElement('div');

    // Chrome, Safari and Opera
    if (typeof testEl.style.webkitAnimation !== 'undefined') {
      return 'webkitAnimationEnd';
    }

    // Standard syntax
    if (typeof testEl.style.animation !== 'undefined') {
      return 'animationend';
    }
    return false;
  }();

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderActions = function renderActions(instance, params) {
    const actions = getActions();
    const loader = getLoader();
    if (!actions || !loader) {
      return;
    }

    // Actions (buttons) wrapper
    if (!params.showConfirmButton && !params.showDenyButton && !params.showCancelButton) {
      hide(actions);
    } else {
      show(actions);
    }

    // Custom class
    applyCustomClass(actions, params, 'actions');

    // Render all the buttons
    renderButtons(actions, loader, params);

    // Loader
    setInnerHtml(loader, params.loaderHtml || '');
    applyCustomClass(loader, params, 'loader');
  };

  /**
     * @param {HTMLElement} actions
     * @param {HTMLElement} loader
     * @param {SweetAlertOptions} params
     */
  function renderButtons(actions, loader, params) {
    const confirmButton = getConfirmButton();
    const denyButton = getDenyButton();
    const cancelButton = getCancelButton();
    if (!confirmButton || !denyButton || !cancelButton) {
      return;
    }

    // Render buttons
    renderButton(confirmButton, 'confirm', params);
    renderButton(denyButton, 'deny', params);
    renderButton(cancelButton, 'cancel', params);
    handleButtonsStyling(confirmButton, denyButton, cancelButton, params);
    if (params.reverseButtons) {
      if (params.toast) {
        actions.insertBefore(cancelButton, confirmButton);
        actions.insertBefore(denyButton, confirmButton);
      } else {
        actions.insertBefore(cancelButton, loader);
        actions.insertBefore(denyButton, loader);
        actions.insertBefore(confirmButton, loader);
      }
    }
  }

  /**
     * @param {HTMLElement} confirmButton
     * @param {HTMLElement} denyButton
     * @param {HTMLElement} cancelButton
     * @param {SweetAlertOptions} params
     */
  function handleButtonsStyling(confirmButton, denyButton, cancelButton, params) {
    if (!params.buttonsStyling) {
      removeClass([confirmButton, denyButton, cancelButton], swalClasses.styled);
      return;
    }
    addClass([confirmButton, denyButton, cancelButton], swalClasses.styled);

    // Buttons background colors
    if (params.confirmButtonColor) {
      confirmButton.style.backgroundColor = params.confirmButtonColor;
      addClass(confirmButton, swalClasses['default-outline']);
    }
    if (params.denyButtonColor) {
      denyButton.style.backgroundColor = params.denyButtonColor;
      addClass(denyButton, swalClasses['default-outline']);
    }
    if (params.cancelButtonColor) {
      cancelButton.style.backgroundColor = params.cancelButtonColor;
      addClass(cancelButton, swalClasses['default-outline']);
    }
  }

  /**
     * @param {HTMLElement} button
     * @param {'confirm' | 'deny' | 'cancel'} buttonType
     * @param {SweetAlertOptions} params
     */
  function renderButton(button, buttonType, params) {
    const buttonName = /** @type {'Confirm' | 'Deny' | 'Cancel'} */capitalizeFirstLetter(buttonType);
    toggle(button, params['show'.concat(buttonName, 'Button')], 'inline-block');
    setInnerHtml(button, params[''.concat(buttonType, 'ButtonText')] || ''); // Set caption text
    button.setAttribute('aria-label', params[''.concat(buttonType, 'ButtonAriaLabel')] || ''); // ARIA label

    // Add buttons custom classes
    button.className = swalClasses[buttonType];
    applyCustomClass(button, params, ''.concat(buttonType, 'Button'));
  }

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderCloseButton = function renderCloseButton(instance, params) {
    const closeButton = getCloseButton();
    if (!closeButton) {
      return;
    }
    setInnerHtml(closeButton, params.closeButtonHtml || '');

    // Custom class
    applyCustomClass(closeButton, params, 'closeButton');
    toggle(closeButton, params.showCloseButton);
    closeButton.setAttribute('aria-label', params.closeButtonAriaLabel || '');
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderContainer = function renderContainer(instance, params) {
    const container = getContainer();
    if (!container) {
      return;
    }
    handleBackdropParam(container, params.backdrop);
    handlePositionParam(container, params.position);
    handleGrowParam(container, params.grow);

    // Custom class
    applyCustomClass(container, params, 'container');
  };

  /**
     * @param {HTMLElement} container
     * @param {SweetAlertOptions['backdrop']} backdrop
     */
  function handleBackdropParam(container, backdrop) {
    if (typeof backdrop === 'string') {
      container.style.background = backdrop;
    } else if (!backdrop) {
      addClass([document.documentElement, document.body], swalClasses['no-backdrop']);
    }
  }

  /**
     * @param {HTMLElement} container
     * @param {SweetAlertOptions['position']} position
     */
  function handlePositionParam(container, position) {
    if (!position) {
      return;
    }
    if (position in swalClasses) {
      addClass(container, swalClasses[position]);
    } else {
      warn('The "position" parameter is not valid, defaulting to "center"');
      addClass(container, swalClasses.center);
    }
  }

  /**
     * @param {HTMLElement} container
     * @param {SweetAlertOptions['grow']} grow
     */
  function handleGrowParam(container, grow) {
    if (!grow) {
      return;
    }
    addClass(container, swalClasses['grow-'.concat(grow)]);
  }

  /**
     * This module contains `WeakMap`s for each effectively-"private  property" that a `Swal` has.
     * For example, to set the private property "foo" of `this` to "bar", you can `privateProps.foo.set(this, 'bar')`
     * This is the approach that Babel will probably take to implement private methods/fields
     *   https://github.com/tc39/proposal-private-methods
     *   https://github.com/babel/babel/pull/7555
     * Once we have the changes from that PR in Babel, and our core class fits reasonable in *one module*
     *   then we can use that language feature.
     */

  const privateProps = {
    innerParams: new WeakMap(),
    domCache: new WeakMap(),
  };

  /** @type {InputClass[]} */
  const inputClasses = ['input', 'file', 'range', 'select', 'radio', 'checkbox', 'textarea'];

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderInput = function renderInput(instance, params) {
    const popup = getPopup();
    if (!popup) {
      return;
    }
    const innerParams = privateProps.innerParams.get(instance);
    const rerender = !innerParams || params.input !== innerParams.input;
    inputClasses.forEach(function(inputClass) {
      const inputContainer = getDirectChildByClass(popup, swalClasses[inputClass]);
      if (!inputContainer) {
        return;
      }

      // set attributes
      setAttributes(inputClass, params.inputAttributes);

      // set class
      inputContainer.className = swalClasses[inputClass];
      if (rerender) {
        hide(inputContainer);
      }
    });
    if (params.input) {
      if (rerender) {
        showInput(params);
      }
      // set custom class
      setCustomClass(params);
    }
  };

  /**
     * @param {SweetAlertOptions} params
     */
  var showInput = function showInput(params) {
    if (!params.input) {
      return;
    }
    if (!renderInputType[params.input]) {
      error('Unexpected type of input! Expected '.concat(Object.keys(renderInputType).join(' | '), ', got "').concat(params.input, '"'));
      return;
    }
    const inputContainer = getInputContainer(params.input);
    if (!inputContainer) {
      return;
    }
    const input = renderInputType[params.input](inputContainer, params);
    show(inputContainer);

    // input autofocus
    if (params.inputAutoFocus) {
      setTimeout(function() {
        focusInput(input);
      });
    }
  };

  /**
     * @param {HTMLInputElement} input
     */
  const removeAttributes = function removeAttributes(input) {
    for (let i = 0; i < input.attributes.length; i++) {
      const attrName = input.attributes[i].name;
      if (!['id', 'type', 'value', 'style'].includes(attrName)) {
        input.removeAttribute(attrName);
      }
    }
  };

  /**
     * @param {InputClass} inputClass
     * @param {SweetAlertOptions['inputAttributes']} inputAttributes
     */
  var setAttributes = function setAttributes(inputClass, inputAttributes) {
    const popup = getPopup();
    if (!popup) {
      return;
    }
    const input = getInput$1(popup, inputClass);
    if (!input) {
      return;
    }
    removeAttributes(input);
    for (const attr in inputAttributes) {
      input.setAttribute(attr, inputAttributes[attr]);
    }
  };

  /**
     * @param {SweetAlertOptions} params
     */
  var setCustomClass = function setCustomClass(params) {
    if (!params.input) {
      return;
    }
    const inputContainer = getInputContainer(params.input);
    if (inputContainer) {
      applyCustomClass(inputContainer, params, 'input');
    }
  };

  /**
     * @param {HTMLInputElement | HTMLTextAreaElement} input
     * @param {SweetAlertOptions} params
     */
  const setInputPlaceholder = function setInputPlaceholder(input, params) {
    if (!input.placeholder && params.inputPlaceholder) {
      input.placeholder = params.inputPlaceholder;
    }
  };

  /**
     * @param {Input} input
     * @param {Input} prependTo
     * @param {SweetAlertOptions} params
     */
  const setInputLabel = function setInputLabel(input, prependTo, params) {
    if (params.inputLabel) {
      const label = document.createElement('label');
      const labelClass = swalClasses['input-label'];
      label.setAttribute('for', input.id);
      label.className = labelClass;
      if (_typeof(params.customClass) === 'object') {
        addClass(label, params.customClass.inputLabel);
      }
      label.innerText = params.inputLabel;
      prependTo.insertAdjacentElement('beforebegin', label);
    }
  };

  /**
     * @param {SweetAlertInput} inputType
     * @return {HTMLElement | undefined}
     */
  var getInputContainer = function getInputContainer(inputType) {
    const popup = getPopup();
    if (!popup) {
      return;
    }
    return getDirectChildByClass(popup, swalClasses[( /** @type {SwalClass} */inputType)] || swalClasses.input);
  };

  /**
     * @param {HTMLInputElement | HTMLOutputElement | HTMLTextAreaElement} input
     * @param {SweetAlertOptions['inputValue']} inputValue
     */
  const checkAndSetInputValue = function checkAndSetInputValue(input, inputValue) {
    if (['string', 'number'].includes(_typeof(inputValue))) {
      input.value = ''.concat(inputValue);
    } else if (!isPromise(inputValue)) {
      warn('Unexpected type of inputValue! Expected "string", "number" or "Promise", got "'.concat(_typeof(inputValue), '"'));
    }
  };

  /** @type {Record<SweetAlertInput, (input: Input | HTMLElement, params: SweetAlertOptions) => Input>} */
  var renderInputType = {};

  /**
     * @param {HTMLInputElement} input
     * @param {SweetAlertOptions} params
     * @return {HTMLInputElement}
     */
  renderInputType.text = renderInputType.email = renderInputType.password = renderInputType.number = renderInputType.tel = renderInputType.url = renderInputType.search = renderInputType.date = renderInputType['datetime-local'] = renderInputType.time = renderInputType.week = renderInputType.month = /** @type {(input: Input | HTMLElement, params: SweetAlertOptions) => Input} */
    function(input, params) {
      checkAndSetInputValue(input, params.inputValue);
      setInputLabel(input, input, params);
      setInputPlaceholder(input, params);
      input.type = params.input;
      return input;
    };

  /**
     * @param {HTMLInputElement} input
     * @param {SweetAlertOptions} params
     * @return {HTMLInputElement}
     */
  renderInputType.file = function(input, params) {
    setInputLabel(input, input, params);
    setInputPlaceholder(input, params);
    return input;
  };

  /**
     * @param {HTMLInputElement} range
     * @param {SweetAlertOptions} params
     * @return {HTMLInputElement}
     */
  renderInputType.range = function(range, params) {
    const rangeInput = range.querySelector('input');
    const rangeOutput = range.querySelector('output');
    checkAndSetInputValue(rangeInput, params.inputValue);
    rangeInput.type = params.input;
    checkAndSetInputValue(rangeOutput, params.inputValue);
    setInputLabel(rangeInput, range, params);
    return range;
  };

  /**
     * @param {HTMLSelectElement} select
     * @param {SweetAlertOptions} params
     * @return {HTMLSelectElement}
     */
  renderInputType.select = function(select, params) {
    select.textContent = '';
    if (params.inputPlaceholder) {
      const placeholder = document.createElement('option');
      setInnerHtml(placeholder, params.inputPlaceholder);
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);
    }
    setInputLabel(select, select, params);
    return select;
  };

  /**
     * @param {HTMLInputElement} radio
     * @return {HTMLInputElement}
     */
  renderInputType.radio = function(radio) {
    radio.textContent = '';
    return radio;
  };

  /**
     * @param {HTMLLabelElement} checkboxContainer
     * @param {SweetAlertOptions} params
     * @return {HTMLInputElement}
     */
  renderInputType.checkbox = function(checkboxContainer, params) {
    const checkbox = getInput$1(getPopup(), 'checkbox');
    checkbox.value = '1';
    checkbox.checked = Boolean(params.inputValue);
    const label = checkboxContainer.querySelector('span');
    setInnerHtml(label, params.inputPlaceholder);
    return checkbox;
  };

  /**
     * @param {HTMLTextAreaElement} textarea
     * @param {SweetAlertOptions} params
     * @return {HTMLTextAreaElement}
     */
  renderInputType.textarea = function(textarea, params) {
    checkAndSetInputValue(textarea, params.inputValue);
    setInputPlaceholder(textarea, params);
    setInputLabel(textarea, textarea, params);

    /**
       * @param {HTMLElement} el
       * @return {number}
       */
    const getMargin = function getMargin(el) {
      return parseInt(window.getComputedStyle(el).marginLeft) + parseInt(window.getComputedStyle(el).marginRight);
    };

    // https://github.com/sweetalert2/sweetalert2/issues/2291
    setTimeout(function() {
      // https://github.com/sweetalert2/sweetalert2/issues/1699
      if ('MutationObserver' in window) {
        const initialPopupWidth = parseInt(window.getComputedStyle(getPopup()).width);
        const textareaResizeHandler = function textareaResizeHandler() {
          // check if texarea is still in document (i.e. popup wasn't closed in the meantime)
          if (!document.body.contains(textarea)) {
            return;
          }
          const textareaWidth = textarea.offsetWidth + getMargin(textarea);
          if (textareaWidth > initialPopupWidth) {
            getPopup().style.width = ''.concat(textareaWidth, 'px');
          } else {
            applyNumericalStyle(getPopup(), 'width', params.width);
          }
        };
        new MutationObserver(textareaResizeHandler).observe(textarea, {
          attributes: true,
          attributeFilter: ['style'],
        });
      }
    });
    return textarea;
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderContent = function renderContent(instance, params) {
    const htmlContainer = getHtmlContainer();
    if (!htmlContainer) {
      return;
    }
    showWhenInnerHtmlPresent(htmlContainer);
    applyCustomClass(htmlContainer, params, 'htmlContainer');

    // Content as HTML
    if (params.html) {
      parseHtmlToContainer(params.html, htmlContainer);
      show(htmlContainer, 'block');
    }

    // Content as plain text
    else if (params.text) {
      htmlContainer.textContent = params.text;
      show(htmlContainer, 'block');
    }

    // No content
    else {
      hide(htmlContainer);
    }
    renderInput(instance, params);
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderFooter = function renderFooter(instance, params) {
    const footer = getFooter();
    if (!footer) {
      return;
    }
    showWhenInnerHtmlPresent(footer);
    toggle(footer, params.footer, 'block');
    if (params.footer) {
      parseHtmlToContainer(params.footer, footer);
    }

    // Custom class
    applyCustomClass(footer, params, 'footer');
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderIcon = function renderIcon(instance, params) {
    const innerParams = privateProps.innerParams.get(instance);
    const icon = getIcon();
    if (!icon) {
      return;
    }

    // if the given icon already rendered, apply the styling without re-rendering the icon
    if (innerParams && params.icon === innerParams.icon) {
      // Custom or default content
      setContent(icon, params);
      applyStyles(icon, params);
      return;
    }
    if (!params.icon && !params.iconHtml) {
      hide(icon);
      return;
    }
    if (params.icon && Object.keys(iconTypes).indexOf(params.icon) === -1) {
      error('Unknown icon! Expected "success", "error", "warning", "info" or "question", got "'.concat(params.icon, '"'));
      hide(icon);
      return;
    }
    show(icon);

    // Custom or default content
    setContent(icon, params);
    applyStyles(icon, params);

    // Animate icon
    addClass(icon, params.showClass && params.showClass.icon);
  };

  /**
     * @param {HTMLElement} icon
     * @param {SweetAlertOptions} params
     */
  var applyStyles = function applyStyles(icon, params) {
    for (let _i = 0, _Object$entries = Object.entries(iconTypes); _i < _Object$entries.length; _i++) {
      const _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2);
      const iconType = _Object$entries$_i[0];
      const iconClassName = _Object$entries$_i[1];
      if (params.icon !== iconType) {
        removeClass(icon, iconClassName);
      }
    }
    addClass(icon, params.icon && iconTypes[params.icon]);

    // Icon color
    setColor(icon, params);

    // Success icon background color
    adjustSuccessIconBackgroundColor();

    // Custom class
    applyCustomClass(icon, params, 'icon');
  };

  // Adjust success icon background color to match the popup background color
  var adjustSuccessIconBackgroundColor = function adjustSuccessIconBackgroundColor() {
    const popup = getPopup();
    if (!popup) {
      return;
    }
    const popupBackgroundColor = window.getComputedStyle(popup).getPropertyValue('background-color');
    /** @type {NodeListOf<HTMLElement>} */
    const successIconParts = popup.querySelectorAll('[class^=swal2-success-circular-line], .swal2-success-fix');
    for (let i = 0; i < successIconParts.length; i++) {
      successIconParts[i].style.backgroundColor = popupBackgroundColor;
    }
  };
  const successIconHtml = '\n  <div class="swal2-success-circular-line-left"></div>\n  <span class="swal2-success-line-tip"></span> <span class="swal2-success-line-long"></span>\n  <div class="swal2-success-ring"></div> <div class="swal2-success-fix"></div>\n  <div class="swal2-success-circular-line-right"></div>\n';
  const errorIconHtml = '\n  <span class="swal2-x-mark">\n    <span class="swal2-x-mark-line-left"></span>\n    <span class="swal2-x-mark-line-right"></span>\n  </span>\n';

  /**
     * @param {HTMLElement} icon
     * @param {SweetAlertOptions} params
     */
  var setContent = function setContent(icon, params) {
    if (!params.icon && !params.iconHtml) {
      return;
    }
    let oldContent = icon.innerHTML;
    let newContent = '';
    if (params.iconHtml) {
      newContent = iconContent(params.iconHtml);
    } else if (params.icon === 'success') {
      newContent = successIconHtml;
      oldContent = oldContent.replace(/ style=".*?"/g, ''); // undo adjustSuccessIconBackgroundColor()
    } else if (params.icon === 'error') {
      newContent = errorIconHtml;
    } else if (params.icon) {
      const defaultIconHtml = {
        question: '?',
        warning: '!',
        info: 'i',
      };
      newContent = iconContent(defaultIconHtml[params.icon]);
    }
    if (oldContent.trim() !== newContent.trim()) {
      setInnerHtml(icon, newContent);
    }
  };

  /**
     * @param {HTMLElement} icon
     * @param {SweetAlertOptions} params
     */
  var setColor = function setColor(icon, params) {
    if (!params.iconColor) {
      return;
    }
    icon.style.color = params.iconColor;
    icon.style.borderColor = params.iconColor;
    for (let _i2 = 0, _arr = ['.swal2-success-line-tip', '.swal2-success-line-long', '.swal2-x-mark-line-left', '.swal2-x-mark-line-right']; _i2 < _arr.length; _i2++) {
      const sel = _arr[_i2];
      setStyle(icon, sel, 'background-color', params.iconColor);
    }
    setStyle(icon, '.swal2-success-ring', 'border-color', params.iconColor);
  };

  /**
     * @param {string} content
     * @return {string}
     */
  var iconContent = function iconContent(content) {
    return '<div class="'.concat(swalClasses['icon-content'], '">').concat(content, '</div>');
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderImage = function renderImage(instance, params) {
    const image = getImage();
    if (!image) {
      return;
    }
    if (!params.imageUrl) {
      hide(image);
      return;
    }
    show(image, '');

    // Src, alt
    image.setAttribute('src', params.imageUrl);
    image.setAttribute('alt', params.imageAlt || '');

    // Width, height
    applyNumericalStyle(image, 'width', params.imageWidth);
    applyNumericalStyle(image, 'height', params.imageHeight);

    // Class
    image.className = swalClasses.image;
    applyCustomClass(image, params, 'image');
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderPopup = function renderPopup(instance, params) {
    const container = getContainer();
    const popup = getPopup();
    if (!container || !popup) {
      return;
    }

    // Width
    // https://github.com/sweetalert2/sweetalert2/issues/2170
    if (params.toast) {
      applyNumericalStyle(container, 'width', params.width);
      popup.style.width = '100%';
      const loader = getLoader();
      if (loader) {
        popup.insertBefore(loader, getIcon());
      }
    } else {
      applyNumericalStyle(popup, 'width', params.width);
    }

    // Padding
    applyNumericalStyle(popup, 'padding', params.padding);

    // Color
    if (params.color) {
      popup.style.color = params.color;
    }

    // Background
    if (params.background) {
      popup.style.background = params.background;
    }
    hide(getValidationMessage());

    // Classes
    addClasses$1(popup, params);
  };

  /**
     * @param {HTMLElement} popup
     * @param {SweetAlertOptions} params
     */
  var addClasses$1 = function addClasses(popup, params) {
    const showClass = params.showClass || {};
    // Default Class + showClass when updating Swal.update({})
    popup.className = ''.concat(swalClasses.popup, ' ').concat(isVisible$1(popup) ? showClass.popup : '');
    if (params.toast) {
      addClass([document.documentElement, document.body], swalClasses['toast-shown']);
      addClass(popup, swalClasses.toast);
    } else {
      addClass(popup, swalClasses.modal);
    }

    // Custom class
    applyCustomClass(popup, params, 'popup');
    // TODO: remove in the next major
    if (typeof params.customClass === 'string') {
      addClass(popup, params.customClass);
    }

    // Icon class (#1842)
    if (params.icon) {
      addClass(popup, swalClasses['icon-'.concat(params.icon)]);
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderProgressSteps = function renderProgressSteps(instance, params) {
    const progressStepsContainer = getProgressSteps();
    if (!progressStepsContainer) {
      return;
    }
    const progressSteps = params.progressSteps;
    const currentProgressStep = params.currentProgressStep;
    if (!progressSteps || progressSteps.length === 0 || currentProgressStep === undefined) {
      hide(progressStepsContainer);
      return;
    }
    show(progressStepsContainer);
    progressStepsContainer.textContent = '';
    if (currentProgressStep >= progressSteps.length) {
      warn('Invalid currentProgressStep parameter, it should be less than progressSteps.length ' + '(currentProgressStep like JS arrays starts from 0)');
    }
    progressSteps.forEach(function(step, index) {
      const stepEl = createStepElement(step);
      progressStepsContainer.appendChild(stepEl);
      if (index === currentProgressStep) {
        addClass(stepEl, swalClasses['active-progress-step']);
      }
      if (index !== progressSteps.length - 1) {
        const lineEl = createLineElement(params);
        progressStepsContainer.appendChild(lineEl);
      }
    });
  };

  /**
     * @param {string} step
     * @return {HTMLLIElement}
     */
  var createStepElement = function createStepElement(step) {
    const stepEl = document.createElement('li');
    addClass(stepEl, swalClasses['progress-step']);
    setInnerHtml(stepEl, step);
    return stepEl;
  };

  /**
     * @param {SweetAlertOptions} params
     * @return {HTMLLIElement}
     */
  var createLineElement = function createLineElement(params) {
    const lineEl = document.createElement('li');
    addClass(lineEl, swalClasses['progress-step-line']);
    if (params.progressStepsDistance) {
      applyNumericalStyle(lineEl, 'width', params.progressStepsDistance);
    }
    return lineEl;
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const renderTitle = function renderTitle(instance, params) {
    const title = getTitle();
    if (!title) {
      return;
    }
    showWhenInnerHtmlPresent(title);
    toggle(title, params.title || params.titleText, 'block');
    if (params.title) {
      parseHtmlToContainer(params.title, title);
    }
    if (params.titleText) {
      title.innerText = params.titleText;
    }

    // Custom class
    applyCustomClass(title, params, 'title');
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const render = function render(instance, params) {
    renderPopup(instance, params);
    renderContainer(instance, params);
    renderProgressSteps(instance, params);
    renderIcon(instance, params);
    renderImage(instance, params);
    renderTitle(instance, params);
    renderCloseButton(instance, params);
    renderContent(instance, params);
    renderActions(instance, params);
    renderFooter(instance, params);
    const popup = getPopup();
    if (typeof params.didRender === 'function' && popup) {
      params.didRender(popup);
    }
  };

  /*
     * Global function to determine if SweetAlert2 popup is shown
     */
  const isVisible = function isVisible() {
    return isVisible$1(getPopup());
  };

  /*
     * Global function to click 'Confirm' button
     */
  const clickConfirm = function clickConfirm() {
    let _dom$getConfirmButton;
    return (_dom$getConfirmButton = getConfirmButton()) === null || _dom$getConfirmButton === void 0 ? void 0 : _dom$getConfirmButton.click();
  };

  /*
     * Global function to click 'Deny' button
     */
  const clickDeny = function clickDeny() {
    let _dom$getDenyButton;
    return (_dom$getDenyButton = getDenyButton()) === null || _dom$getDenyButton === void 0 ? void 0 : _dom$getDenyButton.click();
  };

  /*
     * Global function to click 'Cancel' button
     */
  const clickCancel = function clickCancel() {
    let _dom$getCancelButton;
    return (_dom$getCancelButton = getCancelButton()) === null || _dom$getCancelButton === void 0 ? void 0 : _dom$getCancelButton.click();
  };

  /** @typedef {'cancel' | 'backdrop' | 'close' | 'esc' | 'timer'} DismissReason */

  /** @type {Record<DismissReason, DismissReason>} */
  const DismissReason = Object.freeze({
    cancel: 'cancel',
    backdrop: 'backdrop',
    close: 'close',
    esc: 'esc',
    timer: 'timer',
  });

  /**
     * @param {GlobalState} globalState
     */
  const removeKeydownHandler = function removeKeydownHandler(globalState) {
    if (globalState.keydownTarget && globalState.keydownHandlerAdded) {
      globalState.keydownTarget.removeEventListener('keydown', globalState.keydownHandler, {
        capture: globalState.keydownListenerCapture,
      });
      globalState.keydownHandlerAdded = false;
    }
  };

  /**
     * @param {GlobalState} globalState
     * @param {SweetAlertOptions} innerParams
     * @param {*} dismissWith
     */
  const addKeydownHandler = function addKeydownHandler(globalState, innerParams, dismissWith) {
    removeKeydownHandler(globalState);
    if (!innerParams.toast) {
      globalState.keydownHandler = function(e) {
        return keydownHandler(innerParams, e, dismissWith);
      };
      globalState.keydownTarget = innerParams.keydownListenerCapture ? window : getPopup();
      globalState.keydownListenerCapture = innerParams.keydownListenerCapture;
      globalState.keydownTarget.addEventListener('keydown', globalState.keydownHandler, {
        capture: globalState.keydownListenerCapture,
      });
      globalState.keydownHandlerAdded = true;
    }
  };

  /**
     * @param {number} index
     * @param {number} increment
     */
  const setFocus = function setFocus(index, increment) {
    let _dom$getPopup;
    const focusableElements = getFocusableElements();
    // search for visible elements and select the next possible match
    if (focusableElements.length) {
      index = index + increment;

      // rollover to first item
      if (index === focusableElements.length) {
        index = 0;

        // go to last item
      } else if (index === -1) {
        index = focusableElements.length - 1;
      }
      focusableElements[index].focus();
      return;
    }
    // no visible focusable elements, focus the popup
    (_dom$getPopup = getPopup()) === null || _dom$getPopup === void 0 || _dom$getPopup.focus();
  };
  const arrowKeysNextButton = ['ArrowRight', 'ArrowDown'];
  const arrowKeysPreviousButton = ['ArrowLeft', 'ArrowUp'];

  /**
     * @param {SweetAlertOptions} innerParams
     * @param {KeyboardEvent} event
     * @param {Function} dismissWith
     */
  var keydownHandler = function keydownHandler(innerParams, event, dismissWith) {
    if (!innerParams) {
      return; // This instance has already been destroyed
    }

    // Ignore keydown during IME composition
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/keydown_event#ignoring_keydown_during_ime_composition
    // https://github.com/sweetalert2/sweetalert2/issues/720
    // https://github.com/sweetalert2/sweetalert2/issues/2406
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (innerParams.stopKeydownPropagation) {
      event.stopPropagation();
    }

    // ENTER
    if (event.key === 'Enter') {
      handleEnter(event, innerParams);
    }

    // TAB
    else if (event.key === 'Tab') {
      handleTab(event);
    }

    // ARROWS - switch focus between buttons
    else if ([].concat(arrowKeysNextButton, arrowKeysPreviousButton).includes(event.key)) {
      handleArrows(event.key);
    }

    // ESC
    else if (event.key === 'Escape') {
      handleEsc(event, innerParams, dismissWith);
    }
  };

  /**
     * @param {KeyboardEvent} event
     * @param {SweetAlertOptions} innerParams
     */
  var handleEnter = function handleEnter(event, innerParams) {
    // https://github.com/sweetalert2/sweetalert2/issues/2386
    if (!callIfFunction(innerParams.allowEnterKey)) {
      return;
    }
    const input = getInput$1(getPopup(), innerParams.input);
    if (event.target && input && event.target instanceof HTMLElement && event.target.outerHTML === input.outerHTML) {
      if (['textarea', 'file'].includes(innerParams.input)) {
        return; // do not submit
      }
      clickConfirm();
      event.preventDefault();
    }
  };

  /**
     * @param {KeyboardEvent} event
     */
  var handleTab = function handleTab(event) {
    const targetElement = event.target;
    const focusableElements = getFocusableElements();
    let btnIndex = -1;
    for (let i = 0; i < focusableElements.length; i++) {
      if (targetElement === focusableElements[i]) {
        btnIndex = i;
        break;
      }
    }

    // Cycle to the next button
    if (!event.shiftKey) {
      setFocus(btnIndex, 1);
    }

    // Cycle to the prev button
    else {
      setFocus(btnIndex, -1);
    }
    event.stopPropagation();
    event.preventDefault();
  };

  /**
     * @param {string} key
     */
  var handleArrows = function handleArrows(key) {
    const actions = getActions();
    const confirmButton = getConfirmButton();
    const denyButton = getDenyButton();
    const cancelButton = getCancelButton();
    if (!actions || !confirmButton || !denyButton || !cancelButton) {
      return;
    }
    /** @type HTMLElement[] */
    const buttons = [confirmButton, denyButton, cancelButton];
    if (document.activeElement instanceof HTMLElement && !buttons.includes(document.activeElement)) {
      return;
    }
    const sibling = arrowKeysNextButton.includes(key) ? 'nextElementSibling' : 'previousElementSibling';
    let buttonToFocus = document.activeElement;
    if (!buttonToFocus) {
      return;
    }
    for (let i = 0; i < actions.children.length; i++) {
      buttonToFocus = buttonToFocus[sibling];
      if (!buttonToFocus) {
        return;
      }
      if (buttonToFocus instanceof HTMLButtonElement && isVisible$1(buttonToFocus)) {
        break;
      }
    }
    if (buttonToFocus instanceof HTMLButtonElement) {
      buttonToFocus.focus();
    }
  };

  /**
     * @param {KeyboardEvent} event
     * @param {SweetAlertOptions} innerParams
     * @param {Function} dismissWith
     */
  var handleEsc = function handleEsc(event, innerParams, dismissWith) {
    if (callIfFunction(innerParams.allowEscapeKey)) {
      event.preventDefault();
      dismissWith(DismissReason.esc);
    }
  };

  /**
     * This module contains `WeakMap`s for each effectively-"private  property" that a `Swal` has.
     * For example, to set the private property "foo" of `this` to "bar", you can `privateProps.foo.set(this, 'bar')`
     * This is the approach that Babel will probably take to implement private methods/fields
     *   https://github.com/tc39/proposal-private-methods
     *   https://github.com/babel/babel/pull/7555
     * Once we have the changes from that PR in Babel, and our core class fits reasonable in *one module*
     *   then we can use that language feature.
     */

  const privateMethods = {
    swalPromiseResolve: new WeakMap(),
    swalPromiseReject: new WeakMap(),
  };

  // From https://developer.paciellogroup.com/blog/2018/06/the-current-state-of-modal-dialog-accessibility/
  // Adding aria-hidden="true" to elements outside of the active modal dialog ensures that
  // elements not within the active modal dialog will not be surfaced if a user opens a screen
  // reader’s list of elements (headings, form controls, landmarks, etc.) in the document.

  const setAriaHidden = function setAriaHidden() {
    const container = getContainer();
    const bodyChildren = Array.from(document.body.children);
    bodyChildren.forEach(function(el) {
      if (el.contains(container)) {
        return;
      }
      if (el.hasAttribute('aria-hidden')) {
        el.setAttribute('data-previous-aria-hidden', el.getAttribute('aria-hidden') || '');
      }
      el.setAttribute('aria-hidden', 'true');
    });
  };
  const unsetAriaHidden = function unsetAriaHidden() {
    const bodyChildren = Array.from(document.body.children);
    bodyChildren.forEach(function(el) {
      if (el.hasAttribute('data-previous-aria-hidden')) {
        el.setAttribute('aria-hidden', el.getAttribute('data-previous-aria-hidden') || '');
        el.removeAttribute('data-previous-aria-hidden');
      } else {
        el.removeAttribute('aria-hidden');
      }
    });
  };

  // @ts-ignore
  const isSafariOrIOS = typeof window !== 'undefined' && !!window.GestureEvent; // true for Safari desktop + all iOS browsers https://stackoverflow.com/a/70585394

  /**
     * Fix iOS scrolling
     * http://stackoverflow.com/q/39626302
     */
  const iOSfix = function iOSfix() {
    if (isSafariOrIOS && !hasClass(document.body, swalClasses.iosfix)) {
      const offset = document.body.scrollTop;
      document.body.style.top = ''.concat(offset * -1, 'px');
      addClass(document.body, swalClasses.iosfix);
      lockBodyScroll();
    }
  };

  /**
     * https://github.com/sweetalert2/sweetalert2/issues/1246
     */
  var lockBodyScroll = function lockBodyScroll() {
    const container = getContainer();
    if (!container) {
      return;
    }
    /** @type {boolean} */
    let preventTouchMove;
    /**
       * @param {TouchEvent} event
       */
    container.ontouchstart = function(event) {
      preventTouchMove = shouldPreventTouchMove(event);
    };
    /**
       * @param {TouchEvent} event
       */
    container.ontouchmove = function(event) {
      if (preventTouchMove) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  };

  /**
     * @param {TouchEvent} event
     * @return {boolean}
     */
  var shouldPreventTouchMove = function shouldPreventTouchMove(event) {
    const target = event.target;
    const container = getContainer();
    const htmlContainer = getHtmlContainer();
    if (!container || !htmlContainer) {
      return false;
    }
    if (isStylus(event) || isZoom(event)) {
      return false;
    }
    if (target === container) {
      return true;
    }
    if (!isScrollable(container) && target instanceof HTMLElement && target.tagName !== 'INPUT' &&
      // #1603
      target.tagName !== 'TEXTAREA' &&
      // #2266
      !(isScrollable(htmlContainer) &&
      // #1944
      htmlContainer.contains(target))) {
      return true;
    }
    return false;
  };

  /**
     * https://github.com/sweetalert2/sweetalert2/issues/1786
     *
     * @param {*} event
     * @return {boolean}
     */
  var isStylus = function isStylus(event) {
    return event.touches && event.touches.length && event.touches[0].touchType === 'stylus';
  };

  /**
     * https://github.com/sweetalert2/sweetalert2/issues/1891
     *
     * @param {TouchEvent} event
     * @return {boolean}
     */
  var isZoom = function isZoom(event) {
    return event.touches && event.touches.length > 1;
  };
  const undoIOSfix = function undoIOSfix() {
    if (hasClass(document.body, swalClasses.iosfix)) {
      const offset = parseInt(document.body.style.top, 10);
      removeClass(document.body, swalClasses.iosfix);
      document.body.style.top = '';
      document.body.scrollTop = offset * -1;
    }
  };

  /**
     * Measure scrollbar width for padding body during modal show/hide
     * https://github.com/twbs/bootstrap/blob/master/js/src/modal.js
     *
     * @return {number}
     */
  const measureScrollbar = function measureScrollbar() {
    const scrollDiv = document.createElement('div');
    scrollDiv.className = swalClasses['scrollbar-measure'];
    document.body.appendChild(scrollDiv);
    const scrollbarWidth = scrollDiv.getBoundingClientRect().width - scrollDiv.clientWidth;
    document.body.removeChild(scrollDiv);
    return scrollbarWidth;
  };

  /**
     * Remember state in cases where opening and handling a modal will fiddle with it.
     * @type {number | null}
     */
  let previousBodyPadding = null;

  /**
     * @param {string} initialBodyOverflow
     */
  const replaceScrollbarWithPadding = function replaceScrollbarWithPadding(initialBodyOverflow) {
    // for queues, do not do this more than once
    if (previousBodyPadding !== null) {
      return;
    }
    // if the body has overflow
    if (document.body.scrollHeight > window.innerHeight || initialBodyOverflow === 'scroll' // https://github.com/sweetalert2/sweetalert2/issues/2663
    ) {
      // add padding so the content doesn't shift after removal of scrollbar
      previousBodyPadding = parseInt(window.getComputedStyle(document.body).getPropertyValue('padding-right'));
      document.body.style.paddingRight = ''.concat(previousBodyPadding + measureScrollbar(), 'px');
    }
  };
  const undoReplaceScrollbarWithPadding = function undoReplaceScrollbarWithPadding() {
    if (previousBodyPadding !== null) {
      document.body.style.paddingRight = ''.concat(previousBodyPadding, 'px');
      previousBodyPadding = null;
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {HTMLElement} container
     * @param {boolean} returnFocus
     * @param {Function} didClose
     */
  function removePopupAndResetState(instance, container, returnFocus, didClose) {
    if (isToast()) {
      triggerDidCloseAndDispose(instance, didClose);
    } else {
      restoreActiveElement(returnFocus).then(function() {
        return triggerDidCloseAndDispose(instance, didClose);
      });
      removeKeydownHandler(globalState);
    }

    // workaround for https://github.com/sweetalert2/sweetalert2/issues/2088
    // for some reason removing the container in Safari will scroll the document to bottom
    if (isSafariOrIOS) {
      container.setAttribute('style', 'display:none !important');
      container.removeAttribute('class');
      container.innerHTML = '';
    } else {
      container.remove();
    }
    if (isModal()) {
      undoReplaceScrollbarWithPadding();
      undoIOSfix();
      unsetAriaHidden();
    }
    removeBodyClasses();
  }

  /**
     * Remove SweetAlert2 classes from body
     */
  function removeBodyClasses() {
    removeClass([document.documentElement, document.body], [swalClasses.shown, swalClasses['height-auto'], swalClasses['no-backdrop'], swalClasses['toast-shown']]);
  }

  /**
     * Instance method to close sweetAlert
     *
     * @param {any} resolveValue
     */
  function close(resolveValue) {
    resolveValue = prepareResolveValue(resolveValue);
    const swalPromiseResolve = privateMethods.swalPromiseResolve.get(this);
    const didClose = triggerClosePopup(this);
    if (this.isAwaitingPromise) {
      // A swal awaiting for a promise (after a click on Confirm or Deny) cannot be dismissed anymore #2335
      if (!resolveValue.isDismissed) {
        handleAwaitingPromise(this);
        swalPromiseResolve(resolveValue);
      }
    } else if (didClose) {
      // Resolve Swal promise
      swalPromiseResolve(resolveValue);
    }
  }
  var triggerClosePopup = function triggerClosePopup(instance) {
    const popup = getPopup();
    if (!popup) {
      return false;
    }
    const innerParams = privateProps.innerParams.get(instance);
    if (!innerParams || hasClass(popup, innerParams.hideClass.popup)) {
      return false;
    }
    removeClass(popup, innerParams.showClass.popup);
    addClass(popup, innerParams.hideClass.popup);
    const backdrop = getContainer();
    removeClass(backdrop, innerParams.showClass.backdrop);
    addClass(backdrop, innerParams.hideClass.backdrop);
    handlePopupAnimation(instance, popup, innerParams);
    return true;
  };

  /**
     * @param {any} error
     */
  function rejectPromise(error) {
    const rejectPromise = privateMethods.swalPromiseReject.get(this);
    handleAwaitingPromise(this);
    if (rejectPromise) {
      // Reject Swal promise
      rejectPromise(error);
    }
  }

  /**
     * @param {SweetAlert} instance
     */
  var handleAwaitingPromise = function handleAwaitingPromise(instance) {
    if (instance.isAwaitingPromise) {
      delete instance.isAwaitingPromise;
      // The instance might have been previously partly destroyed, we must resume the destroy process in this case #2335
      if (!privateProps.innerParams.get(instance)) {
        instance._destroy();
      }
    }
  };

  /**
     * @param {any} resolveValue
     * @return {SweetAlertResult}
     */
  var prepareResolveValue = function prepareResolveValue(resolveValue) {
    // When user calls Swal.close()
    if (typeof resolveValue === 'undefined') {
      return {
        isConfirmed: false,
        isDenied: false,
        isDismissed: true,
      };
    }
    return Object.assign({
      isConfirmed: false,
      isDenied: false,
      isDismissed: false,
    }, resolveValue);
  };

  /**
     * @param {SweetAlert} instance
     * @param {HTMLElement} popup
     * @param {SweetAlertOptions} innerParams
     */
  var handlePopupAnimation = function handlePopupAnimation(instance, popup, innerParams) {
    const container = getContainer();
    // If animation is supported, animate
    const animationIsSupported = animationEndEvent && hasCssAnimation(popup);
    if (typeof innerParams.willClose === 'function') {
      innerParams.willClose(popup);
    }
    if (animationIsSupported) {
      animatePopup(instance, popup, container, innerParams.returnFocus, innerParams.didClose);
    } else {
      // Otherwise, remove immediately
      removePopupAndResetState(instance, container, innerParams.returnFocus, innerParams.didClose);
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {HTMLElement} popup
     * @param {HTMLElement} container
     * @param {boolean} returnFocus
     * @param {Function} didClose
     */
  var animatePopup = function animatePopup(instance, popup, container, returnFocus, didClose) {
    if (!animationEndEvent) {
      return;
    }
    globalState.swalCloseEventFinishedCallback = removePopupAndResetState.bind(null, instance, container, returnFocus, didClose);
    popup.addEventListener(animationEndEvent, function(e) {
      if (e.target === popup) {
        globalState.swalCloseEventFinishedCallback();
        delete globalState.swalCloseEventFinishedCallback;
      }
    });
  };

  /**
     * @param {SweetAlert} instance
     * @param {Function} didClose
     */
  var triggerDidCloseAndDispose = function triggerDidCloseAndDispose(instance, didClose) {
    setTimeout(function() {
      if (typeof didClose === 'function') {
        didClose.bind(instance.params)();
      }
      // instance might have been destroyed already
      if (instance._destroy) {
        instance._destroy();
      }
    });
  };

  /**
     * Shows loader (spinner), this is useful with AJAX requests.
     * By default the loader be shown instead of the "Confirm" button.
     *
     * @param {HTMLButtonElement | null} [buttonToReplace]
     */
  const showLoading = function showLoading(buttonToReplace) {
    let popup = getPopup();
    if (!popup) {
      new Swal();
    }
    popup = getPopup();
    if (!popup) {
      return;
    }
    const loader = getLoader();
    if (isToast()) {
      hide(getIcon());
    } else {
      replaceButton(popup, buttonToReplace);
    }
    show(loader);
    popup.setAttribute('data-loading', 'true');
    popup.setAttribute('aria-busy', 'true');
    popup.focus();
  };

  /**
     * @param {HTMLElement} popup
     * @param {HTMLButtonElement | null} [buttonToReplace]
     */
  var replaceButton = function replaceButton(popup, buttonToReplace) {
    const actions = getActions();
    const loader = getLoader();
    if (!actions || !loader) {
      return;
    }
    if (!buttonToReplace && isVisible$1(getConfirmButton())) {
      buttonToReplace = getConfirmButton();
    }
    show(actions);
    if (buttonToReplace) {
      hide(buttonToReplace);
      loader.setAttribute('data-button-to-replace', buttonToReplace.className);
      actions.insertBefore(loader, buttonToReplace);
    }
    addClass([popup, actions], swalClasses.loading);
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  const handleInputOptionsAndValue = function handleInputOptionsAndValue(instance, params) {
    if (params.input === 'select' || params.input === 'radio') {
      handleInputOptions(instance, params);
    } else if (['text', 'email', 'number', 'tel', 'textarea'].some(function(i) {
      return i === params.input;
    }) && (hasToPromiseFn(params.inputValue) || isPromise(params.inputValue))) {
      showLoading(getConfirmButton());
      handleInputValue(instance, params);
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} innerParams
     * @return {SweetAlertInputValue}
     */
  const getInputValue = function getInputValue(instance, innerParams) {
    const input = instance.getInput();
    if (!input) {
      return null;
    }
    switch (innerParams.input) {
      case 'checkbox':
        return getCheckboxValue(input);
      case 'radio':
        return getRadioValue(input);
      case 'file':
        return getFileValue(input);
      default:
        return innerParams.inputAutoTrim ? input.value.trim() : input.value;
    }
  };

  /**
     * @param {HTMLInputElement} input
     * @return {number}
     */
  var getCheckboxValue = function getCheckboxValue(input) {
    return input.checked ? 1 : 0;
  };

  /**
     * @param {HTMLInputElement} input
     * @return {string | null}
     */
  var getRadioValue = function getRadioValue(input) {
    return input.checked ? input.value : null;
  };

  /**
     * @param {HTMLInputElement} input
     * @return {FileList | File | null}
     */
  var getFileValue = function getFileValue(input) {
    return input.files && input.files.length ? input.getAttribute('multiple') !== null ? input.files : input.files[0] : null;
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  var handleInputOptions = function handleInputOptions(instance, params) {
    const popup = getPopup();
    if (!popup) {
      return;
    }
    /**
       * @param {Record<string, any>} inputOptions
       */
    const processInputOptions = function processInputOptions(inputOptions) {
      if (params.input === 'select') {
        populateSelectOptions(popup, _formatInputOptions(inputOptions), params);
      } else if (params.input === 'radio') {
        populateRadioOptions(popup, _formatInputOptions(inputOptions), params);
      }
    };
    if (hasToPromiseFn(params.inputOptions) || isPromise(params.inputOptions)) {
      showLoading(getConfirmButton());
      asPromise(params.inputOptions).then(function(inputOptions) {
        instance.hideLoading();
        processInputOptions(inputOptions);
      });
    } else if (_typeof(params.inputOptions) === 'object') {
      processInputOptions(params.inputOptions);
    } else {
      error('Unexpected type of inputOptions! Expected object, Map or Promise, got '.concat(_typeof(params.inputOptions)));
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertOptions} params
     */
  var handleInputValue = function handleInputValue(instance, params) {
    const input = instance.getInput();
    if (!input) {
      return;
    }
    hide(input);
    asPromise(params.inputValue).then(function(inputValue) {
      input.value = params.input === 'number' ? ''.concat(parseFloat(inputValue) || 0) : ''.concat(inputValue);
      show(input);
      input.focus();
      instance.hideLoading();
    })['catch'](function(err) {
      error('Error in inputValue promise: '.concat(err));
      input.value = '';
      show(input);
      input.focus();
      instance.hideLoading();
    });
  };

  /**
     * @param {HTMLElement} popup
     * @param {InputOptionFlattened[]} inputOptions
     * @param {SweetAlertOptions} params
     */
  function populateSelectOptions(popup, inputOptions, params) {
    const select = getDirectChildByClass(popup, swalClasses.select);
    if (!select) {
      return;
    }
    /**
       * @param {HTMLElement} parent
       * @param {string} optionLabel
       * @param {string} optionValue
       */
    const renderOption = function renderOption(parent, optionLabel, optionValue) {
      const option = document.createElement('option');
      option.value = optionValue;
      setInnerHtml(option, optionLabel);
      option.selected = isSelected(optionValue, params.inputValue);
      parent.appendChild(option);
    };
    inputOptions.forEach(function(inputOption) {
      const optionValue = inputOption[0];
      const optionLabel = inputOption[1];
      // <optgroup> spec:
      // https://www.w3.org/TR/html401/interact/forms.html#h-17.6
      // "...all OPTGROUP elements must be specified directly within a SELECT element (i.e., groups may not be nested)..."
      // check whether this is a <optgroup>
      if (Array.isArray(optionLabel)) {
        // if it is an array, then it is an <optgroup>
        const optgroup = document.createElement('optgroup');
        optgroup.label = optionValue;
        optgroup.disabled = false; // not configurable for now
        select.appendChild(optgroup);
        optionLabel.forEach(function(o) {
          return renderOption(optgroup, o[1], o[0]);
        });
      } else {
        // case of <option>
        renderOption(select, optionLabel, optionValue);
      }
    });
    select.focus();
  }

  /**
     * @param {HTMLElement} popup
     * @param {InputOptionFlattened[]} inputOptions
     * @param {SweetAlertOptions} params
     */
  function populateRadioOptions(popup, inputOptions, params) {
    const radio = getDirectChildByClass(popup, swalClasses.radio);
    if (!radio) {
      return;
    }
    inputOptions.forEach(function(inputOption) {
      const radioValue = inputOption[0];
      const radioLabel = inputOption[1];
      const radioInput = document.createElement('input');
      const radioLabelElement = document.createElement('label');
      radioInput.type = 'radio';
      radioInput.name = swalClasses.radio;
      radioInput.value = radioValue;
      if (isSelected(radioValue, params.inputValue)) {
        radioInput.checked = true;
      }
      const label = document.createElement('span');
      setInnerHtml(label, radioLabel);
      label.className = swalClasses.label;
      radioLabelElement.appendChild(radioInput);
      radioLabelElement.appendChild(label);
      radio.appendChild(radioLabelElement);
    });
    const radios = radio.querySelectorAll('input');
    if (radios.length) {
      radios[0].focus();
    }
  }

  /**
     * Converts `inputOptions` into an array of `[value, label]`s
     *
     * @param {Record<string, any>} inputOptions
     * @typedef {string[]} InputOptionFlattened
     * @return {InputOptionFlattened[]}
     */
  var _formatInputOptions = function formatInputOptions(inputOptions) {
    /** @type {InputOptionFlattened[]} */
    const result = [];
    if (inputOptions instanceof Map) {
      inputOptions.forEach(function(value, key) {
        let valueFormatted = value;
        if (_typeof(valueFormatted) === 'object') {
          // case of <optgroup>
          valueFormatted = _formatInputOptions(valueFormatted);
        }
        result.push([key, valueFormatted]);
      });
    } else {
      Object.keys(inputOptions).forEach(function(key) {
        let valueFormatted = inputOptions[key];
        if (_typeof(valueFormatted) === 'object') {
          // case of <optgroup>
          valueFormatted = _formatInputOptions(valueFormatted);
        }
        result.push([key, valueFormatted]);
      });
    }
    return result;
  };

  /**
     * @param {string} optionValue
     * @param {SweetAlertInputValue} inputValue
     * @return {boolean}
     */
  var isSelected = function isSelected(optionValue, inputValue) {
    return !!inputValue && inputValue.toString() === optionValue.toString();
  };

  const _this = undefined;

  /**
     * @param {SweetAlert} instance
     */
  const handleConfirmButtonClick = function handleConfirmButtonClick(instance) {
    const innerParams = privateProps.innerParams.get(instance);
    instance.disableButtons();
    if (innerParams.input) {
      handleConfirmOrDenyWithInput(instance, 'confirm');
    } else {
      confirm(instance, true);
    }
  };

  /**
     * @param {SweetAlert} instance
     */
  const handleDenyButtonClick = function handleDenyButtonClick(instance) {
    const innerParams = privateProps.innerParams.get(instance);
    instance.disableButtons();
    if (innerParams.returnInputValueOnDeny) {
      handleConfirmOrDenyWithInput(instance, 'deny');
    } else {
      deny(instance, false);
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {Function} dismissWith
     */
  const handleCancelButtonClick = function handleCancelButtonClick(instance, dismissWith) {
    instance.disableButtons();
    dismissWith(DismissReason.cancel);
  };

  /**
     * @param {SweetAlert} instance
     * @param {'confirm' | 'deny'} type
     */
  var handleConfirmOrDenyWithInput = function handleConfirmOrDenyWithInput(instance, type) {
    const innerParams = privateProps.innerParams.get(instance);
    if (!innerParams.input) {
      error('The "input" parameter is needed to be set when using returnInputValueOn'.concat(capitalizeFirstLetter(type)));
      return;
    }
    const input = instance.getInput();
    const inputValue = getInputValue(instance, innerParams);
    if (innerParams.inputValidator) {
      handleInputValidator(instance, inputValue, type);
    } else if (input && !input.checkValidity()) {
      instance.enableButtons();
      instance.showValidationMessage(innerParams.validationMessage || input.validationMessage);
    } else if (type === 'deny') {
      deny(instance, inputValue);
    } else {
      confirm(instance, inputValue);
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {SweetAlertInputValue} inputValue
     * @param {'confirm' | 'deny'} type
     */
  var handleInputValidator = function handleInputValidator(instance, inputValue, type) {
    const innerParams = privateProps.innerParams.get(instance);
    instance.disableInput();
    const validationPromise = Promise.resolve().then(function() {
      return asPromise(innerParams.inputValidator(inputValue, innerParams.validationMessage));
    });
    validationPromise.then(function(validationMessage) {
      instance.enableButtons();
      instance.enableInput();
      if (validationMessage) {
        instance.showValidationMessage(validationMessage);
      } else if (type === 'deny') {
        deny(instance, inputValue);
      } else {
        confirm(instance, inputValue);
      }
    });
  };

  /**
     * @param {SweetAlert} instance
     * @param {any} value
     */
  var deny = function deny(instance, value) {
    const innerParams = privateProps.innerParams.get(instance || _this);
    if (innerParams.showLoaderOnDeny) {
      showLoading(getDenyButton());
    }
    if (innerParams.preDeny) {
      instance.isAwaitingPromise = true; // Flagging the instance as awaiting a promise so it's own promise's reject/resolve methods doesn't get destroyed until the result from this preDeny's promise is received
      const preDenyPromise = Promise.resolve().then(function() {
        return asPromise(innerParams.preDeny(value, innerParams.validationMessage));
      });
      preDenyPromise.then(function(preDenyValue) {
        if (preDenyValue === false) {
          instance.hideLoading();
          handleAwaitingPromise(instance);
        } else {
          instance.close({
            isDenied: true,
            value: typeof preDenyValue === 'undefined' ? value : preDenyValue,
          });
        }
      })['catch'](function(error) {
        return rejectWith(instance || _this, error);
      });
    } else {
      instance.close({
        isDenied: true,
        value: value,
      });
    }
  };

  /**
     * @param {SweetAlert} instance
     * @param {any} value
     */
  const succeedWith = function succeedWith(instance, value) {
    instance.close({
      isConfirmed: true,
      value: value,
    });
  };

  /**
     *
     * @param {SweetAlert} instance
     * @param {string} error
     */
  var rejectWith = function rejectWith(instance, error) {
    instance.rejectPromise(error);
  };

  /**
     *
     * @param {SweetAlert} instance
     * @param {any} value
     */
  var confirm = function confirm(instance, value) {
    const innerParams = privateProps.innerParams.get(instance || _this);
    if (innerParams.showLoaderOnConfirm) {
      showLoading();
    }
    if (innerParams.preConfirm) {
      instance.resetValidationMessage();
      instance.isAwaitingPromise = true; // Flagging the instance as awaiting a promise so it's own promise's reject/resolve methods doesn't get destroyed until the result from this preConfirm's promise is received
      const preConfirmPromise = Promise.resolve().then(function() {
        return asPromise(innerParams.preConfirm(value, innerParams.validationMessage));
      });
      preConfirmPromise.then(function(preConfirmValue) {
        if (isVisible$1(getValidationMessage()) || preConfirmValue === false) {
          instance.hideLoading();
          handleAwaitingPromise(instance);
        } else {
          succeedWith(instance, typeof preConfirmValue === 'undefined' ? value : preConfirmValue);
        }
      })['catch'](function(error) {
        return rejectWith(instance || _this, error);
      });
    } else {
      succeedWith(instance, value);
    }
  };

  /**
     * Hides loader and shows back the button which was hidden by .showLoading()
     */
  function hideLoading() {
    // do nothing if popup is closed
    const innerParams = privateProps.innerParams.get(this);
    if (!innerParams) {
      return;
    }
    const domCache = privateProps.domCache.get(this);
    hide(domCache.loader);
    if (isToast()) {
      if (innerParams.icon) {
        show(getIcon());
      }
    } else {
      showRelatedButton(domCache);
    }
    removeClass([domCache.popup, domCache.actions], swalClasses.loading);
    domCache.popup.removeAttribute('aria-busy');
    domCache.popup.removeAttribute('data-loading');
    domCache.confirmButton.disabled = false;
    domCache.denyButton.disabled = false;
    domCache.cancelButton.disabled = false;
  }
  var showRelatedButton = function showRelatedButton(domCache) {
    const buttonToReplace = domCache.popup.getElementsByClassName(domCache.loader.getAttribute('data-button-to-replace'));
    if (buttonToReplace.length) {
      show(buttonToReplace[0], 'inline-block');
    } else if (allButtonsAreHidden()) {
      hide(domCache.actions);
    }
  };

  /**
     * Gets the input DOM node, this method works with input parameter.
     *
     * @return {HTMLInputElement | null}
     */
  function getInput() {
    const innerParams = privateProps.innerParams.get(this);
    const domCache = privateProps.domCache.get(this);
    if (!domCache) {
      return null;
    }
    return getInput$1(domCache.popup, innerParams.input);
  }

  /**
     * @param {SweetAlert} instance
     * @param {string[]} buttons
     * @param {boolean} disabled
     */
  function setButtonsDisabled(instance, buttons, disabled) {
    const domCache = privateProps.domCache.get(instance);
    buttons.forEach(function(button) {
      domCache[button].disabled = disabled;
    });
  }

  /**
     * @param {HTMLInputElement | null} input
     * @param {boolean} disabled
     */
  function setInputDisabled(input, disabled) {
    const popup = getPopup();
    if (!popup || !input) {
      return;
    }
    if (input.type === 'radio') {
      /** @type {NodeListOf<HTMLInputElement>} */
      const radios = popup.querySelectorAll('[name="'.concat(swalClasses.radio, '"]'));
      for (let i = 0; i < radios.length; i++) {
        radios[i].disabled = disabled;
      }
    } else {
      input.disabled = disabled;
    }
  }

  /**
     * Enable all the buttons
     * @this {SweetAlert}
     */
  function enableButtons() {
    setButtonsDisabled(this, ['confirmButton', 'denyButton', 'cancelButton'], false);
  }

  /**
     * Disable all the buttons
     * @this {SweetAlert}
     */
  function disableButtons() {
    setButtonsDisabled(this, ['confirmButton', 'denyButton', 'cancelButton'], true);
  }

  /**
     * Enable the input field
     * @this {SweetAlert}
     */
  function enableInput() {
    setInputDisabled(this.getInput(), false);
  }

  /**
     * Disable the input field
     * @this {SweetAlert}
     */
  function disableInput() {
    setInputDisabled(this.getInput(), true);
  }

  /**
     * Show block with validation message
     *
     * @param {string} error
     * @this {SweetAlert}
     */
  function showValidationMessage(error) {
    const domCache = privateProps.domCache.get(this);
    const params = privateProps.innerParams.get(this);
    setInnerHtml(domCache.validationMessage, error);
    domCache.validationMessage.className = swalClasses['validation-message'];
    if (params.customClass && params.customClass.validationMessage) {
      addClass(domCache.validationMessage, params.customClass.validationMessage);
    }
    show(domCache.validationMessage);
    const input = this.getInput();
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', swalClasses['validation-message']);
      focusInput(input);
      addClass(input, swalClasses.inputerror);
    }
  }

  /**
     * Hide block with validation message
     *
     * @this {SweetAlert}
     */
  function resetValidationMessage() {
    const domCache = privateProps.domCache.get(this);
    if (domCache.validationMessage) {
      hide(domCache.validationMessage);
    }
    const input = this.getInput();
    if (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      removeClass(input, swalClasses.inputerror);
    }
  }

  const defaultParams = {
    title: '',
    titleText: '',
    text: '',
    html: '',
    footer: '',
    icon: undefined,
    iconColor: undefined,
    iconHtml: undefined,
    template: undefined,
    toast: false,
    animation: true,
    showClass: {
      popup: 'swal2-show',
      backdrop: 'swal2-backdrop-show',
      icon: 'swal2-icon-show',
    },
    hideClass: {
      popup: 'swal2-hide',
      backdrop: 'swal2-backdrop-hide',
      icon: 'swal2-icon-hide',
    },
    customClass: {},
    target: 'body',
    color: undefined,
    backdrop: true,
    heightAuto: true,
    allowOutsideClick: true,
    allowEscapeKey: true,
    allowEnterKey: true,
    stopKeydownPropagation: true,
    keydownListenerCapture: false,
    showConfirmButton: true,
    showDenyButton: false,
    showCancelButton: false,
    preConfirm: undefined,
    preDeny: undefined,
    confirmButtonText: 'OK',
    confirmButtonAriaLabel: '',
    confirmButtonColor: undefined,
    denyButtonText: 'No',
    denyButtonAriaLabel: '',
    denyButtonColor: undefined,
    cancelButtonText: 'Cancel',
    cancelButtonAriaLabel: '',
    cancelButtonColor: undefined,
    buttonsStyling: true,
    reverseButtons: false,
    focusConfirm: true,
    focusDeny: false,
    focusCancel: false,
    returnFocus: true,
    showCloseButton: false,
    closeButtonHtml: '&times;',
    closeButtonAriaLabel: 'Close this dialog',
    loaderHtml: '',
    showLoaderOnConfirm: false,
    showLoaderOnDeny: false,
    imageUrl: undefined,
    imageWidth: undefined,
    imageHeight: undefined,
    imageAlt: '',
    timer: undefined,
    timerProgressBar: false,
    width: undefined,
    padding: undefined,
    background: undefined,
    input: undefined,
    inputPlaceholder: '',
    inputLabel: '',
    inputValue: '',
    inputOptions: {},
    inputAutoFocus: true,
    inputAutoTrim: true,
    inputAttributes: {},
    inputValidator: undefined,
    returnInputValueOnDeny: false,
    validationMessage: undefined,
    grow: false,
    position: 'center',
    progressSteps: [],
    currentProgressStep: undefined,
    progressStepsDistance: undefined,
    willOpen: undefined,
    didOpen: undefined,
    didRender: undefined,
    willClose: undefined,
    didClose: undefined,
    didDestroy: undefined,
    scrollbarPadding: true,
  };
  const updatableParams = ['allowEscapeKey', 'allowOutsideClick', 'background', 'buttonsStyling', 'cancelButtonAriaLabel', 'cancelButtonColor', 'cancelButtonText', 'closeButtonAriaLabel', 'closeButtonHtml', 'color', 'confirmButtonAriaLabel', 'confirmButtonColor', 'confirmButtonText', 'currentProgressStep', 'customClass', 'denyButtonAriaLabel', 'denyButtonColor', 'denyButtonText', 'didClose', 'didDestroy', 'footer', 'hideClass', 'html', 'icon', 'iconColor', 'iconHtml', 'imageAlt', 'imageHeight', 'imageUrl', 'imageWidth', 'preConfirm', 'preDeny', 'progressSteps', 'returnFocus', 'reverseButtons', 'showCancelButton', 'showCloseButton', 'showConfirmButton', 'showDenyButton', 'text', 'title', 'titleText', 'willClose'];

  /** @type {Record<string, string | undefined>} */
  const deprecatedParams = {
    allowEnterKey: undefined,
  };
  const toastIncompatibleParams = ['allowOutsideClick', 'allowEnterKey', 'backdrop', 'focusConfirm', 'focusDeny', 'focusCancel', 'returnFocus', 'heightAuto', 'keydownListenerCapture'];

  /**
     * Is valid parameter
     *
     * @param {string} paramName
     * @return {boolean}
     */
  const isValidParameter = function isValidParameter(paramName) {
    return Object.prototype.hasOwnProperty.call(defaultParams, paramName);
  };

  /**
     * Is valid parameter for Swal.update() method
     *
     * @param {string} paramName
     * @return {boolean}
     */
  const isUpdatableParameter = function isUpdatableParameter(paramName) {
    return updatableParams.indexOf(paramName) !== -1;
  };

  /**
     * Is deprecated parameter
     *
     * @param {string} paramName
     * @return {string | undefined}
     */
  const isDeprecatedParameter = function isDeprecatedParameter(paramName) {
    return deprecatedParams[paramName];
  };

  /**
     * @param {string} param
     */
  const checkIfParamIsValid = function checkIfParamIsValid(param) {
    if (!isValidParameter(param)) {
      warn('Unknown parameter "'.concat(param, '"'));
    }
  };

  /**
     * @param {string} param
     */
  const checkIfToastParamIsValid = function checkIfToastParamIsValid(param) {
    if (toastIncompatibleParams.includes(param)) {
      warn('The parameter "'.concat(param, '" is incompatible with toasts'));
    }
  };

  /**
     * @param {string} param
     */
  const checkIfParamIsDeprecated = function checkIfParamIsDeprecated(param) {
    const isDeprecated = isDeprecatedParameter(param);
    if (isDeprecated) {
      warnAboutDeprecation(param, isDeprecated);
    }
  };

  /**
     * Show relevant warnings for given params
     *
     * @param {SweetAlertOptions} params
     */
  const showWarningsForParams = function showWarningsForParams(params) {
    if (params.backdrop === false && params.allowOutsideClick) {
      warn('"allowOutsideClick" parameter requires `backdrop` parameter to be set to `true`');
    }
    for (const param in params) {
      checkIfParamIsValid(param);
      if (params.toast) {
        checkIfToastParamIsValid(param);
      }
      checkIfParamIsDeprecated(param);
    }
  };

  /**
     * Updates popup parameters.
     *
     * @param {SweetAlertOptions} params
     */
  function update(params) {
    const popup = getPopup();
    const innerParams = privateProps.innerParams.get(this);
    if (!popup || hasClass(popup, innerParams.hideClass.popup)) {
      warn('You\'re trying to update the closed or closing popup, that won\'t work. Use the update() method in preConfirm parameter or show a new popup.');
      return;
    }
    const validUpdatableParams = filterValidParams(params);
    const updatedParams = Object.assign({}, innerParams, validUpdatableParams);
    render(this, updatedParams);
    privateProps.innerParams.set(this, updatedParams);
    Object.defineProperties(this, {
      params: {
        value: Object.assign({}, this.params, params),
        writable: false,
        enumerable: true,
      },
    });
  }

  /**
     * @param {SweetAlertOptions} params
     * @return {SweetAlertOptions}
     */
  var filterValidParams = function filterValidParams(params) {
    const validUpdatableParams = {};
    Object.keys(params).forEach(function(param) {
      if (isUpdatableParameter(param)) {
        validUpdatableParams[param] = params[param];
      } else {
        warn('Invalid parameter to update: '.concat(param));
      }
    });
    return validUpdatableParams;
  };

  /**
     * Dispose the current SweetAlert2 instance
     */
  function _destroy() {
    const domCache = privateProps.domCache.get(this);
    const innerParams = privateProps.innerParams.get(this);
    if (!innerParams) {
      disposeWeakMaps(this); // The WeakMaps might have been partly destroyed, we must recall it to dispose any remaining WeakMaps #2335
      return; // This instance has already been destroyed
    }

    // Check if there is another Swal closing
    if (domCache.popup && globalState.swalCloseEventFinishedCallback) {
      globalState.swalCloseEventFinishedCallback();
      delete globalState.swalCloseEventFinishedCallback;
    }
    if (typeof innerParams.didDestroy === 'function') {
      innerParams.didDestroy();
    }
    disposeSwal(this);
  }

  /**
     * @param {SweetAlert} instance
     */
  var disposeSwal = function disposeSwal(instance) {
    disposeWeakMaps(instance);
    // Unset this.params so GC will dispose it (#1569)
    delete instance.params;
    // Unset globalState props so GC will dispose globalState (#1569)
    delete globalState.keydownHandler;
    delete globalState.keydownTarget;
    // Unset currentInstance
    delete globalState.currentInstance;
  };

  /**
     * @param {SweetAlert} instance
     */
  var disposeWeakMaps = function disposeWeakMaps(instance) {
    // If the current instance is awaiting a promise result, we keep the privateMethods to call them once the promise result is retrieved #2335
    if (instance.isAwaitingPromise) {
      unsetWeakMaps(privateProps, instance);
      instance.isAwaitingPromise = true;
    } else {
      unsetWeakMaps(privateMethods, instance);
      unsetWeakMaps(privateProps, instance);
      delete instance.isAwaitingPromise;
      // Unset instance methods
      delete instance.disableButtons;
      delete instance.enableButtons;
      delete instance.getInput;
      delete instance.disableInput;
      delete instance.enableInput;
      delete instance.hideLoading;
      delete instance.disableLoading;
      delete instance.showValidationMessage;
      delete instance.resetValidationMessage;
      delete instance.close;
      delete instance.closePopup;
      delete instance.closeModal;
      delete instance.closeToast;
      delete instance.rejectPromise;
      delete instance.update;
      delete instance._destroy;
    }
  };

  /**
     * @param {object} obj
     * @param {SweetAlert} instance
     */
  var unsetWeakMaps = function unsetWeakMaps(obj, instance) {
    for (const i in obj) {
      obj[i]['delete'](instance);
    }
  };

  const instanceMethods = /* #__PURE__*/Object.freeze({
    __proto__: null,
    _destroy: _destroy,
    close: close,
    closeModal: close,
    closePopup: close,
    closeToast: close,
    disableButtons: disableButtons,
    disableInput: disableInput,
    disableLoading: hideLoading,
    enableButtons: enableButtons,
    enableInput: enableInput,
    getInput: getInput,
    handleAwaitingPromise: handleAwaitingPromise,
    hideLoading: hideLoading,
    rejectPromise: rejectPromise,
    resetValidationMessage: resetValidationMessage,
    showValidationMessage: showValidationMessage,
    update: update,
  });

  /**
     * @param {SweetAlertOptions} innerParams
     * @param {DomCache} domCache
     * @param {Function} dismissWith
     */
  const handlePopupClick = function handlePopupClick(innerParams, domCache, dismissWith) {
    if (innerParams.toast) {
      handleToastClick(innerParams, domCache, dismissWith);
    } else {
      // Ignore click events that had mousedown on the popup but mouseup on the container
      // This can happen when the user drags a slider
      handleModalMousedown(domCache);

      // Ignore click events that had mousedown on the container but mouseup on the popup
      handleContainerMousedown(domCache);
      handleModalClick(innerParams, domCache, dismissWith);
    }
  };

  /**
     * @param {SweetAlertOptions} innerParams
     * @param {DomCache} domCache
     * @param {Function} dismissWith
     */
  var handleToastClick = function handleToastClick(innerParams, domCache, dismissWith) {
    // Closing toast by internal click
    domCache.popup.onclick = function() {
      if (innerParams && (isAnyButtonShown(innerParams) || innerParams.timer || innerParams.input)) {
        return;
      }
      dismissWith(DismissReason.close);
    };
  };

  /**
     * @param {SweetAlertOptions} innerParams
     * @return {boolean}
     */
  var isAnyButtonShown = function isAnyButtonShown(innerParams) {
    return !!(innerParams.showConfirmButton || innerParams.showDenyButton || innerParams.showCancelButton || innerParams.showCloseButton);
  };
  let ignoreOutsideClick = false;

  /**
     * @param {DomCache} domCache
     */
  var handleModalMousedown = function handleModalMousedown(domCache) {
    domCache.popup.onmousedown = function() {
      domCache.container.onmouseup = function(e) {
        domCache.container.onmouseup = function() {};
        // We only check if the mouseup target is the container because usually it doesn't
        // have any other direct children aside of the popup
        if (e.target === domCache.container) {
          ignoreOutsideClick = true;
        }
      };
    };
  };

  /**
     * @param {DomCache} domCache
     */
  var handleContainerMousedown = function handleContainerMousedown(domCache) {
    domCache.container.onmousedown = function(e) {
      // prevent the modal text from being selected on double click on the container (allowOutsideClick: false)
      if (e.target === domCache.container) {
        e.preventDefault();
      }
      domCache.popup.onmouseup = function(e) {
        domCache.popup.onmouseup = function() {};
        // We also need to check if the mouseup target is a child of the popup
        if (e.target === domCache.popup || e.target instanceof HTMLElement && domCache.popup.contains(e.target)) {
          ignoreOutsideClick = true;
        }
      };
    };
  };

  /**
     * @param {SweetAlertOptions} innerParams
     * @param {DomCache} domCache
     * @param {Function} dismissWith
     */
  var handleModalClick = function handleModalClick(innerParams, domCache, dismissWith) {
    domCache.container.onclick = function(e) {
      if (ignoreOutsideClick) {
        ignoreOutsideClick = false;
        return;
      }
      if (e.target === domCache.container && callIfFunction(innerParams.allowOutsideClick)) {
        dismissWith(DismissReason.backdrop);
      }
    };
  };

  const isJqueryElement = function isJqueryElement(elem) {
    return _typeof(elem) === 'object' && elem.jquery;
  };
  const isElement = function isElement(elem) {
    return elem instanceof Element || isJqueryElement(elem);
  };
  const argsToParams = function argsToParams(args) {
    const params = {};
    if (_typeof(args[0]) === 'object' && !isElement(args[0])) {
      Object.assign(params, args[0]);
    } else {
      ['title', 'html', 'icon'].forEach(function(name, index) {
        const arg = args[index];
        if (typeof arg === 'string' || isElement(arg)) {
          params[name] = arg;
        } else if (arg !== undefined) {
          error('Unexpected type of '.concat(name, '! Expected "string" or "Element", got ').concat(_typeof(arg)));
        }
      });
    }
    return params;
  };

  /**
     * Main method to create a new SweetAlert2 popup
     *
     * @param  {...SweetAlertOptions} args
     * @return {Promise<SweetAlertResult>}
     */
  function fire() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return _construct(this, args);
  }

  /**
     * Returns an extended version of `Swal` containing `params` as defaults.
     * Useful for reusing Swal configuration.
     *
     * For example:
     *
     * Before:
     * const textPromptOptions = { input: 'text', showCancelButton: true }
     * const {value: firstName} = await Swal.fire({ ...textPromptOptions, title: 'What is your first name?' })
     * const {value: lastName} = await Swal.fire({ ...textPromptOptions, title: 'What is your last name?' })
     *
     * After:
     * const TextPrompt = Swal.mixin({ input: 'text', showCancelButton: true })
     * const {value: firstName} = await TextPrompt('What is your first name?')
     * const {value: lastName} = await TextPrompt('What is your last name?')
     *
     * @param {SweetAlertOptions} mixinParams
     * @return {SweetAlert}
     */
  function mixin(mixinParams) {
    const MixinSwal = /* #__PURE__*/function(_this) {
      function MixinSwal() {
        _classCallCheck(this, MixinSwal);
        return _callSuper(this, MixinSwal, arguments);
      }
      _inherits(MixinSwal, _this);
      return _createClass(MixinSwal, [{
        key: '_main',
        value: function _main(params, priorityMixinParams) {
          return _superPropGet(MixinSwal, '_main', this)([params, Object.assign({}, mixinParams, priorityMixinParams)]);
        },
      }]);
    }(this); // @ts-ignore
    return MixinSwal;
  }

  /**
     * If `timer` parameter is set, returns number of milliseconds of timer remained.
     * Otherwise, returns undefined.
     *
     * @return {number | undefined}
     */
  const getTimerLeft = function getTimerLeft() {
    return globalState.timeout && globalState.timeout.getTimerLeft();
  };

  /**
     * Stop timer. Returns number of milliseconds of timer remained.
     * If `timer` parameter isn't set, returns undefined.
     *
     * @return {number | undefined}
     */
  const stopTimer = function stopTimer() {
    if (globalState.timeout) {
      stopTimerProgressBar();
      return globalState.timeout.stop();
    }
  };

  /**
     * Resume timer. Returns number of milliseconds of timer remained.
     * If `timer` parameter isn't set, returns undefined.
     *
     * @return {number | undefined}
     */
  const resumeTimer = function resumeTimer() {
    if (globalState.timeout) {
      const remaining = globalState.timeout.start();
      animateTimerProgressBar(remaining);
      return remaining;
    }
  };

  /**
     * Resume timer. Returns number of milliseconds of timer remained.
     * If `timer` parameter isn't set, returns undefined.
     *
     * @return {number | undefined}
     */
  const toggleTimer = function toggleTimer() {
    const timer = globalState.timeout;
    return timer && (timer.running ? stopTimer() : resumeTimer());
  };

  /**
     * Increase timer. Returns number of milliseconds of an updated timer.
     * If `timer` parameter isn't set, returns undefined.
     *
     * @param {number} ms
     * @return {number | undefined}
     */
  const increaseTimer = function increaseTimer(ms) {
    if (globalState.timeout) {
      const remaining = globalState.timeout.increase(ms);
      animateTimerProgressBar(remaining, true);
      return remaining;
    }
  };

  /**
     * Check if timer is running. Returns true if timer is running
     * or false if timer is paused or stopped.
     * If `timer` parameter isn't set, returns undefined
     *
     * @return {boolean}
     */
  const isTimerRunning = function isTimerRunning() {
    return !!(globalState.timeout && globalState.timeout.isRunning());
  };

  let bodyClickListenerAdded = false;
  const clickHandlers = {};

  /**
     * @param {string} attr
     */
  function bindClickHandler() {
    const attr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'data-swal-template';
    clickHandlers[attr] = this;
    if (!bodyClickListenerAdded) {
      document.body.addEventListener('click', bodyClickListener);
      bodyClickListenerAdded = true;
    }
  }
  var bodyClickListener = function bodyClickListener(event) {
    for (let el = event.target; el && el !== document; el = el.parentNode) {
      for (const attr in clickHandlers) {
        const template = el.getAttribute(attr);
        if (template) {
          clickHandlers[attr].fire({
            template: template,
          });
          return;
        }
      }
    }
  };

  const staticMethods = /* #__PURE__*/Object.freeze({
    __proto__: null,
    argsToParams: argsToParams,
    bindClickHandler: bindClickHandler,
    clickCancel: clickCancel,
    clickConfirm: clickConfirm,
    clickDeny: clickDeny,
    enableLoading: showLoading,
    fire: fire,
    getActions: getActions,
    getCancelButton: getCancelButton,
    getCloseButton: getCloseButton,
    getConfirmButton: getConfirmButton,
    getContainer: getContainer,
    getDenyButton: getDenyButton,
    getFocusableElements: getFocusableElements,
    getFooter: getFooter,
    getHtmlContainer: getHtmlContainer,
    getIcon: getIcon,
    getIconContent: getIconContent,
    getImage: getImage,
    getInputLabel: getInputLabel,
    getLoader: getLoader,
    getPopup: getPopup,
    getProgressSteps: getProgressSteps,
    getTimerLeft: getTimerLeft,
    getTimerProgressBar: getTimerProgressBar,
    getTitle: getTitle,
    getValidationMessage: getValidationMessage,
    increaseTimer: increaseTimer,
    isDeprecatedParameter: isDeprecatedParameter,
    isLoading: isLoading,
    isTimerRunning: isTimerRunning,
    isUpdatableParameter: isUpdatableParameter,
    isValidParameter: isValidParameter,
    isVisible: isVisible,
    mixin: mixin,
    resumeTimer: resumeTimer,
    showLoading: showLoading,
    stopTimer: stopTimer,
    toggleTimer: toggleTimer,
  });

  const Timer = /* #__PURE__*/function() {
    /**
       * @param {Function} callback
       * @param {number} delay
       */
    function Timer(callback, delay) {
      _classCallCheck(this, Timer);
      this.callback = callback;
      this.remaining = delay;
      this.running = false;
      this.start();
    }

    /**
       * @returns {number}
       */
    return _createClass(Timer, [{
      key: 'start',
      value: function start() {
        if (!this.running) {
          this.running = true;
          this.started = new Date();
          this.id = setTimeout(this.callback, this.remaining);
        }
        return this.remaining;
      },

      /**
         * @returns {number}
         */
    }, {
      key: 'stop',
      value: function stop() {
        if (this.started && this.running) {
          this.running = false;
          clearTimeout(this.id);
          this.remaining -= new Date().getTime() - this.started.getTime();
        }
        return this.remaining;
      },

      /**
         * @param {number} n
         * @returns {number}
         */
    }, {
      key: 'increase',
      value: function increase(n) {
        const running = this.running;
        if (running) {
          this.stop();
        }
        this.remaining += n;
        if (running) {
          this.start();
        }
        return this.remaining;
      },

      /**
         * @returns {number}
         */
    }, {
      key: 'getTimerLeft',
      value: function getTimerLeft() {
        if (this.running) {
          this.stop();
          this.start();
        }
        return this.remaining;
      },

      /**
         * @returns {boolean}
         */
    }, {
      key: 'isRunning',
      value: function isRunning() {
        return this.running;
      },
    }]);
  }();

  const swalStringParams = ['swal-title', 'swal-html', 'swal-footer'];

  /**
     * @param {SweetAlertOptions} params
     * @return {SweetAlertOptions}
     */
  const getTemplateParams = function getTemplateParams(params) {
    const template = typeof params.template === 'string' ? ( /** @type {HTMLTemplateElement} */document.querySelector(params.template)) : params.template;
    if (!template) {
      return {};
    }
    /** @type {DocumentFragment} */
    const templateContent = template.content;
    showWarningsForElements(templateContent);
    const result = Object.assign(getSwalParams(templateContent), getSwalFunctionParams(templateContent), getSwalButtons(templateContent), getSwalImage(templateContent), getSwalIcon(templateContent), getSwalInput(templateContent), getSwalStringParams(templateContent, swalStringParams));
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Record<string, any>}
     */
  var getSwalParams = function getSwalParams(templateContent) {
    /** @type {Record<string, any>} */
    const result = {};
    /** @type {HTMLElement[]} */
    const swalParams = Array.from(templateContent.querySelectorAll('swal-param'));
    swalParams.forEach(function(param) {
      showWarningsForAttributes(param, ['name', 'value']);
      const paramName = /** @type {keyof SweetAlertOptions} */param.getAttribute('name');
      const value = param.getAttribute('value');
      if (!paramName || !value) {
        return;
      }
      if (typeof defaultParams[paramName] === 'boolean') {
        result[paramName] = value !== 'false';
      } else if (_typeof(defaultParams[paramName]) === 'object') {
        result[paramName] = JSON.parse(value);
      } else {
        result[paramName] = value;
      }
    });
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Record<string, any>}
     */
  var getSwalFunctionParams = function getSwalFunctionParams(templateContent) {
    /** @type {Record<string, any>} */
    const result = {};
    /** @type {HTMLElement[]} */
    const swalFunctions = Array.from(templateContent.querySelectorAll('swal-function-param'));
    swalFunctions.forEach(function(param) {
      const paramName = /** @type {keyof SweetAlertOptions} */param.getAttribute('name');
      const value = param.getAttribute('value');
      if (!paramName || !value) {
        return;
      }
      result[paramName] = new Function('return '.concat(value))();
    });
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Record<string, any>}
     */
  var getSwalButtons = function getSwalButtons(templateContent) {
    /** @type {Record<string, any>} */
    const result = {};
    /** @type {HTMLElement[]} */
    const swalButtons = Array.from(templateContent.querySelectorAll('swal-button'));
    swalButtons.forEach(function(button) {
      showWarningsForAttributes(button, ['type', 'color', 'aria-label']);
      const type = button.getAttribute('type');
      if (!type || !['confirm', 'cancel', 'deny'].includes(type)) {
        return;
      }
      result[''.concat(type, 'ButtonText')] = button.innerHTML;
      result['show'.concat(capitalizeFirstLetter(type), 'Button')] = true;
      if (button.hasAttribute('color')) {
        result[''.concat(type, 'ButtonColor')] = button.getAttribute('color');
      }
      if (button.hasAttribute('aria-label')) {
        result[''.concat(type, 'ButtonAriaLabel')] = button.getAttribute('aria-label');
      }
    });
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Pick<SweetAlertOptions, 'imageUrl' | 'imageWidth' | 'imageHeight' | 'imageAlt'>}
     */
  var getSwalImage = function getSwalImage(templateContent) {
    const result = {};
    /** @type {HTMLElement | null} */
    const image = templateContent.querySelector('swal-image');
    if (image) {
      showWarningsForAttributes(image, ['src', 'width', 'height', 'alt']);
      if (image.hasAttribute('src')) {
        result.imageUrl = image.getAttribute('src') || undefined;
      }
      if (image.hasAttribute('width')) {
        result.imageWidth = image.getAttribute('width') || undefined;
      }
      if (image.hasAttribute('height')) {
        result.imageHeight = image.getAttribute('height') || undefined;
      }
      if (image.hasAttribute('alt')) {
        result.imageAlt = image.getAttribute('alt') || undefined;
      }
    }
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Record<string, any>}
     */
  var getSwalIcon = function getSwalIcon(templateContent) {
    const result = {};
    /** @type {HTMLElement | null} */
    const icon = templateContent.querySelector('swal-icon');
    if (icon) {
      showWarningsForAttributes(icon, ['type', 'color']);
      if (icon.hasAttribute('type')) {
        result.icon = icon.getAttribute('type');
      }
      if (icon.hasAttribute('color')) {
        result.iconColor = icon.getAttribute('color');
      }
      result.iconHtml = icon.innerHTML;
    }
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @return {Record<string, any>}
     */
  var getSwalInput = function getSwalInput(templateContent) {
    /** @type {Record<string, any>} */
    const result = {};
    /** @type {HTMLElement | null} */
    const input = templateContent.querySelector('swal-input');
    if (input) {
      showWarningsForAttributes(input, ['type', 'label', 'placeholder', 'value']);
      result.input = input.getAttribute('type') || 'text';
      if (input.hasAttribute('label')) {
        result.inputLabel = input.getAttribute('label');
      }
      if (input.hasAttribute('placeholder')) {
        result.inputPlaceholder = input.getAttribute('placeholder');
      }
      if (input.hasAttribute('value')) {
        result.inputValue = input.getAttribute('value');
      }
    }
    /** @type {HTMLElement[]} */
    const inputOptions = Array.from(templateContent.querySelectorAll('swal-input-option'));
    if (inputOptions.length) {
      result.inputOptions = {};
      inputOptions.forEach(function(option) {
        showWarningsForAttributes(option, ['value']);
        const optionValue = option.getAttribute('value');
        if (!optionValue) {
          return;
        }
        const optionName = option.innerHTML;
        result.inputOptions[optionValue] = optionName;
      });
    }
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     * @param {string[]} paramNames
     * @return {Record<string, any>}
     */
  var getSwalStringParams = function getSwalStringParams(templateContent, paramNames) {
    /** @type {Record<string, any>} */
    const result = {};
    for (const i in paramNames) {
      const paramName = paramNames[i];
      /** @type {HTMLElement | null} */
      const tag = templateContent.querySelector(paramName);
      if (tag) {
        showWarningsForAttributes(tag, []);
        result[paramName.replace(/^swal-/, '')] = tag.innerHTML.trim();
      }
    }
    return result;
  };

  /**
     * @param {DocumentFragment} templateContent
     */
  var showWarningsForElements = function showWarningsForElements(templateContent) {
    const allowedElements = swalStringParams.concat(['swal-param', 'swal-function-param', 'swal-button', 'swal-image', 'swal-icon', 'swal-input', 'swal-input-option']);
    Array.from(templateContent.children).forEach(function(el) {
      const tagName = el.tagName.toLowerCase();
      if (!allowedElements.includes(tagName)) {
        warn('Unrecognized element <'.concat(tagName, '>'));
      }
    });
  };

  /**
     * @param {HTMLElement} el
     * @param {string[]} allowedAttributes
     */
  var showWarningsForAttributes = function showWarningsForAttributes(el, allowedAttributes) {
    Array.from(el.attributes).forEach(function(attribute) {
      if (allowedAttributes.indexOf(attribute.name) === -1) {
        warn(['Unrecognized attribute "'.concat(attribute.name, '" on <').concat(el.tagName.toLowerCase(), '>.'), ''.concat(allowedAttributes.length ? 'Allowed attributes are: '.concat(allowedAttributes.join(', ')) : 'To set the value, use HTML within the element.')]);
      }
    });
  };

  const SHOW_CLASS_TIMEOUT = 10;

  /**
     * Open popup, add necessary classes and styles, fix scrollbar
     *
     * @param {SweetAlertOptions} params
     */
  const openPopup = function openPopup(params) {
    const container = getContainer();
    const popup = getPopup();
    if (typeof params.willOpen === 'function') {
      params.willOpen(popup);
    }
    const bodyStyles = window.getComputedStyle(document.body);
    const initialBodyOverflow = bodyStyles.overflowY;
    addClasses(container, popup, params);

    // scrolling is 'hidden' until animation is done, after that 'auto'
    setTimeout(function() {
      setScrollingVisibility(container, popup);
    }, SHOW_CLASS_TIMEOUT);
    if (isModal()) {
      fixScrollContainer(container, params.scrollbarPadding, initialBodyOverflow);
      setAriaHidden();
    }
    if (!isToast() && !globalState.previousActiveElement) {
      globalState.previousActiveElement = document.activeElement;
    }
    if (typeof params.didOpen === 'function') {
      setTimeout(function() {
        return params.didOpen(popup);
      });
    }
    removeClass(container, swalClasses['no-transition']);
  };

  /**
     * @param {AnimationEvent} event
     */
  const _swalOpenAnimationFinished = function swalOpenAnimationFinished(event) {
    const popup = getPopup();
    if (event.target !== popup || !animationEndEvent) {
      return;
    }
    const container = getContainer();
    popup.removeEventListener(animationEndEvent, _swalOpenAnimationFinished);
    container.style.overflowY = 'auto';
  };

  /**
     * @param {HTMLElement} container
     * @param {HTMLElement} popup
     */
  var setScrollingVisibility = function setScrollingVisibility(container, popup) {
    if (animationEndEvent && hasCssAnimation(popup)) {
      container.style.overflowY = 'hidden';
      popup.addEventListener(animationEndEvent, _swalOpenAnimationFinished);
    } else {
      container.style.overflowY = 'auto';
    }
  };

  /**
     * @param {HTMLElement} container
     * @param {boolean} scrollbarPadding
     * @param {string} initialBodyOverflow
     */
  var fixScrollContainer = function fixScrollContainer(container, scrollbarPadding, initialBodyOverflow) {
    iOSfix();
    if (scrollbarPadding && initialBodyOverflow !== 'hidden') {
      replaceScrollbarWithPadding(initialBodyOverflow);
    }

    // sweetalert2/issues/1247
    setTimeout(function() {
      container.scrollTop = 0;
    });
  };

  /**
     * @param {HTMLElement} container
     * @param {HTMLElement} popup
     * @param {SweetAlertOptions} params
     */
  var addClasses = function addClasses(container, popup, params) {
    addClass(container, params.showClass.backdrop);
    if (params.animation) {
      // this workaround with opacity is needed for https://github.com/sweetalert2/sweetalert2/issues/2059
      popup.style.setProperty('opacity', '0', 'important');
      show(popup, 'grid');
      setTimeout(function() {
        // Animate popup right after showing it
        addClass(popup, params.showClass.popup);
        // and remove the opacity workaround
        popup.style.removeProperty('opacity');
      }, SHOW_CLASS_TIMEOUT); // 10ms in order to fix #2062
    } else {
      show(popup, 'grid');
    }
    addClass([document.documentElement, document.body], swalClasses.shown);
    if (params.heightAuto && params.backdrop && !params.toast) {
      addClass([document.documentElement, document.body], swalClasses['height-auto']);
    }
  };

  const defaultInputValidators = {
    /**
       * @param {string} string
       * @param {string} [validationMessage]
       * @return {Promise<string | void>}
       */
    email: function email(string, validationMessage) {
      return /^[a-zA-Z0-9.+_'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9-]+$/.test(string) ? Promise.resolve() : Promise.resolve(validationMessage || 'Invalid email address');
    },
    /**
       * @param {string} string
       * @param {string} [validationMessage]
       * @return {Promise<string | void>}
       */
    url: function url(string, validationMessage) {
      // taken from https://stackoverflow.com/a/3809435 with a small change from #1306 and #2013
      return /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,63}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)$/.test(string) ? Promise.resolve() : Promise.resolve(validationMessage || 'Invalid URL');
    },
  };

  /**
     * @param {SweetAlertOptions} params
     */
  function setDefaultInputValidators(params) {
    // Use default `inputValidator` for supported input types if not provided
    if (params.inputValidator) {
      return;
    }
    if (params.input === 'email') {
      params.inputValidator = defaultInputValidators['email'];
    }
    if (params.input === 'url') {
      params.inputValidator = defaultInputValidators['url'];
    }
  }

  /**
     * @param {SweetAlertOptions} params
     */
  function validateCustomTargetElement(params) {
    // Determine if the custom target element is valid
    if (!params.target || typeof params.target === 'string' && !document.querySelector(params.target) || typeof params.target !== 'string' && !params.target.appendChild) {
      warn('Target parameter is not valid, defaulting to "body"');
      params.target = 'body';
    }
  }

  /**
     * Set type, text and actions on popup
     *
     * @param {SweetAlertOptions} params
     */
  function setParameters(params) {
    setDefaultInputValidators(params);

    // showLoaderOnConfirm && preConfirm
    if (params.showLoaderOnConfirm && !params.preConfirm) {
      warn('showLoaderOnConfirm is set to true, but preConfirm is not defined.\n' + 'showLoaderOnConfirm should be used together with preConfirm, see usage example:\n' + 'https://sweetalert2.github.io/#ajax-request');
    }
    validateCustomTargetElement(params);

    // Replace newlines with <br> in title
    if (typeof params.title === 'string') {
      params.title = params.title.split('\n').join('<br />');
    }
    init(params);
  }

  /** @type {SweetAlert} */
  let currentInstance;
  const _promise = /* #__PURE__*/new WeakMap();
  const SweetAlert = /* #__PURE__*/function() {
    /**
       * @param {...any} args
       * @this {SweetAlert}
       */
    function SweetAlert() {
      _classCallCheck(this, SweetAlert);
      /**
         * @type {Promise<SweetAlertResult>}
         */
      _classPrivateFieldInitSpec(this, _promise, void 0);
      // Prevent run in Node env
      if (typeof window === 'undefined') {
        return;
      }
      currentInstance = this;

      // @ts-ignore
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      const outerParams = Object.freeze(this.constructor.argsToParams(args));

      /** @type {Readonly<SweetAlertOptions>} */
      this.params = outerParams;

      /** @type {boolean} */
      this.isAwaitingPromise = false;
      _classPrivateFieldSet2(_promise, this, this._main(currentInstance.params));
    }
    return _createClass(SweetAlert, [{
      key: '_main',
      value: function _main(userParams) {
        const mixinParams = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        showWarningsForParams(Object.assign({}, mixinParams, userParams));
        if (globalState.currentInstance) {
          const swalPromiseResolve = privateMethods.swalPromiseResolve.get(globalState.currentInstance);
          const isAwaitingPromise = globalState.currentInstance.isAwaitingPromise;
          globalState.currentInstance._destroy();
          if (!isAwaitingPromise) {
            swalPromiseResolve({
              isDismissed: true,
            });
          }
          if (isModal()) {
            unsetAriaHidden();
          }
        }
        globalState.currentInstance = currentInstance;
        const innerParams = prepareParams(userParams, mixinParams);
        setParameters(innerParams);
        Object.freeze(innerParams);

        // clear the previous timer
        if (globalState.timeout) {
          globalState.timeout.stop();
          delete globalState.timeout;
        }

        // clear the restore focus timeout
        clearTimeout(globalState.restoreFocusTimeout);
        const domCache = populateDomCache(currentInstance);
        render(currentInstance, innerParams);
        privateProps.innerParams.set(currentInstance, innerParams);
        return swalPromise(currentInstance, domCache, innerParams);
      },

      // `catch` cannot be the name of a module export, so we define our thenable methods here instead
    }, {
      key: 'then',
      value: function then(onFulfilled) {
        return _classPrivateFieldGet2(_promise, this).then(onFulfilled);
      },
    }, {
      key: 'finally',
      value: function _finally(onFinally) {
        return _classPrivateFieldGet2(_promise, this)['finally'](onFinally);
      },
    }]);
  }();

  /**
     * @param {SweetAlert} instance
     * @param {DomCache} domCache
     * @param {SweetAlertOptions} innerParams
     * @return {Promise}
     */
  var swalPromise = function swalPromise(instance, domCache, innerParams) {
    return new Promise(function(resolve, reject) {
      // functions to handle all closings/dismissals
      /**
         * @param {DismissReason} dismiss
         */
      const dismissWith = function dismissWith(dismiss) {
        instance.close({
          isDismissed: true,
          dismiss: dismiss,
        });
      };
      privateMethods.swalPromiseResolve.set(instance, resolve);
      privateMethods.swalPromiseReject.set(instance, reject);
      domCache.confirmButton.onclick = function() {
        handleConfirmButtonClick(instance);
      };
      domCache.denyButton.onclick = function() {
        handleDenyButtonClick(instance);
      };
      domCache.cancelButton.onclick = function() {
        handleCancelButtonClick(instance, dismissWith);
      };
      domCache.closeButton.onclick = function() {
        dismissWith(DismissReason.close);
      };
      handlePopupClick(innerParams, domCache, dismissWith);
      addKeydownHandler(globalState, innerParams, dismissWith);
      handleInputOptionsAndValue(instance, innerParams);
      openPopup(innerParams);
      setupTimer(globalState, innerParams, dismissWith);
      initFocus(domCache, innerParams);

      // Scroll container to top on open (#1247, #1946)
      setTimeout(function() {
        domCache.container.scrollTop = 0;
      });
    });
  };

  /**
     * @param {SweetAlertOptions} userParams
     * @param {SweetAlertOptions} mixinParams
     * @return {SweetAlertOptions}
     */
  var prepareParams = function prepareParams(userParams, mixinParams) {
    const templateParams = getTemplateParams(userParams);
    const params = Object.assign({}, defaultParams, mixinParams, templateParams, userParams); // precedence is described in #2131
    params.showClass = Object.assign({}, defaultParams.showClass, params.showClass);
    params.hideClass = Object.assign({}, defaultParams.hideClass, params.hideClass);
    if (params.animation === false) {
      params.showClass = {
        backdrop: 'swal2-noanimation',
      };
      params.hideClass = {};
    }
    return params;
  };

  /**
     * @param {SweetAlert} instance
     * @return {DomCache}
     */
  var populateDomCache = function populateDomCache(instance) {
    const domCache = {
      popup: getPopup(),
      container: getContainer(),
      actions: getActions(),
      confirmButton: getConfirmButton(),
      denyButton: getDenyButton(),
      cancelButton: getCancelButton(),
      loader: getLoader(),
      closeButton: getCloseButton(),
      validationMessage: getValidationMessage(),
      progressSteps: getProgressSteps(),
    };
    privateProps.domCache.set(instance, domCache);
    return domCache;
  };

  /**
     * @param {GlobalState} globalState
     * @param {SweetAlertOptions} innerParams
     * @param {Function} dismissWith
     */
  var setupTimer = function setupTimer(globalState, innerParams, dismissWith) {
    const timerProgressBar = getTimerProgressBar();
    hide(timerProgressBar);
    if (innerParams.timer) {
      globalState.timeout = new Timer(function() {
        dismissWith('timer');
        delete globalState.timeout;
      }, innerParams.timer);
      if (innerParams.timerProgressBar) {
        show(timerProgressBar);
        applyCustomClass(timerProgressBar, innerParams, 'timerProgressBar');
        setTimeout(function() {
          if (globalState.timeout && globalState.timeout.running) {
            // timer can be already stopped or unset at this point
            animateTimerProgressBar(innerParams.timer);
          }
        });
      }
    }
  };

  /**
     * Initialize focus in the popup:
     *
     * 1. If `toast` is `true`, don't steal focus from the document.
     * 2. Else if there is an [autofocus] element, focus it.
     * 3. Else if `focusConfirm` is `true` and confirm button is visible, focus it.
     * 4. Else if `focusDeny` is `true` and deny button is visible, focus it.
     * 5. Else if `focusCancel` is `true` and cancel button is visible, focus it.
     * 6. Else focus the first focusable element in a popup (if any).
     *
     * @param {DomCache} domCache
     * @param {SweetAlertOptions} innerParams
     */
  var initFocus = function initFocus(domCache, innerParams) {
    if (innerParams.toast) {
      return;
    }
    // TODO: this is dumb, remove `allowEnterKey` param in the next major version
    if (!callIfFunction(innerParams.allowEnterKey)) {
      warnAboutDeprecation('allowEnterKey');
      blurActiveElement();
      return;
    }
    if (focusAutofocus(domCache)) {
      return;
    }
    if (focusButton(domCache, innerParams)) {
      return;
    }
    setFocus(-1, 1);
  };

  /**
     * @param {DomCache} domCache
     * @return {boolean}
     */
  var focusAutofocus = function focusAutofocus(domCache) {
    const autofocusElements = domCache.popup.querySelectorAll('[autofocus]');
    const _iterator = _createForOfIteratorHelper(autofocusElements);
    let _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        const autofocusElement = _step.value;
        if (autofocusElement instanceof HTMLElement && isVisible$1(autofocusElement)) {
          autofocusElement.focus();
          return true;
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return false;
  };

  /**
     * @param {DomCache} domCache
     * @param {SweetAlertOptions} innerParams
     * @return {boolean}
     */
  var focusButton = function focusButton(domCache, innerParams) {
    if (innerParams.focusDeny && isVisible$1(domCache.denyButton)) {
      domCache.denyButton.focus();
      return true;
    }
    if (innerParams.focusCancel && isVisible$1(domCache.cancelButton)) {
      domCache.cancelButton.focus();
      return true;
    }
    if (innerParams.focusConfirm && isVisible$1(domCache.confirmButton)) {
      domCache.confirmButton.focus();
      return true;
    }
    return false;
  };
  var blurActiveElement = function blurActiveElement() {
    if (document.activeElement instanceof HTMLElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  };

  // Assign instance methods from src/instanceMethods/*.js to prototype
  SweetAlert.prototype.disableButtons = disableButtons;
  SweetAlert.prototype.enableButtons = enableButtons;
  SweetAlert.prototype.getInput = getInput;
  SweetAlert.prototype.disableInput = disableInput;
  SweetAlert.prototype.enableInput = enableInput;
  SweetAlert.prototype.hideLoading = hideLoading;
  SweetAlert.prototype.disableLoading = hideLoading;
  SweetAlert.prototype.showValidationMessage = showValidationMessage;
  SweetAlert.prototype.resetValidationMessage = resetValidationMessage;
  SweetAlert.prototype.close = close;
  SweetAlert.prototype.closePopup = close;
  SweetAlert.prototype.closeModal = close;
  SweetAlert.prototype.closeToast = close;
  SweetAlert.prototype.rejectPromise = rejectPromise;
  SweetAlert.prototype.update = update;
  SweetAlert.prototype._destroy = _destroy;

  // Assign static methods from src/staticMethods/*.js to constructor
  Object.assign(SweetAlert, staticMethods);

  // Proxy to instance methods to constructor, for now, for backwards compatibility
  Object.keys(instanceMethods).forEach(function(key) {
    /**
       * @param {...any} args
       * @return {any | undefined}
       */
    SweetAlert[key] = function() {
      if (currentInstance && currentInstance[key]) {
        let _currentInstance;
        return (_currentInstance = currentInstance)[key].apply(_currentInstance, arguments);
      }
      return null;
    };
  });
  SweetAlert.DismissReason = DismissReason;
  SweetAlert.version = '11.12.4';

  var Swal = SweetAlert;
  // @ts-ignore
  Swal['default'] = Swal;

  return Swal;
}));

export const SweetAlert = swl;
