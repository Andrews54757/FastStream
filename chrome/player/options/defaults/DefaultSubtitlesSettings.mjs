export const DefaultSubtitlesSettings = {
  fontSize: '3vw',
  color: 'rgba(255,255,255,1)',
  background: 'rgba(10,10,10,0.3)',
  outlineColor: 'rgb(0,0,0)',
  outlineWidth: '0px',
  defaultLanguage: 'en',
};

export const SubtitleSettingsConfigData = {
  fontSize: {
    type: 'css',
    property: 'font-size',
  },
  color: {
    type: 'css',
    isColor: true,
    property: 'color',
  },
  background: {
    type: 'css',
    isColor: true,
    property: 'background-color',
  },
  outlineColor: {
    type: 'custom',
    isColor: true,
  },
  outlineWidth: {
    type: 'custom',
  },
  defaultLanguage: {
    type: 'string',
  },
};
