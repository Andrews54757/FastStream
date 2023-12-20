import {EnvUtils} from '../../utils/EnvUtils.mjs';

export const VisChangeActions = {
  NOTHING: 'nothing',
  PLAY_PAUSE: 'playpause',
  MINI_PLAYER: 'miniplayer',
  // PIP: 'pip',
};

if (!EnvUtils.isExtension()) {
  delete VisChangeActions.MINI_PLAYER;
}
