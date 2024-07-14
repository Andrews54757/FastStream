import {WebUtils} from '../../utils/WebUtils.mjs';

export function createPagesBar(page, totalPages, callback) {
  const create = WebUtils.create;
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
    WebUtils.setupTabIndex(el);
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
      WebUtils.setupTabIndex(el);
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
    WebUtils.setupTabIndex(el);
    list.appendChild(el);
  }
  return list;
}
