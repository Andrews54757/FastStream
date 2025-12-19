import Fuse from '../modules/fuse.mjs';

// Primary Singleton/Adapter class to pass values into Fuse
class Search {
  static SearchInstance = null;
  constructor() {
    this.Fuse = new Fuse([], {
      useExtendedSearch: true,
      threshold: 0.4,
    });
    this.baseSearchEls = Array.from(document.querySelectorAll('.search-target-remove'));
    this.baseSearchStyles = this.baseSearchEls.map((el) => el.style.display);
    this.keybindSearchEls = Array.from(document.querySelectorAll('.search-target-remove-keybind'));
    this.keybindSearchStyles = this.keybindSearchEls.map((el) => el.style.display || 'grid');
    this.baseSearchText = Array.from(document.querySelectorAll('.search-target-text'), (el) => el.textContent);
    this.keybindSearchText = Array.from(document.querySelectorAll('.search-target-keybind'), (el) => el.textContent);
    this.sections = this.buildSections();
    this.Fuse.setCollection([...this.baseSearchText, ...this.keybindSearchText]);
  }
  static get_search_instance() {
    if (this.SearchInstance === null) {
      this.SearchInstance = new Search();
    }
    return this.SearchInstance;
  }
  buildSections() {
    return Array.from(document.querySelectorAll('[data-search-section]'), (section) => {
      const items = Array.from(section.querySelectorAll('.search-target-remove, .search-target-remove-keybind'));
      return {
        element: section,
        countEl: section.querySelector('.section-count'),
        items,
        total: items.filter((item) => isElementVisible(item)).length,
      };
    });
  }
}

// Initializer function to make sure that keybinds are loaded properly after being generated
export function initsearch() {
  Search.SearchInstance = new Search();
  // Forces a style recompute due to CSS issues
  resetSearch();
}

// Resets the research candidates. Used probably a bit more than I'd like, but it's functional
export function resetSearch() {
  const instance = Search.get_search_instance();
  const removalEls = [...instance.baseSearchEls, ...instance.keybindSearchEls];
  removalEls.forEach((el) => {
    el.style.display = 'none';
  });

  const baseSearchLength = instance.baseSearchEls.length;
  const keybindSearchLength = instance.keybindSearchEls.length;
  for (let i = 0; i < baseSearchLength; ++i) {
    instance.baseSearchEls[i].style.display = instance.baseSearchStyles[i];
  }
  for (let i1 = 0; i1 < keybindSearchLength; ++i1) {
    instance.keybindSearchEls[i1].style.display = instance.keybindSearchStyles[i1];
  }

  renderSectionCounts(instance, '');
}

// Searches with a given string query, returns the list of indexes from the search dictionary that hit
export function searchWithQuery(query) {
  resetSearch();
  if (query === '') {
    return new Set();
  }
  const instance = Search.get_search_instance();
  const rez = new Set(Array.from(instance.Fuse.search(query), (value) => value.refIndex));
  let i = 0;
  // Same case as above for repeated singleton method calls
  instance.baseSearchEls.forEach((el) => {
    if (!rez.has(i)) {
      el.style.display = 'none';
    }
    ++i;
  });
  // To account for keybind weirdness...
  const offset = instance.baseSearchEls.length;
  const keyElsLength = instance.keybindSearchEls.length;
  for (let i1 = 0; i1 < keyElsLength; ++i1) {
    if (!rez.has((i1 * 2) + offset) && !rez.has((i1 * 2) + 1 + offset)) {
      instance.keybindSearchEls[i1].style.display = 'none';
    }
  }
  renderSectionCounts(instance, query);
  return rez;
}

function renderSectionCounts(instance, query) {
  const filtering = query !== '';
  document.body.classList.toggle('search-active', filtering);

  instance.sections.forEach((section) => {
    const visibleItems = section.items.filter((item) => isElementVisible(item)).length;
    const hasSearchableItems = section.total > 0;
    if (section.countEl) {
      if (filtering && hasSearchableItems) {
        section.countEl.textContent = `${visibleItems} / ${section.total} matched`;
        section.countEl.removeAttribute('hidden');
      } else {
        section.countEl.textContent = '';
        section.countEl.setAttribute('hidden', 'hidden');
      }
    }

    if (filtering && (!hasSearchableItems || visibleItems === 0)) {
      section.element.classList.add('section-hidden-by-search');
    } else {
      section.element.classList.remove('section-hidden-by-search');
    }
  });
}

function isElementVisible(el) {
  return el.getClientRects().length > 0 || el.offsetParent !== null;
}
