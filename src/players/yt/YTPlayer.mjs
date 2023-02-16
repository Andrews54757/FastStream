import { Innertube, UniversalCache } from "../../modules/yt.mjs";
import { VideoSource } from "../../VideoSource.mjs";
import { DashPlayer } from "../dash/DashPlayer.mjs";

export class YTPlayer extends DashPlayer {
    constructor(client, options) {
        super(client, options)
    }

    async setSource(source) {
        const youtube = await Innertube.create({
            cache: new UniversalCache(),
            fetch: async (input, init) => {
                // url
                const url = typeof input === 'string'
                    ? new URL(input)
                    : input instanceof URL
                        ? input
                        : new URL(input.url);

                // transform the url for use with our proxy
                // url.searchParams.set('__host', url.host);
                // url.host = 'localhost:8080';
                // url.protocol = 'http';

                const headers = init?.headers
                    ? new Headers(init.headers)
                    : input instanceof Request
                        ? input.headers
                        : new Headers();

                const redirectHeaders = [
                    "user-agent",
                    "origin",
                    "referer",
                ];
                // now serialize the headers
                let headersArr = [...headers];
                let customHeaderCommands = [];
                headersArr = headersArr.filter((header) => {
                    let name = header[0];
                    let value = header[1];
                    if (redirectHeaders.includes(name.toLowerCase())) {
                        customHeaderCommands.push({
                            operation: "set",
                            header: name,
                            value
                        });
                        return false;
                    }
                    return true;
                })
                let newHeaders = new Headers(headersArr);
                if (!customHeaderCommands.find((c) => c.header === "origin")) {
                    customHeaderCommands.push({
                        operation: "remove",
                        header: "origin"
                    });
                }

                customHeaderCommands.push({
                    operation: "remove",
                    header: "x-client-data"
                });

                if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                    await chrome.runtime.sendMessage({
                        type: "header_commands",
                        url: url,
                        commands: customHeaderCommands
                    });
                }
                // fetch the url
                return fetch(input, init ? {
                    ...init,
                    headers: newHeaders
                } : {
                    headers: newHeaders
                });
            },
        });
        const videoInfo = await youtube.getInfo(source.url);
        this.youtube = youtube;
        this.videoInfo = videoInfo;
        const manifest = videoInfo.toDash(url => {
            return url;
        });
        this.oldSource = source;
        const uri = "data:application/dash+xml;charset=utf-8;base64," + btoa(manifest);
        this.source = new VideoSource(uri, source.headers, source.type);
        super.setSource(this.source);

    }


    canSave() {

        return {
            canSave: !!this.videoInfo,
            isComplete: !!this.videoInfo
        }
    }

    async getSaveBlob(options) {


        const stream = await this.videoInfo.download({
            type: "video+audio",
            quality: "best",
            format: "mp4"
        });

        let blob = await (new Response(stream)).blob();
        return {
            extension: "mp4",
            blob: blob
        }
    }


}