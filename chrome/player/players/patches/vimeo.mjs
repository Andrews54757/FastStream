import {PlayerModes} from '../../enums/PlayerModes.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';


class Vimeo2Dash {
  constructor() {
    this.document = document.implementation.createDocument('', '', null);
  }

  playlistToDash(url, playlist) {
    const base_url = playlist.base_url;
    const new_base_url = new URL(base_url, url).href;

    const MPD = this.makeMPD(new_base_url, playlist);
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
    const baseUrl = track.base_url;
    const bandwidth = track.avg_bitrate;
    const mimeType = track.mime_type;
    const codecs = track.codecs;
    const width = track.width;
    const height = track.height;
    const frameRate = track.framerate;
    const startWithSap = 1;

    // const codecid = track.codecid;
    const Representation = this.document.createElement('Representation');
    Representation.setAttribute('id', id);
    Representation.setAttribute('codecs', codecs);
    Representation.setAttribute('bandwidth', bandwidth);
    Representation.setAttribute('width', width);
    Representation.setAttribute('height', height);
    if (frameRate) Representation.setAttribute('frameRate', frameRate);
    Representation.setAttribute('startWithSAP', startWithSap);
    Representation.setAttribute('mimeType', mimeType);

    const BaseURL = this.document.createElement('BaseURL');
    BaseURL.textContent = baseUrl;
    Representation.appendChild(BaseURL);

    const SegmentList = this.document.createElement('SegmentList');
    SegmentList.setAttribute('duration', track.max_segment_duration);
    SegmentList.setAttribute('timescale', 1);

    Representation.appendChild(SegmentList);

    const index_segment = track.index_segment;
    const init_segment_data_b64 = track.init_segment;
    const segments = track.segments;


    const RepresentationIndex = this.document.createElement('RepresentationIndex');
    RepresentationIndex.setAttribute('sourceURL', index_segment);
    SegmentList.appendChild(RepresentationIndex);

    const Initialization = this.document.createElement('Initialization');
    Initialization.setAttribute('sourceURL', 'data:application/octet-stream;base64,' + init_segment_data_b64);
    SegmentList.appendChild(Initialization);

    segments.forEach((segment)=>{
      const SegmentURL = this.document.createElement('SegmentURL');
      SegmentURL.setAttribute('media', segment.url);
      SegmentList.appendChild(SegmentURL);
    });

    return Representation;
  }

  makeMPD(baseURL, dashData) {
    let duration = 0;
    dashData.video.forEach((video)=>{
      if (video.duration > duration) {
        duration = video.duration;
      }
    });

    dashData.audio.forEach((audio)=>{
      if (audio.duration > duration) {
        duration = audio.duration;
      }
    });

    const minBufferTime = 1.5;
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

    if (baseURL) {
      const BaseURL = this.document.createElement('BaseURL');
      BaseURL.textContent = baseURL;
      MPD.appendChild(BaseURL);
    }

    const Period = this.document.createElement('Period');
    MPD.appendChild(Period);

    Period.appendChild(videoAdaptationSet);
    Period.appendChild(audioAdaptationSet);
    return MPD;
  }
}

export async function patchVimeoSource(source) {
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
  const dashManifest = convert.playlistToDash(source.url, xhr.response);
  source.url = URL.createObjectURL(new Blob([dashManifest], {type: 'application/dash+xml'}));
  source.mode = PlayerModes.ACCELERATED_DASH;

  console.log('Vimeo source patched');
  console.log(dashManifest);

  return source;
}
