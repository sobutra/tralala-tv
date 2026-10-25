/*
 * Picks what to play without asking, tuned for iPhone Safari instead of the TV:
 * Safari plays MP4 (H.264, or HEVC tagged for Apple) with AAC / Dolby Digital audio. It can't open
 * MKV, AVI or TS files, DTS or TrueHD audio, or H.266. Those versions are still offered, and open
 * in the free VLC app instead. 1080p is preferred over 4K on a phone: same picture, a quarter of the data.
 */
'use strict';

var Smart = (function () {
  var uncachedRx = /(download\]|⏳|\[uc\]|uncached|not cached)/i;
  var cachedRx = /(\+\]|⚡|\[(rd|ad|pm|tb|dl|ed|oc)\+|instant|cached)/i;
  var foreignRx = /\b(ita|italian|french|truefrench|vff|vf2|vfq|ger|german|spa|spanish|latino|castellano|rus|russian|hindi|tamil|telugu|kor|korean|jpn|japanese|por|portuguese|pol|polish|tur|turkish)\b/i;
  var englishRx = /\b(eng|english|multi|dual)\b/i;
  var dvRx = /\b(dolby\s*vision|dovi|dv)\b/i;
  var hdrRx = /\b(hdr10\+?|hdr|hlg)\b/i;
  var hdr10pRx = /\bhdr10\+|hdr10plus/i;
  var dtsRx = /\b(dts[-\s.]?(hd|x|ma)?)\b/i;
  var truehdRx = /\btrue[-\s.]?hd\b/i;
  var dolbyAudioRx = /\b(dolby\s*digital|dd[p+]?\s?[257]\.?[01]?|ddp|eac-?3|ac-?3|aac|e-?ac3)\b/i;
  var atmosRx = /\batmos\b/i;
  var hevcRx = /\b(hevc|h\.?265|x\.?265)\b/i;
  var avcRx = /\b(avc|h\.?264|x\.?264)\b/i;
  var vvcRx = /\b(vvc|h\.?266|vvenc)\b/i;
  var av1Rx = /\bav1\b/i;
  var threeDRx = /\b(3d|sbs|half.?sbs|hou)\b/i;
  var remuxRx = /\bremux\b/i;
  var sizeRx = /(\d+(?:\.\d+)?)\s?(KB|MB|GB|TB)/i;
  var seedRx = /👤\s*(\d[\d,.]*)/;

  function text(s) {
    return [s.name, s.title, s.description, s.behaviorHints && s.behaviorHints.filename].filter(Boolean).join(' ');
  }

  function quality(s) {
    var sources = [s.behaviorHints && s.behaviorHints.filename, s.title, s.description, s.name].filter(Boolean);
    for (var i = 0; i < sources.length; i++) {
      var q = qualityOf(sources[i]);
      if (q !== 'unknown') return q;
    }
    return 'unknown';
  }
  function qualityOf(t) {
    if (/\b2160[pi]?\b/i.test(t)) return '4k';
    if (/\b1080[pi]?\b/i.test(t)) return '1080p';
    if (/\b720[pi]?\b/i.test(t)) return '720p';
    if (/\b480[pi]?\b/i.test(t)) return 'sd';
    if (/\b(4k|uhd|ultra\s*hd)\b/i.test(t)) return '4k';
    if (/\bfhd\b/i.test(t)) return '1080p';
    if (/\b(cam|camrip|ts|telesync|hdts|hdcam|telecine|tc)\b/i.test(t)) return 'cam';
    if (/\b(sd|dvd|dvdrip)\b/i.test(t)) return 'sd';
    if (/\bHD\b/.test(t)) return '720p';
    return 'unknown';
  }

  /** 'mp4' plays in the app, 'other' needs VLC, '?' when the add-on doesn't say. */
  function container(s) {
    var fn = (s.behaviorHints && s.behaviorHints.filename) || '';
    var m = /\.([a-z0-9]{2,4})$/i.exec(fn.trim());
    var ext = m ? m[1].toLowerCase() : '';
    if (!ext) {
      var t = (s.title || '') + ' ' + (s.url || '');
      if (/\.(mp4|m4v|mov)\b/i.test(t) || /\bmp4\b/i.test(t)) ext = 'mp4';
      else if (/\.(mkv|avi|ts|wmv)\b/i.test(t)) ext = 'mkv';
      else if (/\.m3u8\b/i.test(s.url || '')) ext = 'mp4';
    }
    if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return 'mp4';
    if (ext) return 'other';
    return '?';
  }

  function sizeBytes(s) {
    if (s.behaviorHints && s.behaviorHints.videoSize) return s.behaviorHints.videoSize;
    var m = sizeRx.exec(text(s));
    if (!m) return 0;
    var v = parseFloat(m[1]), u = m[2].toUpperCase();
    return v * (u === 'TB' ? 1099511627776 : u === 'GB' ? 1073741824 : u === 'MB' ? 1048576 : 1024);
  }

  function info(s) {
    var t = text(s);
    var i = {
      quality: quality(s), size: sizeBytes(s), box: container(s),
      dv: dvRx.test(t), hdr: hdrRx.test(t), hdr10p: hdr10pRx.test(t),
      dts: dtsRx.test(t), truehd: truehdRx.test(t), dolbyAudio: dolbyAudioRx.test(t), atmos: atmosRx.test(t),
      hevc: hevcRx.test(t), avc: avcRx.test(t), vvc: vvcRx.test(t), av1: av1Rx.test(t), threeD: threeDRx.test(t), remux: remuxRx.test(t),
      foreignOnly: foreignRx.test(t) && !englishRx.test(t),
      cached: cachedRx.test(s.name || ''),
      ready: isReady(s)
    };
    var seeds = seedRx.exec(t);
    i.seeds = seeds ? parseInt(seeds[1].replace(/[,.]/g, ''), 10) : null;
    i.problem = problem(i);
    i.vlc = !i.problem && i.box === 'other';
    return i;
  }

  /** Why it can't play on an iPhone at all (not even in VLC is fine to try), or null. */
  function problem(i) {
    if (i.vvc) return 'H.266 video won’t play on iPhone';
    if (i.threeD) return '3D version';
    if (i.box === 'mp4' && (i.dts || i.truehd) && !i.dolbyAudio) return (i.truehd ? 'TrueHD' : 'DTS') + ' audio won’t play in the app';
    return null;
  }

  function isReady(s) {
    var tag = (s.name || '') + ' ' + (s.title || s.description || '').slice(0, 40);
    if (uncachedRx.test(tag)) return false;
    return !!s.url;
  }

  /** Higher is better for playing right here in the app. */
  function score(s, isEpisode) {
    var i = s._i || (s._i = info(s));
    var q = { '1080p': 40, '4k': 33, '720p': 30, 'sd': 14, 'cam': -100, 'unknown': 20 }[i.quality];
    var gb = i.size / 1073741824;
    var cap = isEpisode ? 2.5 : 8;           // phone-friendly sizes; huge files stall on cellular
    if (gb > cap) q -= 12;
    if (gb > 0.01 && gb < (isEpisode ? 0.12 : 0.6) && i.quality !== 'sd') q -= 6;
    if (i.remux) q -= 10;
    if (i.problem) q -= 80;
    if (i.box === 'other') q -= 60;          // needs VLC
    if (i.box === '?') q -= 8;
    if (i.avc) q += 3;                       // always plays in Safari
    if (i.hevc && !i.avc) q += 0;            // usually plays; falls back automatically when not
    if (i.av1) q -= 6;
    if (i.dolbyAudio) q += 1;
    if (i.foreignOnly) q -= 20;
    if (i.cached) q += 1;
    return q;
  }

  function rank(streams, isEpisode) {
    return streams.slice().sort(function (a, b) {
      var ra = isReady(a) ? 1 : 0, rb = isReady(b) ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return score(b, isEpisode) - score(a, isEpisode);
    });
  }

  /** The version to auto-play in the app, or null (then the list is shown, with VLC options). */
  function best(streams, isEpisode, skip) {
    var ranked = rank(streams, isEpisode);
    for (var i = 0; i < ranked.length; i++) {
      var s = ranked[i];
      if (skip && skip.indexOf(s.url) >= 0) continue;
      if (isReady(s) && score(s, isEpisode) > -20) return s;
    }
    return null;
  }

  /** Best version to hand to VLC when nothing plays in the app. */
  function bestForVlc(streams, isEpisode) {
    var ranked = streams.filter(isReady).map(function (s) { return s; }).sort(function (a, b) {
      var ia = a._i || (a._i = info(a)), ib = b._i || (b._i = info(b));
      var qa = { '1080p': 40, '4k': 34, '720p': 30, 'sd': 14, 'cam': -100, 'unknown': 20 }[ia.quality] - (ia.foreignOnly ? 20 : 0) - (ia.vvc ? 80 : 0) - (ia.remux ? 8 : 0);
      var qb = { '1080p': 40, '4k': 34, '720p': 30, 'sd': 14, 'cam': -100, 'unknown': 20 }[ib.quality] - (ib.foreignOnly ? 20 : 0) - (ib.vvc ? 80 : 0) - (ib.remux ? 8 : 0);
      return qb - qa;
    });
    return ranked[0] || null;
  }

  function badges(s) {
    var i = s._i || (s._i = info(s));
    var b = [];
    if (i.quality === '4k') b.push('4K'); else if (i.quality === '1080p') b.push('1080p'); else if (i.quality === '720p') b.push('720p'); else if (i.quality === 'sd') b.push('SD');
    if (i.dv) b.push('Dolby Vision');
    if (i.hdr10p) b.push('HDR10+'); else if (i.hdr) b.push('HDR');
    if (i.atmos) b.push('Atmos');
    if (i.remux) b.push('REMUX');
    return b;
  }

  function size(s) {
    var i = s._i || (s._i = info(s));
    if (!i.size) return '';
    var gb = i.size / 1073741824;
    return gb >= 1 ? gb.toFixed(1) + ' GB' : (i.size / 1048576).toFixed(0) + ' MB';
  }

  function titleLine(s) {
    var fn = s.behaviorHints && s.behaviorHints.filename;
    var t = (s.title || s.description || '').split('\n')[0];
    return fn || t || s.name || 'Version';
  }

  function detailLine(s) {
    var i = s._i || (s._i = info(s));
    var parts = [];
    var site = /⚙️\s*([^\n]+)/.exec(s.title || s.description || '');
    if (site) parts.push(site[1].trim());
    if (i.seeds !== null) parts.push(i.seeds + ' seeders');
    return parts.join(' · ');
  }

  /** Opens a stream in the VLC app (free on the App Store). */
  function vlcUrl(url) { return 'vlc-x-callback://x-callback-url/stream?url=' + encodeURIComponent(url); }

  return { rank: rank, best: best, bestForVlc: bestForVlc, info: info, isReady: isReady, score: score,
    badges: badges, size: size, titleLine: titleLine, detailLine: detailLine, vlcUrl: vlcUrl };
})();
