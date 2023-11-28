import {Fragment} from '../Fragment.mjs';
export class DashFragment extends Fragment {
  constructor(request) {
    super(request.level, request.index);
    this.request = request;
    this.duration = request.duration;
    this.start = request.startTime;
    this.end = request.startTime + this.duration;
  }
  getContext() {
    let rangeStart = undefined;
    let rangeEnd = undefined;
    if (this.request.range && this.request.range.indexOf('-') > -1) {
      rangeStart = parseInt(this.request.range.split('-')[0]);
      rangeEnd = parseInt(this.request.range.split('-')[1]) + 1;
    }
    return {
      url: this.request.url,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      responseType: 'arraybuffer',
    };
  }
}
