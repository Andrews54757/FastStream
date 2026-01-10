function findPropertyRecursive(obj, key, list = [], stack = []) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i)=>{
      stack.push(i);
      findPropertyRecursive(v, key, list, stack);
      stack.pop();
    });
  } else {
    if (Object.hasOwn(obj, key)) {
      list.push({value: obj[key], stack: stack.slice(), obj});
    }
    Object.keys(obj).forEach((k)=>{
      stack.push(k);
      findPropertyRecursive(obj[k], key, list, stack);
      stack.pop();
    });
  }
  return list;
}
// look for script tag with "window.__playinfo__"
const scriptTags = document.querySelectorAll('script');
let datas = [];
for (let i = 0; i < scriptTags.length; i++) {
  const script = scriptTags[i];
  if (script.type !== 'application/json') {
    continue;
  }
  try {
    const playInfo = JSON.parse(script.textContent);
    const objects = findPropertyRecursive(playInfo, 'playback_video');
    if (objects.length > 0) {
      objects.forEach((obj)=>{
        datas.push(obj);
      });
    }
  } catch (e) {
    console.error(e);
  }
}
// Look for video in path
datas = datas.filter((data)=>{
  return data.stack.includes('video');
});
if (datas.length === 0) {
  console.error('No video found');
} else {
  const mpd = datas[0].value.playlist;
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
  console.log('Video found', datas[0].value);
}
