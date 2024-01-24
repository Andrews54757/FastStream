import {StringUtils} from '../../utils/StringUtils.mjs';
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
    if (this.request.range) {
      const [start, end] = StringUtils.parseHTTPRange(this.request.range);
      if (start === undefined) {
        console.error('Failed to parse range', this.request.range);
      } else {
        rangeStart = start;
        rangeEnd = end + 1;
      }
    }
    return {
      url: this.request.url,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      responseType: 'arraybuffer',
    };
  }
}
