class Bilibili2Dash {
  constructor() {
    this.document = document.implementation.createDocument('', '', null);
  }

  playInfoToDash(playInfo) {
    const dashData = playInfo.data.dash;
    const MPD = this.loadDashData(dashData);
    const xml = new XMLSerializer().serializeToString(MPD);
    return '<?xml version="1.0" encoding="utf-8"?>' + xml;
  }

  loadDashTracks(tracks) {
    const AdaptationSet = this.document.createElement('AdaptationSet');
    tracks.forEach((track)=>{
      AdaptationSet.appendChild(this.loadDashTrack(track));
    });
    return AdaptationSet;
  }

  loadDashTrack(track) {
    const id = track.id;
    const baseUrl = track.baseUrl;
    const bandwidth = track.bandwidth;
    const mimeType = track.mimeType;
    const codecs = track.codecs;
    const width = track.width;
    const height = track.height;
    const frameRate = track.frameRate;
    const sar = track.sar;
    const startWithSap = track.startWithSap;
    const SegmentBase = track.SegmentBase;
    // const codecid = track.codecid;
    const Representation = this.document.createElement('Representation');
    Representation.setAttribute('id', id);
    Representation.setAttribute('codecs', codecs);
    Representation.setAttribute('bandwidth', bandwidth);
    Representation.setAttribute('width', width);
    Representation.setAttribute('height', height);
    if (frameRate) Representation.setAttribute('frameRate', frameRate);
    if (sar) Representation.setAttribute('sar', sar);
    Representation.setAttribute('startWithSAP', startWithSap);
    Representation.setAttribute('mimeType', mimeType);

    const BaseURL = this.document.createElement('BaseURL');
    BaseURL.textContent = baseUrl;
    Representation.appendChild(BaseURL);

    const SegmentBaseElement = this.document.createElement('SegmentBase');
    SegmentBaseElement.setAttribute('indexRange', SegmentBase.indexRange);
    Representation.appendChild(SegmentBaseElement);

    const Initialization = this.document.createElement('Initialization');
    Initialization.setAttribute('range', SegmentBase.Initialization);
    SegmentBaseElement.appendChild(Initialization);

    return Representation;
  }

  loadDashData(dashData) {
    const duration = dashData.duration;
    const minBufferTime = dashData.minBufferTime;
    const videoAdaptationSet = this.loadDashTracks(dashData.video);
    const audioAdaptationSet = this.loadDashTracks(dashData.audio);
    // const dolby = dashData.dolby;
    // const flac = dashData.flac;

    const MPD = this.document.createElement('MPD');
    MPD.setAttribute('xmlns', 'urn:mpeg:dash:schema:mpd:2011');
    MPD.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    MPD.setAttribute('xsi:schemaLocation', 'urn:mpeg:DASH:schema:MPD:2011 DASH-MPD.xsd');
    MPD.setAttribute('profiles', 'urn:mpeg:dash:profile:isoff-main:2011');
    MPD.setAttribute('minBufferTime', `PT${minBufferTime}S`);
    MPD.setAttribute('type', 'static');
    MPD.setAttribute('mediaPresentationDuration', `PT${duration}S`);

    const Period = this.document.createElement('Period');
    MPD.appendChild(Period);

    Period.appendChild(videoAdaptationSet);
    Period.appendChild(audioAdaptationSet);
    return MPD;
  }
}

// look for script tag with "window.__playinfo__"
const scriptTags = document.querySelectorAll('script');
for (let i = 0; i < scriptTags.length; i++) {
  const script = scriptTags[i];
  if (script.textContent.includes('window.__playinfo__')) {
    const playInfo = script.textContent.match(/window\.__playinfo__\s*=\s*(\{.*\})/);
    if (playInfo) {
      const playInfoObj = JSON.parse(playInfo[1]);
      const converter = new Bilibili2Dash();
      const mpd = converter.playInfoToDash(playInfoObj);
      const url = `data:application/dash+xml;base64,${btoa(mpd)}`;
      chrome.runtime.sendMessage({
        type: 'DETECTED_SOURCE',
        url,
        ext: 'mpd',
        headers: {
          'Referer': location.href,
          'Origin': location.origin,
        },
      });

      break;
    }
  }
}
