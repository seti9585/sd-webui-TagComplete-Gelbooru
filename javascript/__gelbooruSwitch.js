// Dictionary switching extends the upstream TAC engine without replacing it.
var TAC_GEL = (() => {
    const modes = ["Auto", "Danbooru", "Gelbooru", "Configured"];
    const cache = new Map();
    const storageKey = "seti.tac.gelbooru.mode.v1";
    let override = null;
    let settingMode = null;
    let lastSignature = "";
    let timer = null;
    let serial = Promise.resolve();
    let pending = 0;
    let epoch = 0;
    let error = "";
    let loadedRequest = null;
    const watched = new WeakSet();
    try {
        const saved = localStorage.getItem(storageKey);
        if (modes.includes(saved)) override = saved;
    } catch (e) { /* Storage may be blocked in private browsing. */ }

    function root() { return gradioApp(); }

    function preset() {
        const control = root().querySelector("#forge_ui_preset");
        if (!control) return "";
        // Gradio versions use either a selected-value span or an input/select.
        const selected = control.querySelector("span.single-select");
        if (selected && selected.textContent.trim()) {
            return selected.textContent.trim().toLowerCase();
        }
        const field = control.querySelector("select, input");
        const value = field && field.value.trim();
        return String(value || opts.forge_preset || "").toLowerCase();
    }

    function mode() {
        const configured = modes.includes(opts.tac_gelbooruMode) ? opts.tac_gelbooruMode : "Auto";
        // Applying a different settings default also resets the browser override.
        if (settingMode !== null && settingMode !== configured) {
            override = null;
            try { localStorage.removeItem(storageKey); } catch (e) { /* Optional. */ }
        }
        settingMode = configured;
        return override || configured;
    }

    function chooseFile(selectedMode, selectedPreset, configuredFile) {
        const danbooru = /^danbooru[^/\\]*\.csv$/i.test(configuredFile || "")
            ? configuredFile : "danbooru.csv";
        if (selectedMode === "Configured") return configuredFile || "danbooru.csv";
        if (selectedMode === "Gelbooru") return "gelbooru.csv";
        if (selectedMode === "Auto" && selectedPreset === "anima") return "gelbooru.csv";
        return danbooru;
    }

    function desiredFile() { return chooseFile(mode(), preset(), opts.tac_tagFile); }

    function signature() {
        return JSON.stringify([mode(), preset(), opts.tac_tagFile, opts.tac_gelbooruMode]);
    }

    function invalidate() {
        epoch++;
        results = [];
        selectedTag = null;
        previousTags = [];
        root().querySelectorAll(".autocompleteParent").forEach(element => {
            element.style.display = "none";
        });
    }

    function updateBars() {
        const activeMode = mode();
        root().querySelectorAll(".tac-gel-switch").forEach(bar => {
            bar.querySelector("select").value = activeMode;
            const status = bar.querySelector(".tac-gel-status");
            const file = TAC_CFG ? TAC_CFG.tagFile : desiredFile();
            status.textContent = pending ? "Loading dictionary..."
                : error ? error : `Dictionary: ${file}${preset() ? " / UI: " + preset() : ""}`;
            status.style.color = error ? "#b45309" : "inherit";
        });
    }

    function addBars() {
        const panel = root().querySelector("#tac-gel-panel");
        if (panel && !panel.querySelector(".tac-gel-switch")) {
            const bar = document.createElement("div");
            bar.id = "tac-gel-controls";
            bar.className = "tac-gel-switch";
            bar.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0;font-size:13px";
            const label = document.createElement("label");
            label.textContent = "Tag dictionary: ";
            const select = document.createElement("select");
            select.setAttribute("aria-label", "Tag dictionary mode");
            select.style.cssText = "color:inherit;background:transparent;border:1px solid #888;border-radius:6px;padding:3px";
            modes.forEach(value => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = value === "Configured" ? "Use Tag filename setting" : value;
                select.appendChild(option);
            });
            label.appendChild(select);
            bar.appendChild(label);
            const status = document.createElement("span");
            status.className = "tac-gel-status";
            status.setAttribute("role", "status");
            bar.appendChild(status);
            panel.appendChild(bar);
            select.addEventListener("change", () => {
                override = select.value;
                try { localStorage.setItem(storageKey, override); } catch (e) { /* Optional. */ }
                lastSignature = signature();
                syncOptions().catch(console.error);
            });
        }
        updateBars();
    }

    async function readTags(file) {
        if (cache.has(file)) return cache.get(file);
        const rows = await loadCSV(`${tagBasePath}/${file}`);
        if (!Array.isArray(rows)) throw new Error("Invalid dictionary");
        const builtIn = /^(danbooru.*|gelbooru)\.csv$/i.test(file);
        const valid = rows.filter(row => row[0] &&
            (builtIn ? /^-?\d+$/.test(row[1]) && /^\d+$/.test(row[2]) :
                !/^\s*</.test(row[0]) && (row[1] === undefined || row[1] === "" || /^-?\d+$/.test(row[1]))));
        if (!valid.length) throw new Error("Empty or invalid dictionary");
        if (file.toLowerCase() === "gelbooru.csv") {
            // A real Gelbooru tag must not be redirected by an alias entry.
            const known = new Set(valid.map(row => row[0]));
            valid.forEach(row => {
                if (row[3]) row[3] = row[3].split(",").filter(alias => !known.has(alias)).join(",");
            });
        }
        cache.set(file, valid);
        return valid;
    }

    async function load(config) {
        error = "";
        loadedRequest = config.tagFile;
        if (config.tagFile === "None") { allTags = []; return; }
        try {
            allTags = await readTags(config.tagFile);
        } catch (e) {
            console.warn("TAC dictionary unavailable:", config.tagFile, e);
            error = `${config.tagFile} unavailable; using danbooru.csv`;
            config.tagFile = "danbooru.csv";
            try { allTags = await readTags(config.tagFile); }
            catch (fallbackError) {
                allTags = [];
                error = "Tag dictionaries unavailable. Extra-network completion remains enabled.";
                console.warn("TAC fallback unavailable:", fallbackError);
            }
        }
    }

    function run(task) {
        pending++;
        invalidate();
        updateBars();
        // Serialize config updates to prevent older downloads winning a switch.
        const next = serial.catch(() => {}).then(task);
        serial = next.catch(() => {});
        return next.finally(() => { pending--; updateBars(); });
    }

    function checkMode() {
        const current = signature();
        if (current !== lastSignature) {
            lastSignature = current;
            syncOptions().catch(console.error);
        }
    }

    function watchPreset() {
        const control = root().querySelector("#forge_ui_preset");
        if (!control || watched.has(control)) return;
        watched.add(control);
        control.addEventListener("input", checkMode);
        control.addEventListener("change", checkMode);
        if (typeof MutationObserver !== "undefined") {
            const observer = new MutationObserver(checkMode);
            observer.observe(control, {childList: true, subtree: true, characterData: true, attributes: true});
        }
    }

    function start() {
        if (timer !== null) return;
        lastSignature = signature();
        addBars();
        watchPreset();
        // Read actual selected DOM values; never infer architecture from filenames.
        timer = setInterval(() => {
            addBars();
            watchPreset();
            checkMode();
        }, 250);
    }

    return {chooseFile, desiredFile, preset, load, run, start,
        epoch: () => epoch, busy: () => pending > 0,
        ready: () => pending === 0 && loadedRequest === desiredFile()};
})();
