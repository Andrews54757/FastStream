import {WebUtils} from '../../utils/WebUtils.mjs';

export function createDropdown(defaultChoice, title, items, call, editableCallback = null) {
  const create = WebUtils.create;
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
  container.role = 'listbox';
  container.ariaLabel = title + ': ' + items[defaultChoice];
  container.appendChild(text);
  const itemListElement = create('div', `position: absolute; top: 100%; left: 0px; right: 0px;`, 'items');
  for (const name in items) {
    if (Object.hasOwn(items, name)) {
      const div = create('div');
      div.dataset.val = name;
      div.textContent = items[name];
      div.role = 'option';

      if (defaultChoice === name) {
        div.style.backgroundColor = 'var(--popwindow-dropdown-item-selected-background-color)';
      }
      itemListElement.appendChild(div);
    }
  }
  container.appendChild(itemListElement);
  setupDropdown(itemListElement, text, container, call);

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
      }
      e.stopPropagation();
    });

    span.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  return container;
}


function setupDropdown(itemListElement, text, container, call) {
  container.addEventListener('mouseleave', (e) => {
    container.blur();
  });

  container.addEventListener('mouseenter', (e) => {
    container.focus();
  });


  const main = text.children[0];

  function shiftSelection(indexAmount) {
    for (let j = 0; j < itemListElement.children.length; j++) {
      const element = itemListElement.children[j];
      if (element.dataset.val === container.dataset.val) {
        element.style.backgroundColor = '';
        const newIndex = (j + indexAmount + itemListElement.children.length) % itemListElement.children.length;
        const nextElement = itemListElement.children[newIndex];
        nextElement.style.backgroundColor = 'var(--popwindow-dropdown-item-selected-background-color)';
        main.textContent = nextElement.textContent;
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
        main.textContent = el.textContent;
        const prevValue = container.dataset.val;
        container.dataset.val = el.dataset.val;

        for (let j = 0; j < itemListElement.children.length; j++) {
          if (j === i) {
            itemListElement.children[j].style.backgroundColor = 'var(--popwindow-dropdown-item-selected-background-color)';
          } else {
            itemListElement.children[j].style.backgroundColor = '';
          }
        }
        e.stopPropagation();
        container.ariaLabel = text + ': ' + el.textContent;
        if (call) call(container.dataset.val, prevValue);
      });
    })(i);
  }
}
