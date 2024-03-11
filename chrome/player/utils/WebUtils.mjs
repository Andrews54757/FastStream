import {Knob} from '../modules/knob.mjs';
import {Utils} from './Utils.mjs';

export class WebUtils {
  static create(type, style, cl) {
    const el = document.createElement(type || 'div');
    if (style) el.style = style;
    if (cl) el.className = cl;
    return el;
  }

  static setupTabIndex(element) {
    element.tabIndex = 0;
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        element.click();
        e.stopPropagation();
      }
    });
  }

  static getOffsetLeft(elem) {
    return elem.getBoundingClientRect().left;
  }

  static createKnob(name, minValue, maxValue, callback, units = '') {
    const knobContainer = this.create('div', null, 'knob_container');
    const knobName = this.create('div', null, 'knob_name');
    knobName.textContent = name;
    knobContainer.appendChild(knobName);


    const knobMinValueTick = this.create('div', null, 'knob_min_value_tick');
    knobContainer.appendChild(knobMinValueTick);

    const knobMinValueLabel = this.create('div', null, 'knob_min_value_label');
    knobMinValueLabel.textContent = minValue;
    knobContainer.appendChild(knobMinValueLabel);

    const knobMaxValueTick = this.create('div', null, 'knob_max_value_tick');
    knobContainer.appendChild(knobMaxValueTick);

    const knobMaxValueLabel = this.create('div', null, 'knob_max_value_label');
    knobMaxValueLabel.textContent = maxValue;
    knobContainer.appendChild(knobMaxValueLabel);

    let suggestedValue = null;
    let suggestedValueTracking = false;
    let suggestedValueSet = false;
    const knobSuggestedValueTick = this.create('div', null, 'knob_suggested_value_tick');
    knobSuggestedValueTick.style.display = 'none';
    const suggestedValueTickDot = this.create('div', null, 'knob_suggested_value_tick_dot');
    knobSuggestedValueTick.appendChild(suggestedValueTickDot);
    knobContainer.appendChild(knobSuggestedValueTick);

    const knobKnobContainer = this.create('div', null, 'knob_knob_container');
    knobContainer.appendChild(knobKnobContainer);

    const knobKnob = this.create('div', null, 'knob_knob');
    const knobBump = this.create('div', null, 'knob_bump');
    knobKnob.appendChild(knobBump);
    knobKnobContainer.appendChild(knobKnob);

    const knobValue = this.create('div', null, 'knob_value');
    knobContainer.appendChild(knobValue);
    knobValue.contentEditable = true;

    const decimals = Utils.clamp(3 - Math.ceil(Math.log10(maxValue - minValue)), 0, 3);

    let shouldCall = false;
    const knob = new Knob(knobKnob, (knob, indicator)=>{
      knobKnob.style.transform = `rotate(-${indicator.angle}deg)`;
      // dont update the value if the user is editing it
      if (knobValue !== document.activeElement) {
        knobValue.textContent = knob.val().toFixed(decimals) + ' ' + units;
      }
      if (shouldCall && callback) {
        checkValueIsSuggested();
        callback(knob.val());
      }
    });

    function checkValueIsSuggested() {
      const val = knob.val();
      if (suggestedValue !== null && Math.abs(val - suggestedValue) < (maxValue - minValue) * 0.02) {
        suggestedValueTracking = true;
        suggestedValueTickDot.classList.add('tracking');
        const prevFlag = shouldCall;
        shouldCall = false;
        knob.val(suggestedValue);
        shouldCall = prevFlag;
      } else {
        suggestedValueTickDot.classList.remove('tracking');
        suggestedValueTracking = false;
      }
    }

    knobValue.addEventListener('input', ()=>{
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      if (isNaN(val)) {
        return;
      }
      knob.val(val);
    });

    knobValue.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        e.preventDefault();
        knobValue.blur();
      }
      e.stopPropagation();
    });

    knobValue.addEventListener('blur', (e)=>{
      const val = parseFloat(knobValue.textContent.replace(units, ''));
      knob.val(val);
    });

    knob.options.indicatorAutoRotate = true;
    knob.options.angleEnd = 315;
    knob.options.angleStart = 45;
    knob.options.valueMin = minValue;
    knob.options.valueMax = maxValue;
    knob.val(minValue);

    setTimeout(()=>{
      shouldCall = true;
    }, 1);


    const container = knobKnobContainer;
    const rect = container.getBoundingClientRect();
    knob.setPosition(rect.left, rect.top);
    knob.setDimensions(50, 50);

    const mouseMove = (e) => {
      knob.doTouchMove([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);
      e.preventDefault();
    };

    const mouseUp = (e) => {
      knob.doTouchEnd(e.timeStamp);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('mouseup', mouseUp);
    };

    container.addEventListener('mousedown', (e) =>{
      const rect = container.getBoundingClientRect();
      knob.setPosition(rect.left, rect.top);

      knob.doTouchStart([{
        pageX: e.pageX,
        pageY: e.pageY,
      }], e.timeStamp);

      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseUp);
    });

    // Handle scroll
    container.addEventListener('wheel', function(e) {
      // reset the position in case knob moved
      knob.setPosition(container.offsetLeft, container.offsetTop);

      const delta = -Utils.clamp(e.wheelDelta, -1, 1);
      knob.doMouseScroll(delta, e.timeStamp, e.pageX, e.pageY);

      e.preventDefault();
    });


    return {
      container: knobContainer,
      knob: knob,
      setSuggestedValue: (val) => {
        if (val !== null) {
          knobSuggestedValueTick.style.display = '';
          knobSuggestedValueTick.style.transform = `rotate(${(val - minValue) / (maxValue - minValue) * 270 + 45}deg)`;
          if (suggestedValueTracking) {
            const prevFlag = shouldCall;
            shouldCall = false;
            knob.val(val);
            shouldCall = prevFlag;
            if (shouldCall) callback(val);
          }
        } else {
          knobSuggestedValueTick.style.display = 'none';
        }
        suggestedValue = val;
        if (!suggestedValueSet) {
          suggestedValueSet = true;
          if (knob.val() === suggestedValue) {
            suggestedValueTracking = true;
            suggestedValueTickDot.classList.add('tracking');
          }
        }
      },
    };
  }

  static createPagesBar(page, totalPages, callback) {
    const create = this.create;
    const total = Math.min(totalPages, 1000);
    let start = Math.max(page - 5, 1);

    if (start + 10 > total) {
      start = Math.max(total - 10, 1);
    }

    const max = Math.min(start + 10, total);
    const list = create('div', null, 'page-bar');
    if (start > 1) {
      const el = create('div', null, 'page-marker');
      el.textContent = 1;
      el.addEventListener('click', () => {
        callback(1);
      });
      this.setupTabIndex(el);
      list.appendChild(el);

      if (start > 2) {
        const el = create('div', null, 'page-marker');
        el.textContent = '...';
        list.appendChild(el);
      }
    }
    for (let i = start; i <= max; i++) {
      ((i) => {
        const el = create('div', null, 'page-marker');
        el.textContent = i;
        if (i === page) {
          el.classList.add('selected');
          el.contentEditable = true;
          el.addEventListener('blur', () => {
            el.textContent = i;
            window.getSelection().empty();
          });
          el.addEventListener('focus', () => {
            window.getSelection().selectAllChildren(el);
          });
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const page = parseInt(el.textContent);
              if (page > 0 && page <= total) {
                callback(parseInt(el.textContent));
              } else {
                el.textContent = i;
              }
            }
            e.stopPropagation();
          });
        } else {
          el.addEventListener('click', () => {
            callback(i);
          });
        }
        this.setupTabIndex(el);
        list.appendChild(el);
      })(i);
    }

    if (max < total) {
      if (max + 1 < total) {
        const el = create('div', null, 'page-marker');
        el.textContent = '...';
        list.appendChild(el);
      }

      const el = create('div', null, 'page-marker');
      el.textContent = total;
      el.addEventListener('click', () => {
        callback(total);
      });
      this.setupTabIndex(el);
      list.appendChild(el);
    }
    return list;
  }

  static setupDropdown(itemListElement, text, container, call) {
    container.addEventListener('mouseleave', (e) => {
      container.blur();
    });

    container.addEventListener('mouseenter', (e) => {
      container.focus();
    });

    function shiftSelection(indexAmount) {
      for (let j = 0; j < itemListElement.children.length; j++) {
        const element = itemListElement.children[j];
        if (element.dataset.val === container.dataset.val) {
          element.style.backgroundColor = '';
          const newIndex = (j + indexAmount + itemListElement.children.length) % itemListElement.children.length;
          const nextElement = itemListElement.children[newIndex];
          nextElement.style.backgroundColor = 'rgb(20,20,20)';
          text.children[0].textContent = nextElement.textContent;
          container.dataset.val = nextElement.dataset.val;
          if (call) call(container.dataset.val, element.dataset.val);
          break;
        }
      }
    }

    container.addEventListener('click', (e) => {
      shiftSelection(1);
      e.stopPropagation();
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' ) {
        shiftSelection(1);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowUp') {
        shiftSelection(-1);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        shiftSelection(1);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    for (let i = 0; i < itemListElement.children.length; i++) {
      ((i) => {
        const el = itemListElement.children[i];

        el.addEventListener('click', (e) => {
          text.children[0].textContent = el.textContent;
          const prevValue = container.dataset.val;
          container.dataset.val = el.dataset.val;

          for (let j = 0; j < itemListElement.children.length; j++) {
            if (j === i) {
              itemListElement.children[j].style.backgroundColor = 'rgb(20,20,20)';
            } else {
              itemListElement.children[j].style.backgroundColor = '';
            }
          }
          e.stopPropagation();
          if (call) call(container.dataset.val, prevValue);
        });
      })(i);
    }
  }

  static createDropdown(defaultChoice, title, items, call, editableCallback = null) {
    const create = this.create;
    const container = create('div', null, 'dropdown');

    const text = create('div');
    text.appendChild(document.createTextNode(`${title}: `));
    const span = create('span', null, 'dropdown_text');
    span.contentEditable = editableCallback != null;
    span.textContent = items[defaultChoice];
    text.appendChild(span);
    text.appendChild(document.createTextNode(' ˅'));

    container.dataset.val = defaultChoice;
    container.tabIndex = 0;
    container.appendChild(text);
    const itemListElement = create('div', `position: absolute; top: 100%; left: 0px; right: 0px;`, 'items');
    for (const name in items) {
      if (Object.hasOwn(items, name)) {
        const div = create('div');
        div.dataset.val = name;
        div.textContent = items[name];

        if (defaultChoice === name) {
          div.style.backgroundColor = 'rgb(20,20,20)';
        }
        itemListElement.appendChild(div);
      }
    }
    container.appendChild(itemListElement);
    this.setupDropdown(itemListElement, text, container, call);

    if (editableCallback) {
      span.style.cursor = 'text';
      span.addEventListener('input', (e) => {
        const value = span.textContent;
        for (let i = 0; i < itemListElement.children.length; i++) {
          const element = itemListElement.children[i];
          if (element.dataset.val === container.dataset.val) {
            element.textContent = value;
            break;
          }
        }
        editableCallback(container.dataset.val, value);
        e.stopPropagation();
      });

      span.addEventListener('keydown', (e)=>{
        if (e.key === 'Tab') {
          return;
        } else if (e.key === 'Enter') {
          span.blur();
          e.stopPropagation();
        }
        e.preventDefault();
      });

      span.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    return container;
  }

  static getKeyString(e) {
    const metaPressed = e.metaKey && e.key !== 'Meta';
    const ctrlPressed = e.ctrlKey && e.key !== 'Control';
    const altPressed = e.altKey && e.key !== 'Alt';
    const shiftPressed = e.shiftKey && e.key !== 'Shift';
    const key = e.key === ' ' ? 'Space' : e.code;

    return (metaPressed ? 'Meta+' : '') + (ctrlPressed ? 'Control+' : '') + (altPressed ? 'Alt+' : '') + (shiftPressed ? 'Shift+' : '') + key;
  }
}
