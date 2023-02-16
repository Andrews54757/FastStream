import { Fragment } from "../Fragment.mjs";

export class HLSFragment extends Fragment {
    constructor(frag, start, end) {
        super(frag.level, frag.sn)
        this.hlsFrag = frag;
        this.duration = frag.duration;
        this.start = start;
        this.end = end;
    }

    getFrag() {
        return this.hlsFrag;
    }

    getContext() {
        return {
            url: this.hlsFrag.url,
            rangeStart: this.hlsFrag.byteRangeStartOffset,
            rangeEnd: this.hlsFrag.byteRangeEndOffset,
            responseType: "arraybuffer"
        }
    }
}