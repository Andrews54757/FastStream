import {WebUtils} from '../../utils/WebUtils.mjs';
import {Knob} from '../../modules/knob.mjs';
import {Utils} from '../../utils/Utils.mjs';
import {DOMElements} from '../DOMElements.mjs';
export function createKnob(name, minValue, maxValue, callback, units = '') {
  const knobContainer = WebUtils.create('div', null, 'knob_container');
  const knobName = WebUtils.create('div', null, 'knob_name');
  knobName.textContent = name;
  knobContainer.appendChild(knobName);
  const knobMinValueTick = WebUtils.create('div', null, 'knob_min_value_tick');
  knobContainer.appendChild(knobMinValueTick);
  const knobMinValueLabel = WebUtils.create('div', null, 'knob_min_value_label');
  knobMinValueLabel.textContent = minValue;
  knobContainer.appendChild(knobMinValueLabel);
  const knobMaxValueTick = WebUtils.create('div', null, 'knob_max_value_tick');
  knobContainer.appendChild(knobMaxValueTick);
  const knobMaxValueLabel = WebUtils.create('div', null, 'knob_max_value_label');
  knobMaxValueLabel.textContent = maxValue;
  knobContainer.appendChild(knobMaxValueLabel);
  let suggestedValue = null;
  let suggestedValueTracking = false;
  const knobSuggestedValueTick = WebUtils.create('div', null, 'knob_suggested_value_tick');
  knobSuggestedValueTick.style.display = 'none';
  const suggestedValueTickDot = WebUtils.create('div', null, 'knob_suggested_value_tick_dot');
  knobSuggestedValueTick.appendChild(suggestedValueTickDot);
  knobContainer.appendChild(knobSuggestedValueTick);
  const knobKnobContainer = WebUtils.create('div', null, 'knob_knob_container');
  knobContainer.appendChild(knobKnobContainer);
  const knobKnob = WebUtils.create('div', null, 'knob_knob');
  const knobBump = WebUtils.create('div', null, 'knob_bump');
  knobKnob.appendChild(knobBump);
  knobKnobContainer.appendChild(knobKnob);
  const knobValue = WebUtils.create('div', null, 'knob_value');
  knobContainer.appendChild(knobValue);
  knobValue.contentEditable = true;
  knobValue.role = 'textbox';
  knobValue.ariaLabel = name;
  knobValue.tabIndex = 0;
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
      callback(knob.val(), suggestedValueTracking);
    }
  });
  function checkValueIsSuggested() {
    const val = knob.val();
    if (suggestedValue !== null && !isNaN(suggestedValue) && (isNaN(val) || Math.abs(val - suggestedValue) < (maxValue - minValue) * 0.02)) {
      suggestedValueTracking = true;
      suggestedValueTickDot.classList.add('tracking');
      const prevFlag = shouldCall;
      shouldCall = false;
      if (val !== suggestedValue) {
        knob.val(suggestedValue);
      }
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
    DOMElements.playerContainer.removeEventListener('mousemove', mouseMove);
    DOMElements.playerContainer.removeEventListener('mouseup', mouseUp);
  };
  container.addEventListener('mousedown', (e) =>{
    const rect = container.getBoundingClientRect();
    knob.setPosition(rect.left, rect.top);
    knob.doTouchStart([{
      pageX: e.pageX,
      pageY: e.pageY,
    }], e.timeStamp);
    DOMElements.playerContainer.addEventListener('mousemove', mouseMove);
    DOMElements.playerContainer.addEventListener('mouseup', mouseUp);
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
          if (shouldCall) callback(val, suggestedValueTracking);
        }
      } else {
        knobSuggestedValueTick.style.display = 'none';
      }
      suggestedValue = val;
      checkValueIsSuggested();
    },
  };
}
