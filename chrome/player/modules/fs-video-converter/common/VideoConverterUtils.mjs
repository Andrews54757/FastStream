export class VideoConverterUtils {
  static spsppsToDescription(spsList, ppsList) {
    let sps = [];
    let pps = [];
    let i;
    let data;
    let len;
    // assemble the SPSs

    for (i = 0; i < spsList; i++) {
      data = spsList[i];
      len = data.byteLength;
      sps.push(len >>> 8 & 0xff);
      sps.push(len & 0xff);
      // SPS
      sps = sps.concat(Array.prototype.slice.call(data));
    }

    // assemble the PPSs
    for (i = 0; i < ppsList.length; i++) {
      data = ppsList[i];
      len = data.byteLength;
      pps.push(len >>> 8 & 0xff);
      pps.push(len & 0xff);
      pps = pps.concat(Array.prototype.slice.call(data));
    }

    return new Uint8Array([0x01,
      // version
      sps[3],
      // profile
      sps[4],
      // profile compat
      sps[5],
      // level
      0xfc | 3,
      // lengthSizeMinusOne, hard-coded to 4 bytes
      0xe0 | track.sps.length, // 3bit reserved (111) + numOfSequenceParameterSets
    ].concat(sps).concat([track.pps.length, // numOfPictureParameterSets
    ]).concat(pps));
  }
}
