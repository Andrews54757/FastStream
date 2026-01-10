/**
 * Utility functions for DOM and web operations.
 */
export class WebUtils {
  /**
   * Creates a DOM element with optional style and class.
   * @param {string} [type='div'] - The type of element to create.
   * @param {string} [style] - The style to apply to the element.
   * @param {string} [cl] - The class name to apply to the element.
  * @return {HTMLElement} The created element.
   */
  static create(type, style, cl) {
    const el = document.createElement(type || 'div');
    if (style) el.style = style;
    if (cl) el.className = cl;
    return el;
  }
  /**
   * Sets up tab index and keyboard accessibility for an element.
   * @param {HTMLElement} element - The element to setup.
   */
  static setupTabIndex(element) {
    element.tabIndex = 0;
    element.role = 'button';
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        element.click();
        e.stopPropagation();
      }
    });
  }
  /**
   * Sets ARIA and title labels for an element.
   * @param {HTMLElement} element - The element to label.
   * @param {string} label - The label text.
   */
  static setLabels(element, label) {
    element.ariaLabel = label;
    element.title = label;
  }
  /**
   * Gets the left offset of an element relative to the viewport.
   * @param {HTMLElement} elem - The element.
  * @return {number} The left offset in pixels.
   */
  static getOffsetLeft(elem) {
    return elem.getBoundingClientRect().left;
  }
  /**
   * Gets the top offset of an element relative to the viewport.
   * @param {HTMLElement} elem - The element.
  * @return {number} The top offset in pixels.
   */
  static getOffsetTop(elem) {
    return elem.getBoundingClientRect().top;
  }
  /**
   * Returns a string representation of a keyboard event's key combination.
   * @param {KeyboardEvent} e - The keyboard event.
  * @return {string} The key combination string.
   */
  static getKeyString(e) {
    const metaPressed = e.metaKey && e.key !== 'Meta';
    const ctrlPressed = e.ctrlKey && e.key !== 'Control';
    const altPressed = e.altKey && e.key !== 'Alt';
    const shiftPressed = e.shiftKey && e.key !== 'Shift';
    const key = e.key === ' ' ? 'Space' : e.code;
    return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
  }
  /**
   * Creates an SVG icon element from a given path.
   * @param {string} iconPath - The SVG path data or URL.
   * @return {SVGElement} The created SVG icon element.
   */
  static createSVGIcon(iconPath) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', iconPath);
    svg.appendChild(use);
    return svg;
  }
  /**
   * Replaces all children of a parent element with new children efficiently.
   * @param {HTMLElement} parent - The parent element.
   * @param {Array<HTMLElement>} children - The new children to append.
   */
  static replaceChildrenPerformant(parent, children) {
    const currentChildrenSet = new Set(parent.children);
    const newChildrenSet = new Set(children);
    const toRemove = currentChildrenSet.difference(newChildrenSet);
    const toAdd = newChildrenSet.difference(currentChildrenSet);
    toRemove.forEach((child) => parent.removeChild(child));
    toAdd.forEach((child) => parent.appendChild(child));
  }
}
