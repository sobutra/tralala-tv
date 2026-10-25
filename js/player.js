/*
 * The player uses Safari's own video controls, which on iOS 26 are real Liquid Glass and bring
 * AirPlay, Picture in Picture, the subtitle and audio menus and full screen with them. Around
 * them Tra-la-la TV adds: close and Versions, the title, the next-episode countdown, the lock-screen
 * title (Media Session), progress saved to Stremio, and automatic fallback when a version won't play.
 */
'use strict';

var Player = (function () {
  var cur = null;
  /*
   * On iPhone the video plays in Safari's own full-screen player. That player is what lets
   * iOS slip into Picture in Picture by itself when you swipe home (Settings > General >
   * Picture in Picture > Start PiP Automatically). From a video playing inside the page,
   * iOS only allows Picture in Picture from a button tap. iPad and Mac play inside the page.
   */
  var IPHONE = /iPhone|iPod/.test(navigator.userAgent);
  var video = U.el('video', { preload: 'auto', controls: true, 'x-webkit-airplay': 'allow', autopictureinpicture: true });
  if (!IPHONE) { video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); }
  try { video.autoPictureInPicture = true; } catch (e) {}
  function fullscreenNow() { return !!(video.webkitDisplayingFullscreen || video.webkitPresentationMode === 'fullscreen'); }
  function pipNow() { return video.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === video; }
  /** Picture in Picture works in Safari; Home Screen web apps on iOS 26 don't offer it yet (WebKit bug 303885). */
  function pipAvailable() {
    try { if (video.webkitSupportsPresentationMode) return video.webkitSupportsPresentationMode('picture-in-picture'); } catch (e) {}
    return !!document.pictureInPictureEnabled;
  }
  // iPhone only lets a video start with sound after a tap. Starting it once from a tap unlocks
  // this element, so later episodes can start on their own. (Inline for that first moment, so
  // no empty full-screen player flashes up.)
  function prime() {
    if (cur) return;
    try {
      video.setAttribute('playsinline', '');
      var p = video.play(); if (p && p.catch) p.catch(function () {});
      if (IPHONE) setTimeout(function () { if (!cur || !video.src) video.removeAttribute('playsinline'); }, 0);
    } catch (e) {}
  }

  function open(opts) {
    if (cur) cur.close(true);
    var series = opts.meta.type === 'series';
    var el = U.el('div.screen.player');
    var bClose = U.el('button.lg.circle', { html: IC.close, 'aria-label': 'Close' });
    var bVer = U.el('button.lg.circle', { html: IC.tune, 'aria-label': 'Versions' });
    var bar = U.el('div.pbar', null, bClose, U.el('div.flex1'), bVer);
    var bigPlay = U.el('button.lg.circle.bigplay', { html: IC.play, 'aria-label': 'Play', hidden: true });
    var stage = U.el('div.pstage', null, video, U.el('div.pspin', null, U.el('div.spinner'), U.el('div.pmsg')), bigPlay);
    var tTitle = U.el('h1.ptitle');
    var tSub = U.el('div.ptsub');
    var next = U.el('div.nextcard.lg');
    var note = U.el('p.pnote', { hidden: true });
    var below = U.el('div.pbelow', null, U.el('div.ptext', null, tTitle, tSub), next, note);
    el.appendChild(bar); el.appendChild(stage); el.appendChild(below);

    var S = {
      meta: opts.meta, videoId: opts.videoId, ep: opts.ep, stream: opts.stream, streams: opts.streams || [],
      tried: [], position: 0, duration: 0, token: 0, closed: false, nextEp: undefined, countdown: null,
      cancelledNext: false, switching: false, fresh: false, saveTimer: null, loadTimer: null
    };
    cur = S;

    function titles() {
      tTitle.textContent = S.meta.name;
      if (series && S.ep) tSub.textContent = 'S' + S.ep.season + ', E' + S.ep.episode + ' · ' + (S.ep.title || S.ep.name || '');
      else if (series) { var p = S.videoId.split(':'); tSub.textContent = 'S' + p[1] + ', E' + p[2]; }
      else tSub.textContent = [S.meta.releaseInfo || S.meta.year, S.meta.runtime].filter(Boolean).join(' · ');
      // the name Safari's player and the lock screen show
      try {
        if ('mediaSession' in navigator && window.MediaMetadata) {
          var art = U.art(S.meta.id, 'poster', 'medium') || S.meta.poster;
          navigator.mediaSession.metadata = new MediaMetadata({ title: series && S.ep ? (S.ep.title || S.ep.name || S.meta.name) : S.meta.name, artist: series ? S.meta.name + ' · ' + tSub.textContent.split(' · ')[0] : (S.meta.releaseInfo || ''), album: 'Tra-la-la TV', artwork: art ? [{ src: art, sizes: '600x900', type: 'image/jpeg' }] : [] });
          navigator.mediaSession.setActionHandler('nexttrack', series ? function () { nextEp().then(function (ep) { if (ep) playNext(ep); }); } : null);
        }
      } catch (e) {}
    }
    function busy(on, text) { el.classList.toggle('loading', !!on); U.$('.pmsg', stage).textContent = text || ''; }

    // ---------- loading ----------
    function load(stream, startAt) {
      S.stream = stream; S.fresh = false;
      var token = ++S.token;
      var mine = function () { return token === S.token && !S.closed; };
      busy(true, '');
      clearTimeout(S.loadTimer);
      // debrid links can take a moment to start; give up on a dead link after 45 seconds
      S.loadTimer = setTimeout(function () { if (mine() && video.readyState < 2) fail('timeout'); }, 45000);
      setTimeout(function () { if (mine() && video.readyState < 2) busy(true, 'Still loading…'); }, 9000);
      video.onloadedmetadata = function () {
        if (!mine()) return;
        S.duration = (video.duration || 0) * 1000;
        if (startAt > 5000 && (!S.duration || startAt < S.duration - 10000)) { try { video.currentTime = startAt / 1000; } catch (e) {} }
      };
      video.onplaying = function () {
        if (!mine()) return;
        busy(false); clearTimeout(S.loadTimer);
        // sound with no picture means the iPhone can't decode this video track
        setTimeout(function () { if (mine() && video.videoWidth === 0 && !video.paused) fail('no video'); }, 2500);
      };
      video.onwaiting = function () { if (mine() && !video.paused) busy(true, ''); };
      video.oncanplay = function () { if (mine()) busy(false); };
      video.ontimeupdate = function () {
        if (!mine()) return;
        S.position = video.currentTime * 1000;
        if (video.duration) S.duration = video.duration * 1000;
        if (S.position > 1000) S.fresh = true;
        maybeNext();
      };
      video.onpause = function () { if (mine() && !S.switching && S.fresh) save(); };
      video.onended = function () { if (mine()) onEnded(); };
      video.onerror = function () { if (mine()) fail('error ' + (video.error && video.error.code)); };
      if (IPHONE) video.removeAttribute('playsinline');
      bigPlay.hidden = true;
      video.src = stream.url;
      try { video.load(); } catch (e) {}
      addSubtitles(token);
      var p = video.play();
      if (p && p.catch) p.catch(function (e) {
        // without a fresh tap iPhone may not open the full-screen player: offer the Play button
        if (mine() && e && e.name === 'NotAllowedError') { busy(false); bigPlay.hidden = false; }
      });
      if (IPHONE) setTimeout(function () { if (mine() && !fullscreenNow() && !pipNow() && (video.paused || video.readyState < 2)) { busy(false); bigPlay.hidden = false; } }, 6000);
    }
    bigPlay.onclick = function () {
      bigPlay.hidden = true;
      try { var p = video.play(); if (p && p.catch) p.catch(function () { bigPlay.hidden = false; }); } catch (e) {}
      try { if (IPHONE && video.readyState >= 1 && !fullscreenNow()) video.webkitEnterFullscreen(); } catch (e) {}
    };
    // closing the full-screen player (its X) brings you back to the show; swiping home keeps playing in Picture in Picture
    var leaveTimer = null;
    function presentationChanged() {
      clearTimeout(leaveTimer);
      if (!IPHONE || S.closed) return;
      leaveTimer = setTimeout(function () {
        if (S.closed || S.switching || video.ended || fullscreenNow() || pipNow()) return;
        if (!video.src) return;
        exit(true);
      }, 700);
    }
    video.addEventListener('webkitendfullscreen', presentationChanged);
    video.addEventListener('webkitpresentationmodechanged', presentationChanged);

    function fail(why) {
      if (S.closed) return;
      U.log('play failed', why);
      S.tried.push(S.stream.url);
      var alt = S.tried.length <= 3 ? Smart.best(S.streams, series, S.tried) : null;
      if (alt) { U.toast('That version wouldn’t play. Trying another…'); load(alt, S.position || opts.startAt || 0); return; }
      busy(false);
      U.toast(Smart.bestForVlc(S.streams, series) ? 'This one won’t play in the app. Pick a version, or open it in VLC.' : 'Couldn’t play this one. Try another version.', 5000);
      versions();
    }

    // ---------- subtitles: English from OpenSubtitles, listed in the player's own subtitle menu ----------
    function addSubtitles(token) {
      U.$$('track', video).forEach(function (t) { t.remove(); });
      var addons = (U.store.get('addons', []) || []).filter(function (a) {
        var m = a.manifest; if (!m) return false;
        return (m.resources || []).some(function (r) { return (typeof r === 'string' ? r : r.name) === 'subtitles'; });
      });
      if (!addons.length) return;
      var base = addons[0].transportUrl.replace(/\/manifest\.json$/, '');
      U.getJson(base + '/subtitles/' + (series ? 'series' : 'movie') + '/' + encodeURIComponent(S.videoId).replace(/%3A/gi, ':') + '.json', 15000).then(function (r) {
        if (token !== S.token) return;
        (r.subtitles || []).filter(function (x) { return x.lang === 'eng' || x.lang === 'en'; }).slice(0, 2).forEach(function (x, i) {
          fetch(x.url).then(function (res) { return res.text(); }).then(function (srt) {
            if (token !== S.token) return;
            var vtt = 'WEBVTT\n\n' + srt.replace(/\r/g, '').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
            var tr = U.el('track', { kind: 'subtitles', srclang: 'en', label: i ? 'English (Alternate)' : 'English', src: URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })) });
            video.appendChild(tr);
            setTimeout(function () { try { tr.track.mode = i === 0 && U.store.get('subsOn', false) ? 'showing' : 'disabled'; } catch (e) {} }, 300);
          }).catch(function () {});
        });
      }, function () {});
    }
    if (video.textTracks) video.textTracks.onchange = function () {
      if (!cur || !U.$('track', video)) return;
      U.store.set('subsOn', Array.prototype.some.call(video.textTracks, function (t) { return t.mode === 'showing'; }));
    };

    // ---------- progress ----------
    function info(position, duration) {
      return { id: S.meta.id, type: S.meta.type, name: S.meta.name, poster: S.meta.poster, videoId: S.videoId, position: Math.round(position), duration: Math.round(duration) };
    }
    function isFinished(pos, dur) { return dur > 120000 && (pos / dur >= (series ? 0.93 : 0.95) || dur - pos <= 90000); }
    function save() {
      if (S.position > 5000 && S.duration > 0 && !isFinished(S.position, S.duration)) Stremio.push(info(S.position, S.duration));
    }
    /** Mark finished; for a series, line up the next episode in Up Next (same rules as the TVs). */
    function complete() {
      var vid = S.videoId, dur = S.duration, known = S.nextEp, m = S.meta;
      Stremio.push({ id: m.id, type: m.type, name: m.name, poster: m.poster, videoId: vid, position: 0, duration: Math.round(dur) }).then(function () {
        if (!series) return;
        var find = known !== undefined ? Promise.resolve(known) : Stremio.nextEpisode(m.id, vid).catch(function () { return null; });
        return find.then(function (ep) {
          var lib = Stremio.findLocal(m.id);
          var watchingOther = lib && lib.state.video_id !== vid && lib.state.timeOffset > 5000;
          if (ep && !watchingOther && !(lib && lib.state.video_id === ep.id && lib.state.timeOffset > 5000)) {
            Stremio.push({ id: m.id, type: 'series', name: m.name, poster: m.poster, videoId: ep.id, position: 1, duration: 0 });
          }
        });
      });
    }
    function persist() {
      if (S.position > 5000 && S.duration > 0 && isFinished(S.position, S.duration)) complete();
      else save();
    }

    // ---------- next episode ----------
    function nextEp() {
      if (!series) return Promise.resolve(null);
      if (S.nextEp !== undefined) return Promise.resolve(S.nextEp);
      return Stremio.nextEpisode(S.meta.id, S.videoId).then(function (ep) { S.nextEp = ep; return ep; }, function () { S.nextEp = null; return null; });
    }
    function maybeNext() {
      if (!series || S.cancelledNext || S.countdown || S.switching || !S.fresh || !U.store.get('autoplay', true) || !S.duration) return;
      if (fullscreenNow() || pipNow()) return;
      if (S.position < S.duration * 0.95 && S.duration - S.position > 25000) return;
      nextEp().then(function (ep) { if (ep && !S.countdown && !S.cancelledNext && cur === S && !S.switching) startCountdown(ep); });
    }
    function startCountdown(ep) {
      var left = 10, from = S.videoId;
      next.innerHTML = '';
      var thumb = ep.thumbnail ? U.el('img.nthumb', { src: ep.thumbnail, alt: '' }) : null;
      var go = U.el('button.btn.primary.cap', { text: 'Play Now' });
      var no = U.el('button.btn.lgbtn.cap', { text: 'Cancel' });
      go.onclick = function () { if (S.videoId === from && S.countdown) playNext(ep); };
      no.onclick = function () {
        if (S.videoId !== from) return;
        S.cancelledNext = true; clearInterval(S.countdown); S.countdown = null; next.classList.remove('show');
      };
      next.appendChild(U.el('div.nrow', null, thumb, U.el('div.ntext', null,
        U.el('div.nk', { text: 'Up Next · S' + ep.season + ', E' + ep.episode }),
        U.el('div.nn', { text: ep.title || ep.name || ('Episode ' + ep.episode) }))));
      next.appendChild(U.el('div.nb', null, go, no));
      next.classList.add('show');
      var tick = function () {
        go.textContent = 'Play Now (' + left + ')';
        if (left-- <= 0 && S.videoId === from) playNext(ep);
      };
      tick();
      S.countdown = setInterval(tick, 1000);
    }
    function playNext(ep) {
      if (S.switching) return;
      S.switching = true;
      clearInterval(S.countdown); S.countdown = null;
      next.classList.remove('show'); next.innerHTML = '';
      complete();
      S.token++; // ignore anything more from the finished episode
      try { video.pause(); } catch (e) {}
      busy(true, 'Up Next · S' + ep.season + ', E' + ep.episode);
      Stremio.streams('series', ep.id).then(function (streams) {
        var pick = Smart.best(streams, true);
        if (!pick) { S.switching = false; busy(false); U.toast('The next episode isn’t ready to play in the app'); exit(false); return; }
        S.videoId = ep.id; S.ep = ep; S.streams = streams; S.tried = []; S.nextEp = undefined; S.cancelledNext = false;
        S.position = 0; S.duration = 0; S.switching = false;
        titles();
        load(pick, 0);
        nextEp();
      });
    }
    function onEnded() {
      if (series && U.store.get('autoplay', true) && !S.cancelledNext) {
        nextEp().then(function (ep) { if (ep) playNext(ep); else { S.position = S.duration; complete(); exit(false); } });
      } else { S.position = S.duration; complete(); exit(false); }
    }

    // ---------- versions ----------
    function versions() {
      var box = U.el('div.vers');
      var ranked = Smart.rank(S.streams, series);
      var here = ranked.filter(function (s) { var i = Smart.info(s); return i.ready && !i.problem && i.box !== 'other'; });
      var vlc = ranked.filter(function (s) { var i = Smart.info(s); return i.ready && !i.problem && i.box === 'other'; });
      function group(title, list, isVlc) {
        if (!list.length) return;
        box.appendChild(U.el('h3.grouptitle', { text: title }));
        var g = U.el('div.group');
        list.slice(0, 15).forEach(function (st) {
          var pills = U.el('div.vpills');
          Smart.badges(st).forEach(function (b) { pills.appendChild(U.el('span.vp', { text: b })); });
          if (Smart.size(st)) pills.appendChild(U.el('span.vs', { text: Smart.size(st) }));
          if (st.url === S.stream.url) pills.appendChild(U.el('span.vp.now', { text: 'Playing' }));
          var row = U.el('button.row.ver', null, U.el('div.row-text', null, pills, U.el('div.vt', { text: Smart.titleLine(st) }), U.el('div.row-s', { text: Smart.detailLine(st) })),
            isVlc ? U.el('span.vlcbadge', { html: IC.vlc + '<span>VLC</span>' }) : null);
          row.onclick = function () {
            Sheet.close();
            if (isVlc) { save(); try { video.pause(); } catch (e) {} Details.openVlc(st); return; }
            save(); S.tried = []; load(st, S.position);
          };
          g.appendChild(row);
        });
        box.appendChild(g);
      }
      group('Plays Here', here, false);
      group('Opens in VLC', vlc, true);
      if (!here.length && !vlc.length) box.appendChild(U.el('p.empty', { text: 'No other versions are ready.' }));
      Sheet.open('Versions', box, { tall: true, sub: tSub.textContent });
    }

    // ---------- open / close ----------
    function close(persistIt) {
      if (S.closed) return;
      if (persistIt) { S.position = (video.currentTime || 0) * 1000 || S.position; persist(); }
      S.closed = true;
      clearInterval(S.countdown); clearInterval(S.saveTimer); clearTimeout(S.loadTimer);
      ['onloadedmetadata', 'onplaying', 'onwaiting', 'oncanplay', 'ontimeupdate', 'onpause', 'onended', 'onerror'].forEach(function (k) { video[k] = null; });
      clearTimeout(leaveTimer);
      video.removeEventListener('webkitendfullscreen', presentationChanged);
      video.removeEventListener('webkitpresentationmodechanged', presentationChanged);
      try { if (pipNow()) { if (document.exitPictureInPicture && document.pictureInPictureElement) document.exitPictureInPicture(); else video.webkitSetPresentationMode('inline'); } } catch (e) {}
      try { if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen(); } catch (e) {}
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      U.$$('track', video).forEach(function (t) { t.remove(); });
      try { navigator.mediaSession.metadata = null; navigator.mediaSession.setActionHandler('nexttrack', null); } catch (e) {}
      if (cur === S) cur = null;
    }
    function exit(persistIt) { close(persistIt); if (Screens.top() === screen) Screens.pop(); }
    S.close = close;
    S.save = function () { if (!S.closed) { S.position = (video.currentTime || 0) * 1000 || S.position; save(); } };

    bClose.onclick = function () { exit(true); };
    bVer.onclick = versions;

    var screen = {
      el: el, name: 'player',
      onDestroy: function () {
        close(true);
        var d = Screens.stack.filter(function (x) { return x.name === 'details'; }).pop();
        if (d && d.refresh) setTimeout(d.refresh, 600);
      }
    };
    titles();
    if (!pipAvailable() && navigator.standalone && !U.store.get('pipNoteSeen', false)) {
      U.store.set('pipNoteSeen', true);
      note.hidden = false;
      note.textContent = 'Picture in Picture isn’t available when Tra-la-la TV runs as a Home Screen web app (an iOS limitation). Open it in Safari to use it.';
    }
    Screens.push(screen, { modal: true });
    S.saveTimer = setInterval(function () { if (!video.paused && !S.switching) save(); }, 15000);
    load(opts.stream, opts.startAt || 0);
    nextEp();
  }

  // leaving the app: save where you are
  document.addEventListener('visibilitychange', function () { if (cur && document.hidden) cur.save(); });
  window.addEventListener('pagehide', function () { if (cur) cur.save(); });

  return { open: open, prime: prime, active: function () { return !!cur; }, state: function () { return cur; } };
})();
