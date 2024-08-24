export class WebUtils {
  static create(type, style, cl) {
    const el = document.createElement(type || 'div');
    if (style) el.style = style;
    if (cl) el.className = cl;
    return el;
  }

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

  static setLabels(element, label) {
    element.ariaLabel = label;
    element.title = label;
  }

  static getOffsetLeft(elem) {
    return elem.getBoundingClientRect().left;
  }

  static getOffsetTop(elem) {
    return elem.getBoundingClientRect().top;
  }

  static getKeyString(e) {
    const metaPressed = e.metaKey && e.key !== 'Meta';
    const ctrlPressed = e.ctrlKey && e.key !== 'Control';
    const altPressed = e.altKey && e.key !== 'Alt';
    const shiftPressed = e.shiftKey && e.key !== 'Shift';
    const key = e.key === ' ' ? 'Space' : e.code;

    return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
  }

  static createSVGIcon(iconPath) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', iconPath);
    svg.appendChild(use);
    return svg;
  }
}
