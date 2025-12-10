import test from 'ava'
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import * as SearchUtils from "./chrome/player/utils/SearchUtils.mjs";

// Initializes the testing framework
test.before(async () => {
    const html = readFileSync("./testhtml.html", "utf-8");
    const dom = new JSDOM(html)
    global.document = dom.window.document;
    global.window = dom.window;
})

// Checks to make sure that the dom loads (if it doesn't ALL OTHER TESTS WILL FAIL)
test("virtualdomload", async t => {
    t.true(typeof document == "object", "DOM is not an object! All other tests will fail because of this!");
    t.true(document.querySelectorAll("*").length > 0, "DOM size less than zero! All other tests will fail because of this!")
})

// Checks to make sure keybinds load (some earlier implementations broke this!)
test("keybindload", async t => {
    const keyarray = Array.from(document.querySelectorAll(".search-target-remove-keybind"), el => el.style.display);
    t.false(keyarray.some((el) => el === "none"))
})

// Checks that search returns anything at all for a basic query
test("basic", async t => {
    SearchUtils.initsearch();
    const rez = SearchUtils.searchWithQuery("video");
    t.true(rez.size > 0);
});

// Checks a substring of every options search target to make sure that it returns a search resultslist of length greater than 0
test("options_allkeys", async t => {
    SearchUtils.initsearch();
    const innerTexts = Array.from(document.querySelectorAll(".search-target-text"), el => el.textContent);
    innerTexts.forEach((text) => {
        // Fuse's search algo breaks on larger strings of text. Not much I can do about it...
        const rez = SearchUtils.searchWithQuery(text.substring(0, 5));
        t.true(rez.size > 0, "option key query " + text.substring(0, 5) + " and target " + text + " breaks the search!")
    })
})

// Checks a substring of every keybind search target to make sure that it returns a search results list of length greater than 0
test("keybinds_alllkeys", async t => {
    SearchUtils.initsearch();
    const innerTexts = Array.from(document.querySelectorAll(".search-target-keybind"), el => el.textContent);
    innerTexts.forEach((text) => {
        // Fuse's search algo breaks on larger strings of text. Not much I can do about it...
        const rez = SearchUtils.searchWithQuery(text.substring(0, 5));
        t.true(rez.size > 0, "option key query " + text.substring(0, 5) + " and target " + text + " breaks the search!")
    })
})

// Checks to see if "+" in the search query breaks things
test("keybind_plussearch", async t => {
    SearchUtils.initsearch();
    const rez = SearchUtils.searchWithQuery("Shift+");
    t.true(rez.size > 0);
})

// Checks to see if reset search is clearing options properly
test("resetsearch_options", async t => {
    SearchUtils.initsearch();
    const rez = SearchUtils.searchWithQuery("Shift+")
    let optionarray = Array.from(document.querySelectorAll(".search-target-remove"), el => el.style.display);
    t.true(optionarray.every((el) => el === "none"))
    SearchUtils.resetSearch();
    optionarray = Array.from(document.querySelectorAll(".search-target-remove"), el => el.style.display);
    t.false(optionarray.some((el) => el === "none"))
})

// Checks to see if reset search is clearing keybinds properly
test("resetsearch_keybind", async t => {
    SearchUtils.initsearch();
    const rez = SearchUtils.searchWithQuery("saturation")
    let keyarray = Array.from(document.querySelectorAll(".search-target-remove-keybind"), el => el.style.display);
    t.false(keyarray.some((el) => el === "grid"))
    SearchUtils.resetSearch();
    keyarray = Array.from(document.querySelectorAll(".search-target-remove-keybind"), el => el.style.display);
    t.true(keyarray.every((el) => el === "grid"))
})

// Checks to see if a blank query returns nothing
test("blankquery", async t => {
    SearchUtils.initsearch();
    const rez = SearchUtils.searchWithQuery("");
    t.true(rez.size == 0);
})


