import {DefaultPlayerEvents} from '../../enums/DefaultPlayerEvents.mjs';
import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import DashPlayer from '../dash/DashPlayer.mjs';
import {Vimeo2Dash} from './Vimeo2Dash.mjs';

export default class VMPlayer extends DashPlayer {
  constructor(client, options) {
    super(client, options);
  }

  async setSource(source) {
    try {
      let manifest;
      try {
        const hc = [];
        for (const key in source.headers) {
          if (Object.hasOwn(source.headers, key)) {
            hc.push({
              operation: 'set',
              header: key,
              value: source.headers[key],
            });
          }
        }

        const xhr = await RequestUtils.request({
          url: source.url,
          header_commands: hc,
          responseType: 'json',
        });

        const convert = new Vimeo2Dash();
        manifest = convert.playlistToDash(source.url, xhr.response);
      } catch (e) {
        throw e;
      }

      this.oldSource = source;
      const blob = new Blob([manifest], {
        type: 'application/dash+xml',
      });
      const uri = URL.createObjectURL(blob);
      this.source = source.copy();
      this.source.url = uri;
      this.source.mode = PlayerModes.ACCELERATED_DASH;
    } catch (e) {
      console.error(e);
      this.emit(DefaultPlayerEvents.ERROR, e);
      return;
    }

    await super.setSource(this.source);
  }

  destroy() {
    if (this.source) {
      URL.revokeObjectURL(this.source.url);
    }
    super.destroy();
  }

  getSource() {
    return this.source;
  }
}
