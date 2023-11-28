import {PlayerModes} from '../enums/PlayerModes.mjs';
export class PlayerLoader {
  constructor() {
    this.players = {};
    this.registerPlayer(PlayerModes.DIRECT, './DirectVideoPlayer.mjs');
    this.registerPlayer(PlayerModes.ACCELERATED_MP4, './mp4/MP4Player.mjs');
    this.registerPlayer(PlayerModes.ACCELERATED_HLS, './hls/HLSPlayer.mjs');
    this.registerPlayer(PlayerModes.ACCELERATED_DASH, './dash/DashPlayer.mjs');
    this.registerPlayer(PlayerModes.ACCELERATED_YT, './yt/YTPlayer.mjs');
  }
  async createPlayer(mode, client, options) {
    if (!Object.hasOwn(this.players, mode)) {
      throw new Error(`Unknown player mode: ${mode}`);
    }
    const Player = (await import(this.players[mode])).default;
    return new Player(client, options);
  }
  registerPlayer(mode, playerURL) {
    this.players[mode] = playerURL;
  }
}
