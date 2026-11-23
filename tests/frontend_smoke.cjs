// Run with Node.js. The DOM is simulated; this is not a real Forge UI test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const base = path.resolve(__dirname, "..");
let passes = 0;
function check(name, condition) {
    assert.ok(condition, name);
    console.log("PASS " + name);
    passes++;
}

class Element {
    constructor(tag = "div") {
        this.tagName = tag; this.children = []; this.style = {};
        this.value = ""; this.textContent = ""; this.className = "";
        this.id = ""; this.listeners = {};
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    insertBefore(child, before) {
        child.parentNode = this;
        const index = this.children.indexOf(before);
        if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelectorAll(selector) {
        const selectors = selector.split(",").map(x => x.trim());
        const found = [];
        const visit = child => {
            if (selectors.some(s => s.startsWith("#") ? child.id === s.slice(1) :
                s.startsWith(".") ? child.className.split(" ").includes(s.slice(1)) :
                s === "span.single-select" ? child.tagName === "span" && child.className === "single-select" :
                child.tagName === s)) found.push(child);
            child.children.forEach(visit);
        };
        this.children.forEach(visit);
        return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function makeContext({neo = false, missingGelbooru = false, missingAll = false} = {}) {
    const root = new Element();
    for (const id of ["txt2img_prompt", "img2img_prompt"]) {
        const container = new Element(); container.id = id; root.appendChild(container);
    }
    const tabPanel = new Element(); tabPanel.id = "tac-gel-panel"; root.appendChild(tabPanel);
    let control = null;
    if (neo) {
        control = new Element(); control.id = "forge_ui_preset";
        const input = new Element("input"); input.value = "xl";
        control.appendChild(input); root.appendChild(control);
    }
    const storage = new Map();
    const callbacks = [];
    const context = vm.createContext({
        console, setTimeout, clearTimeout,
        setInterval: callback => { callbacks.push(callback); return callbacks.length; },
        clearInterval: () => {},
        navigator: {userAgent: "node"},
        document: {createElement: tag => new Element(tag), querySelector: () => null},
        localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
        gradioApp: () => root,
        onUiUpdate: () => {}, updateInput: () => {},
        opts: {...JSON.parse(fs.readFileSync(path.join(__dirname, "default_options.json"))),
            extra_networks_default_multiplier: 1, extra_networks_add_text_separator: " ",
            tac_frequencySort: false, tac_showExtraNetworkPreviews: false},
        fetch: async url => {
            if (url.startsWith("file=")) {
                const target = url.slice(5).split("?")[0];
                if (missingAll || (missingGelbooru && target.endsWith("gelbooru.csv"))) {
                    return {status: 404, statusText: "Not Found"};
                }
                const file = target.startsWith("/mock/tags/")
                    ? path.join(base, "tags", target.slice("/mock/tags/".length)) : null;
                const text = file && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
                return {status: 200, text: async () => text, json: async () => JSON.parse(text)};
            }
            return {status: 200, json: async () => url.includes("lora-info") ? {} : []};
        }
    });
    for (const file of fs.readdirSync(path.join(base, "javascript")).filter(x => x.endsWith(".js")).sort()) {
        vm.runInContext(fs.readFileSync(path.join(base, "javascript", file), "utf8"), context, {filename: file});
    }
    vm.runInContext(`
        tagBasePath = "/mock/tags";
        var displayed = [];
        hideResults = () => {};
        showResults = () => {};
        isVisible = () => true;
        updateSelectionStyle = () => {};
        addResultsToList = (area, rows) => { displayed = rows.slice(); resultCount = rows.length; };
    `, context);
    return {context, root, control, callbacks, storage};
}

function evaluate(state, code) { return vm.runInContext(code, state.context); }
function area(text) {
    return {value: text, selectionStart: text.length, selectionEnd: text.length,
        focus: () => {}, parentNode: {parentNode: {id: "txt2img_prompt"}},
        setSelectionRange: () => {}};
}

async function main() {
    const state = makeContext({neo: true});
    const choose = state.context.TAC_GEL.chooseFile;
    check("Auto / anima -> Gelbooru", choose("Auto", "anima", "danbooru.csv") === "gelbooru.csv");
    check("Auto / SDXL -> Danbooru", choose("Auto", "xl", "gelbooru.csv") === "danbooru.csv");
    check("Auto / SD1.5 -> Danbooru", choose("Auto", "sd", "danbooru.csv") === "danbooru.csv");
    check("manual Danbooru beats anima", choose("Danbooru", "anima", "danbooru.csv") === "danbooru.csv");
    check("manual Gelbooru beats SDXL", choose("Gelbooru", "xl", "danbooru.csv") === "gelbooru.csv");
    check("Configured preserves custom lists", choose("Configured", "anima", "e621.csv") === "e621.csv");
    check("Danbooru variant preserved", choose("Auto", "xl", "danbooru_2025.csv") === "danbooru_2025.csv");
    await evaluate(state, "syncOptions()");
    check("actual Danbooru dictionary loaded", state.context.allTags.length > 90000 && state.context.TAC_CFG.tagFile === "danbooru.csv");
    state.control.children[0].value = "anima";
    await evaluate(state, "syncOptions()");
    check("actual Gelbooru dictionary loaded", state.context.allTags.length === 235255 && state.context.TAC_CFG.tagFile === "gelbooru.csv");
    const known = new Set(state.context.allTags.map(row => row[0]));
    check("Gelbooru names remain distinct", ["eyes_closed", "closed_eyes", "sole_female", "bellybutton", "hair_past_waist"].every(name => known.has(name)));
    check("angle-bracket face tags preserved", known.has("<o>_<o>"));
    check("no real Gelbooru tags redirected as aliases", !state.context.allTags.some(row => (row[3] || "").split(",").some(alias => known.has(alias))));
    state.context.testArea = area("sole_female");
    await evaluate(state, 'autocomplete(testArea, testArea.value, "sole_female")');
    check("actual TAC search returns sole_female", state.context.displayed.some(row => row.text === "sole_female"));
    evaluate(state, 'navigateInList(testArea, {key: "Tab", preventDefault(){}, stopPropagation(){}})');
    await new Promise(resolve => setTimeout(resolve, 0));
    check("Tab insertion keeps Gelbooru spelling", state.context.testArea.value.trim() === "sole female,");
    state.context.testArea = area("<l:");
    await evaluate(state, 'loras = [["sample_lora.safetensors", "sample", ""]]; autocomplete(testArea, testArea.value, "<l:")');
    check("upstream LoRA parser retained", state.context.displayed.some(row => row.text === "sample_lora"));
    state.context.testArea = area("<e:");
    await evaluate(state, 'embeddings = [["sample_embedding", "sample", "vXL"]]; autocomplete(testArea, testArea.value, "<e:")');
    check("upstream embedding parser retained", state.context.displayed.some(row => row.text === "sample_embedding"));
    state.context.testArea = area("__hair");
    await evaluate(state, 'wildcardFiles = [["/mock/wildcards", "hair/colours", "hair"]]; autocomplete(testArea, testArea.value, "__hair")');
    check("upstream wildcard parser retained", state.context.displayed.some(row => row.text.includes("hair")));
    state.context.TAC_GEL.start();
    check("one tab control created", state.root.querySelectorAll(".tac-gel-switch").length === 1 &&
        state.root.querySelector("#tac-gel-panel").querySelector(".tac-gel-switch") !== null);
    check("prompt boxes retain their original children", ["txt2img_prompt", "img2img_prompt"].every(id =>
        state.root.querySelector("#" + id).children.length === 0));
    let select = state.root.querySelectorAll(".tac-gel-switch")[0].querySelector("select");
    select.value = "Danbooru"; select.listeners.change();
    await evaluate(state, "syncOptions()");
    check("manual toolbar overrides Anima", state.context.TAC_CFG.tagFile === "danbooru.csv");
    check("toolbar modes synchronized", state.root.querySelectorAll(".tac-gel-switch").every(bar => bar.querySelector("select").value === "Danbooru"));
    select.value = "Auto"; select.listeners.change();
    await evaluate(state, "syncOptions()");
    check("returning to Auto follows Anima", state.context.TAC_CFG.tagFile === "gelbooru.csv");
    state.control.children[0].value = "xl";
    state.callbacks[0]();
    await evaluate(state, "syncOptions()");
    check("preset watcher follows UI without model load", state.context.TAC_CFG.tagFile === "danbooru.csv");
    const span = new Element("span"); span.className = "single-select"; span.textContent = "anima";
    state.control.appendChild(span);
    check("Gradio span selection supported", state.context.TAC_GEL.preset() === "anima");
    check("old suggestions blocked before preset polling", !evaluate(state, "isEnabled()"));
    await evaluate(state, "syncOptions()");
    // A pending search must never repopulate old suggestions after a switch.
    state.context.testArea = area("long");
    evaluate(state, 'TAC_CFG.frequencySort = true; var finishCounts; getUseCounts = () => new Promise(resolve => {finishCounts = resolve;});');
    const stale = evaluate(state, 'autocomplete(testArea, testArea.value, "long")');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(typeof state.context.finishCounts, "function");
    const switched = evaluate(state, "syncOptions()");
    state.context.finishCounts([]);
    await stale; await switched;
    check("stale asynchronous search discarded", state.context.results.length === 0);
    // A dictionary update blocks both keyboard and mouse insertions immediately.
    state.context.testArea = area("old");
    const blocking = evaluate(state, "syncOptions()");
    await evaluate(state, 'insertTextAtCursor(testArea, new AutocompleteResult("wrong", ResultType.tag), "old")');
    await blocking;
    check("insertion blocked during dictionary switch", state.context.testArea.value === "old");
    const racing = makeContext({neo: true});
    await evaluate(racing, "syncOptions()");
    evaluate(racing, 'var originalCsvLoader = loadCSV; var releaseGelbooru; loadCSV = async path => { if (path.endsWith("gelbooru.csv")) await new Promise(resolve => { releaseGelbooru = resolve; }); return originalCsvLoader(path); };');
    racing.control.children[0].value = "anima";
    const firstSwitch = evaluate(racing, "syncOptions()");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(typeof racing.context.releaseGelbooru, "function");
    racing.control.children[0].value = "xl";
    const secondSwitch = evaluate(racing, "syncOptions()");
    racing.context.releaseGelbooru();
    await firstSwitch; await secondSwitch;
    check("slow old download cannot win a newer switch", racing.context.TAC_CFG.tagFile === "danbooru.csv" && racing.context.TAC_GEL.ready());
    state.context.opts.tac_gelbooruMode = "Danbooru";
    await evaluate(state, "syncOptions()");
    check("changed settings default clears toolbar override", state.context.TAC_CFG.tagFile === "danbooru.csv" && state.root.querySelectorAll(".tac-gel-switch").every(bar => bar.querySelector("select").value === "Danbooru"));
    const legacy = makeContext();
    legacy.context.opts.forge_preset = "anima";
    await evaluate(legacy, "syncOptions()");
    check("host without Neo selector stays Danbooru", legacy.context.TAC_CFG.tagFile === "danbooru.csv");
    legacy.context.opts.tac_gelbooruMode = "Gelbooru";
    await evaluate(legacy, "syncOptions()");
    check("legacy host supports manual Gelbooru", legacy.context.TAC_CFG.tagFile === "gelbooru.csv");
    const missing = makeContext({missingGelbooru: true});
    missing.context.opts.tac_gelbooruMode = "Gelbooru";
    await evaluate(missing, "syncOptions()");
    check("missing Gelbooru safely falls back to Danbooru", missing.context.TAC_CFG.tagFile === "danbooru.csv" && missing.context.allTags.length > 90000);
    const broken = makeContext({missingAll: true});
    await evaluate(broken, "syncOptions()");
    check("missing dictionaries do not disable other parsers", broken.context.allTags.length === 0 && evaluate(broken, "isEnabled()"));
    console.log(`Frontend smoke checks passed: ${passes}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
