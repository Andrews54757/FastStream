import { PlayerModes } from "./enums/PlayerModes.mjs";

const headerWhitelist = [
    "Origin",
    "Referer"
]

const redirectHeaders = [
    "Origin",
    "Referer",
];


export class VideoSource {
    constructor(source, headers, mode) {
        if (source instanceof File) {
            this.fromFile(source);
        } else {
            this.url = source;
            this.identifier = this.url.split(/[?#]/)[0];;
        }
        this.mode = mode || PlayerModes.DIRECT;

        if (Array.isArray(headers)) {
            this.headers = {};
            headers.forEach(header => {
                if (header.name && header.value) {
                    this.headers[header.name] = header.value;
                }
            })
        } else {
            this.headers = headers || {};
        }

        this.headers = this.filterHeaders(this.headers);
    }

    fromFile(file) {
        this.url = URL.createObjectURL(file);
        this.identifier = file.name;

        this.shouldRevoke = true;
    }

    destroy() {
        if (this.shouldRevoke) {
            URL.revokeObjectURL(this.url);
            this.url = null;
        }
    }

    filterHeaders(headers) {
        let filteredHeaders = {};
        for (let key in headers) {
            if (!headerWhitelist.includes(key)) {
                continue;
            }

            if (redirectHeaders.includes(key)) {
                filteredHeaders['x-faststream-setheader-' + key] = headers[key];
            } else {
                filteredHeaders[key] = headers[key];
            }
        }
        return filteredHeaders;

    }
}