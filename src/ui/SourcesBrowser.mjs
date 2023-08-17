import { VideoSource } from "../VideoSource.mjs";
import { PlayerModes } from "../enums/PlayerModes.mjs";
import { Utils } from "../utils/Utils.mjs";
import { DOMElements } from "./DOMElements.mjs";

export class SourcesBrowser {
    constructor(client) {
        this.client = client;

        this.sources = [];
        this.setupUI();
    }

    addSource(source) {
        if (this.sources.find((s) => s.equals(source))) {
            return;
        }
        source = source.copy();
        this.sources.unshift(source);
        let headersInput;
        let sourceContainer = Utils.create("div", null, "linkui-source");
        this.linkui.sourcesList.insertBefore(sourceContainer, this.linkui.sourcesList.firstChild);

        let sourceURL = Utils.create("input", null, "text_input linkui-source-url");
        sourceURL.value = source.url;
        sourceURL.placeholder = "Source URL";
        sourceURL.addEventListener("change", (e) => {
            source.url = sourceURL.value;
            this.updateSources();
        });
        sourceContainer.appendChild(sourceURL);

        const modes = {};
        modes[PlayerModes.DIRECT] = "Direct";
        modes[PlayerModes.ACCELERATED_MP4] = "Accelerated MP4";
        modes[PlayerModes.ACCELERATED_HLS] = "Accelerated HLS";
        modes[PlayerModes.ACCELERATED_DASH] = "DASH (experimental)";
        let sourceMode = Utils.createDropdown(source.mode, "Mode", modes, (val) => {
            source.mode = parseInt(val);
            this.updateSources();
        });
        sourceMode.classList.add("linkui-source-mode");
        sourceContainer.appendChild(sourceMode);

        let sourceHeadersBtn = Utils.create("div", null, "linkui-source-headers-button");
        sourceHeadersBtn.textContent = "Header Editor";
        sourceHeadersBtn.addEventListener("click", (e) => {
            if (headersInput.style.display == "none") {
                headersInput.style.display = "";
                sourceHeadersBtn.classList.add("active");
            } else {
                headersInput.style.display = "none";
                sourceHeadersBtn.classList.remove("active");
            }
        });
        sourceContainer.appendChild(sourceHeadersBtn);

        let sourceSetBtn = Utils.create("div", null, "linkui-source-set-button");
        sourceSetBtn.textContent = "Play";
        sourceSetBtn.addEventListener("click", async (e) => {
            if (sourceSetBtn.textContent != "Play") return;
            sourceSetBtn.textContent = "Loading...";
            await this.client.setSource(source.copy());
            this.updateSources();
        });
        sourceContainer.appendChild(sourceSetBtn);

        let sourceDeleteBtn = Utils.create("div", null, "linkui-source-delete-button");
        sourceDeleteBtn.textContent = "Delete";
        sourceDeleteBtn.addEventListener("click", (e) => {
            sourceContainer.remove();
            let ind = this.sources.indexOf(source);
            if (ind == -1) return;
            this.sources.splice(ind, 1);
            this.updateSources();
        });
        sourceContainer.appendChild(sourceDeleteBtn);

        headersInput = Utils.create("textarea", null, "text_input linkui-source-headers");
        headersInput.placeholder = "Headers (1 enty per line)\nHeader Name: Header Value";
        headersInput.value = Utils.objToHeadersString(source.headers);
        headersInput.addEventListener("keyup", (e) => {
            if (Utils.validateHeadersString(headersInput.value)) {
                headersInput.classList.remove("invalid");
            } else {
                headersInput.classList.add("invalid");
            }
        });

        headersInput.style.display = "none";
        headersInput.addEventListener("change", (e) => {
            source.headers = Utils.headersStringToObj(headersInput.value);
            this.updateSources();
        });
        sourceContainer.appendChild(headersInput);

        source.sourceBrowserElements = {
            container: sourceContainer,
            url: sourceURL,
            mode: sourceMode,
            headersBtn: sourceHeadersBtn,
            setBtn: sourceSetBtn,
            deleteBtn: sourceDeleteBtn
        }

        this.updateSources();
    }

    updateSources() {

        if (this.sources.length == 0) {
            this.linkui.sourcesFound.textContent = "No Sources Found";
        } else if (this.sources.length == 1) {
            this.linkui.sourcesFound.textContent = "1 Source Found";
        } else {
            this.linkui.sourcesFound.textContent = this.sources.length + " Sources Found";
        }
        this.sources.forEach((source) => {
            if (this.client.source && this.client.source.equals(source)) {
                source.sourceBrowserElements.container.classList.add("active");
                source.sourceBrowserElements.setBtn.textContent = "Playing";
            } else {
                source.sourceBrowserElements.container.classList.remove("active");
                source.sourceBrowserElements.setBtn.textContent = "Play";
            }
        })

    }

    setupUI() {

        DOMElements.linkButton.addEventListener("click", (e) => {
            if (DOMElements.linkuiContainer.style.display == "none") {
                DOMElements.linkuiContainer.style.display = "";
                DOMElements.subuiContainer.style.display = "none";
            } else {
                DOMElements.linkuiContainer.style.display = "none";
            }
            e.stopPropagation();
        })

        DOMElements.linkuiContainer.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        DOMElements.linkuiContainer.addEventListener("keydown", (e) => {
            e.stopPropagation();
        });

        DOMElements.linkuiContainer.addEventListener("keyup", (e) => {
            e.stopPropagation();
        });

        DOMElements.linkuiContainer.addEventListener("keypress", (e) => {
            e.stopPropagation();
        });


        DOMElements.playerContainer.addEventListener("click", (e) => {
            DOMElements.linkuiContainer.style.display = "none";
        });

        DOMElements.linkuiContainer.getElementsByClassName("close_button")[0].addEventListener("click", (e) => {
            DOMElements.linkuiContainer.style.display = "none";
        });

        this.linkui = {};

        this.linkui.sourcesFound = Utils.create("div", null, "linkui-sources-found");
        this.linkui.sourcesFound.textContent = "No Sources Found";
        DOMElements.linkuiContainer.appendChild(this.linkui.sourcesFound);

        this.linkui.addNewButton = Utils.create("div", null, "linkui-addnew-button");
        this.linkui.addNewButton.textContent = "Add Source";
        this.linkui.addNewButton.tabIndex = 0;
        DOMElements.linkuiContainer.appendChild(this.linkui.addNewButton);


        this.linkui.addNewButton.addEventListener("click", (e) => {
            this.addSource(new VideoSource("", null, PlayerModes.DIRECT));
        });



        this.linkui.clearButton = Utils.create("div", null, "linkui-clear-button");
        this.linkui.clearButton.textContent = "Clear Sources";
        this.linkui.clearButton.tabIndex = 0;
        DOMElements.linkuiContainer.appendChild(this.linkui.clearButton);

        this.linkui.clearButton.addEventListener("click", (e) => {
            this.sources.length = 0;
            this.linkui.sourcesList.innerHTML = "";

        });

        this.linkui.sourcesList = Utils.create("div", null, "linkui-sources-list");
        DOMElements.linkuiContainer.appendChild(this.linkui.sourcesList);
    }


}