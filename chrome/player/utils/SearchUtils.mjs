import Fuse from "../../external/fuse.min.mjs"

// Primary Singleton/Adapter class to pass values into Fuse
class Search {
    static SearchInstance = null;
    constructor(){
        this.Fuse = new Fuse([], {
            useExtendedSearch: true,
            threshold: 0.4
        });
        this.baseSearchEls = document.querySelectorAll(".search-target-remove");
        this.baseSearchStyles = Array.from(document.querySelectorAll(".search-target-remove"), el => el.style.display);
        this.keybindSearchEls = document.querySelectorAll(".search-target-remove-keybind");
        this.keybindSearchStyles = Array(this.keybindSearchEls.length).fill("grid");
        this.baseSearchText = Array.from(document.querySelectorAll(".search-target-text"), el => el.textContent);
        this.keybindSearchText = Array.from(document.querySelectorAll(".search-target-keybind"), el => el.textContent);
    }
    static get_search_instance(){
        if (this.SearchInstance === null){
            this.SearchInstance = new Search();
        }
        return this.SearchInstance;
    }
}

// Initializer function to make sure that keybinds are loaded properly after being generated
export function initsearch(){
    Search.get_search_instance();
    // Forces a style recompute due to CSS issues
    resetSearch();
}

// Resets the research candidates. Used probably a bit more than I'd like, but it's functional
export function resetSearch(){
    const removalEls = [...document.querySelectorAll(".search-target-remove"), ...document.querySelectorAll(".search-target-remove-keybind")]
    removalEls.forEach((el) => {
        el.style.display = "none"
    })

    // This technically breaks singleton a bit, however I don't expect the instance to change in the scope of this loop
    // It'll run faster!
    Search.get_search_instance().keybindSearchEls = document.querySelectorAll(".search-target-remove-keybind");
    Search.get_search_instance().baseSearchEls = document.querySelectorAll(".search-target-remove");
    const instance = Search.get_search_instance();
    const baseSearchLength = instance.baseSearchEls.length;
    const keybindSearchLength = instance.keybindSearchEls.length;
    for (let i = 0; i < baseSearchLength; ++i){
        instance.baseSearchEls[i].style.display = instance.baseSearchStyles[i];
    }
    for (let i1 = 0; i1 < keybindSearchLength; ++i1){
        instance.keybindSearchEls[i1].style.display = instance.keybindSearchStyles[i1];
    }
    Search.get_search_instance().Fuse.setCollection([...instance.baseSearchText, ...instance.keybindSearchText]);
}

// Searches with a given string query, returns the list of indexes from the search dictionary that hit
export function searchWithQuery(query){
    resetSearch();
    if (query === ""){
        return new Set();
    }
    const rez = new Set(Array.from(Search.get_search_instance().Fuse.search(query), value => value.refIndex));
    let i = 0;
    // Same case as above for repeated singleton method calls
    const instance = Search.get_search_instance();
    instance.baseSearchEls.forEach((el) => {
        if (!rez.has(i)){
            el.style.display = "none"
        }
        ++i;
    })
    // To account for keybind weirdness...
    const offset = Search.get_search_instance().baseSearchEls.length;
    const keyElsLength = Search.get_search_instance().keybindSearchEls.length;
    for (let i1 = 0; i1 < keyElsLength; ++i1){
        if (!rez.has((i1*2)+offset) && !rez.has((i1*2)+1+offset)){
            instance.keybindSearchEls[i1].style.display = "none"
        }
    }
    return rez;
}