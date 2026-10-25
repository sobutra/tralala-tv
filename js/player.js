/*
 * The player, built to behave like the iPhone TV app's (Apple's guidance for custom players:
 * match the system player so people's habits keep working). Full-bleed video; glass close and
 * option buttons; big play/pause between the 10-second skips; title and scrubber at the bottom.
 * Tap to show or hide the controls, double-tap a side to skip, swipe down to close.
 * Also: lock-screen and Control Center controls, English subtitles, audio and speed menus,
 * progress saved to Stremio, automatic fallback when a version won't play, and Up Next.
 */
'use strict';

var Player = (function () {
  var PI = {
    back10: '<svg viewBox="0 0 24 24"><path d="M11.99 5V1.5L7 6l5 4.5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/><text x="12.2" y="16.4" font-size="6.6" font-weight="700" text-anchor="middle" font-family="-apple-system,Helvetica,Arial">10</text></svg>',
    fwd10: '<svg viewBox="0 0 24 24"><path d="M12.01 5V1.5L17 6l-5 4.5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/><text x="11.8" y="16.4" font-size="6.6" font-weight="700" text-anchor="middle" font-family="-apple-system,Helvetica,Arial">10</text></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12.1-7.4a1 1 0 0 0 0-1.7L8.52 3.75A1 1 0 0 0 7 4.6z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="5.6" y="4" width="4.4" height="16" rx="1.3"/><rect x="14" y="4" width="4.4" height="16" rx="1.3"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M3 5h15a1 1 0 0 1 1 1v4h-2V7H4v10h6v2H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"/></svg>',
    airplay: '<svg viewBox="0 0 24 24"><path d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-3.2l-1.6-1.8H20V6H4v9.2h2.8L5.2 17H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm9 9 6 7H6z"/></svg>',
    cc: '<svg viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7H4zm6.5 3.2-.9.9a1.6 1.6 0 1 0 0 1.8l.9.9a2.9 2.9 0 1 1 0-3.6zm7 0-.9.9a1.6 1.6 0 1 0 0 1.8l.9.9a2.9 2.9 0 1 1 0-3.6z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/></svg>'
  };
  var cur = null;
  // One video element for the whole app. iPhone only lets a video start with sound after a tap;
  // once this element has been started from a tap, later episodes can start on their own.
  var video = U.el('video', { playsinline: true, 'webkit-playsinline': true, preload: 'auto', 'x-webkit-airplay': 'allow' });
  function prime() {
    if (cur) return;
    try { var p = video.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function pipAvailable() {
    try { if (video.webkitSupportsPresentationMode) return video.webkitSupportsPresentationMode('picture-in-picture'); } catch (e) {}
    return !!document.pictureInPictureEnabled;
  }

  function open(opts) {
    if (cur) cur.close(true);
    var series = opts.meta.type === 'series';
    var el = U.el('div.screen.player.ui');
    function gbtn(icon, label, cls) { return U.el('button.pbtn' + (cls ? '.' + cls : ''), { html: icon, 'aria-label': label }); }
    var bClose = gbtn(IC.close, 'Close', 'lg.dark.circle');
    var bPip = gbtn(PI.pip, 'Picture in Picture');
    var bAir = gbtn(PI.airplay, 'AirPlay');
    var bCC = gbtn(PI.cc, 'Subtitles');
    var group = U.el('div.pgroup.lg.dark', null, bPip, bAir, bCC);
    var bVer = gbtn(IC.tune, 'Versions', 'lg.dark.circle');
    var top = U.el('div.ptop', null, bClose, group, U.el('div.flex1'), bVer);
    var bBack = gbtn(PI.back10, 'Back 10 seconds', 'lg.dark.circle.skip');
    var bPlay = gbtn(PI.pause, 'Play or pause', 'lg.dark.circle.big');
    var bFwd = gbtn(PI.fwd10, 'Forward 10 seconds', 'lg.dark.circle.skip');
    var spin = U.el('div.pspin', null, U.el('div.spinner.large'));
    var center = U.el('div.pcenter', null, bBack, U.el('div.pmid', null, bPlay, spin), bFwd);
    var msg = U.el('div.pmsg');
    var tTitle = U.el('button.ptitle', null, U.el('span.ptn'), U.el('span.chev', { html: IC.chevron }));
    var tSub = U.el('div.ptsub');
    var bMore = gbtn(PI.more, 'More', 'lg.dark.circle');
    var infoRow = U.el('div.pinfo', null, U.el('div.ptext', null, tTitle, tSub), bMore);
    var track = U.el('div.ptrack', null, U.el('i.buf'), U.el('i.fill'), U.el('i.knob'));
    var tEl = U.el('span.pt'), tRem = U.el('span.pt.rem');
    var scrub = U.el('div.pscrub.lg.dark', null, tEl, track, tRem);
    var next = U.el('div.nextcard.lg.dark');
    var bottom = U.el('div.pbottom', null, next, infoRow, scrub);
    var flash = U.el('div.pflash');
    el.appendChild(video); el.appendChild(U.el('div.pshade')); el.appendChild(flash);
    el.appendChild(top); el.appendChild(center); el.appendChild(msg); el.appendChild(bottom);

    var S = {
      meta: opts.meta, videoId: opts.videoId, ep: opts.ep, stream: opts.stream, streams: opts.streams || [],
      tried: [], position: 0, duration: 0, token: 0, closed: false, nextEp: undefined, countdown: null,
      cancelledNext: false, switching: false, fresh: false, saveTimer: null, hideTimer: null, loadTimer: null, dragging: false
    };
    cur = S;

    function titles() {
      U.$('.ptn', tTitle).textContent = S.meta.name;
      if (series && S.ep) tSub.textContent = 'S' + S.ep.season + ', E' + S.ep.episode + ' · ' + (S.ep.title || S.ep.name || '');
      else if (series) { var p = S.videoId.split(':'); tSub.textContent = 'S' + p[1] + ', E' + p[2]; }
      else tSub.textContent = [S.meta.releaseInfo || S.meta.year, S.meta.runtime].filter(Boolean).join(' · ');
      mediaSession();
    }

    // ---------- lock screen and Control Center ----------
    function mediaSession() {
      if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
      try {
        var art = U.art(S.meta.id, 'poster', 'medium') || S.meta.poster;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: series && S.ep ? (S.ep.title || S.ep.name || S.meta.name) : S.meta.name,
          artist: series ? S.meta.name + ' · ' + tSub.textContent.split(' · ')[0] : (S.meta.releaseInfo || ''),
          album: 'Tra-la-la TV', artwork: art ? [{ src: art, sizes: '600x900', type: 'image/jpeg' }] : []
        });
        var ms = navigator.mediaSession, set = function (a, f) { try { ms.setActionHandler(a, f); } catch (e) {} };
        set('play', function () { video.play(); });
        set('pause', function () { video.pause(); });
        set('seekbackward', function () { jump(-10); });
        set('seekforward', function () { jump(10); });
        set('seekto', function (d) { if (d && d.seekTime != null) video.currentTime = d.seekTime; });
        set('nexttrack', series ? function () { nextEp().then(function (ep) { if (ep) playNext(ep); }); } : null);
      } catch (e) {}
    }

    // ---------- controls ----------
    function showUI(stay) {
      el.classList.add('ui');
      clearTimeout(S.hideTimer);
      if (!stay) S.hideTimer = setTimeout(function () { if (!video.paused && !S.dragging && !next.classList.contains('show') && !Sheet.isOpen()) el.classList.remove('ui'); }, 3200);
    }
    function hideUI() { if (!video.paused && !next.classList.contains('show')) { clearTimeout(S.hideTimer); el.classList.remove('ui'); } }
    function busy(on, text) {
      el.classList.toggle('loading', !!on);
      clearTimeout(S.msgTimer);
      msg.textContent = '';
      if (on && text) msg.textContent = text;
      else if (on) S.msgTimer = setTimeout(function () { if (el.classList.contains('loading')) msg.textContent = 'Still loading…'; }, 8000);
    }
    function setPlayIcon() { bPlay.innerHTML = video.paused ? PI.play : PI.pause; bPlay.setAttribute('aria-label', video.paused ? 'Play' : 'Pause'); }
    function toggle() { if (video.paused) { video.play().catch(function () {}); } else { video.pause(); } }
    function jump(sec) {
      if (!video.duration) return;
      video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + sec));
      flash.innerHTML = sec > 0 ? PI.fwd10 : PI.back10;
      flash.className = 'pflash show ' + (sec > 0 ? 'r' : 'l');
      clearTimeout(flash._t); flash._t = setTimeout(function () { flash.className = 'pflash ' + (sec > 0 ? 'r' : 'l'); }, 450);
      paint();
    }
    bPlay.onclick = function () { U.haptic(); toggle(); showUI(); };
    bBack.onclick = function () { U.haptic(); jump(-10); showUI(); };
    bFwd.onclick = function () { U.haptic(); jump(10); showUI(); };
    bClose.onclick = function () { exit(true); };
    tTitle.onclick = function () { exit(true); };
    bVer.onclick = function () { versions(); };
    bMore.onclick = function () { more(); };
    bCC.onclick = function () {
      var tr = video.textTracks;
      if (!tr || !tr.length) { U.toast('No English subtitles found for this one'); return; }
      var on = Array.prototype.some.call(tr, function (t) { return t.mode === 'showing'; });
      setSubs(on ? -1 : 0); U.haptic();
      U.toast(on ? 'Subtitles Off' : 'English Subtitles On');
    };
    // Picture in Picture and AirPlay, only where this iPhone offers them
    if (pipAvailable()) {
      bPip.onclick = function () {
        try {
          if (video.webkitSetPresentationMode) video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
          else (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()).catch(function () {});
        } catch (e) {}
      };
    } else bPip.hidden = true;
    if (window.WebKitPlaybackTargetAvailabilityEvent && video.webkitShowPlaybackTargetPicker) {
      bAir.onclick = function () { try { video.webkitShowPlaybackTargetPicker(); } catch (e) {} };
    } else bAir.hidden = true;

    // tap to show/hide, double-tap a side to skip, swipe down to close
    var lastTap = 0, lastTapX = 0, sy = 0, sx = 0, dy = 0, dragging = false, t0 = 0;
    el.addEventListener('click', function (e) {
      if (e.target.closest('button,.pscrub,.nextcard')) { showUI(); return; }
      var now = Date.now(), x = e.clientX, w = el.clientWidth;
      if (now - lastTap < 300 && Math.abs(x - lastTapX) < 90 && (x < w * 0.38 || x > w * 0.62)) {
        U.haptic(); jump(x < w / 2 ? -10 : 10); lastTap = 0; return;
      }
      lastTap = now; lastTapX = x;
      setTimeout(function () { if (lastTap === now) { if (el.classList.contains('ui')) hideUI(); else showUI(); } }, 310);
    });
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1 || e.target.closest('.pscrub,.nextcard')) return;
      sy = e.touches[0].clientY; sx = e.touches[0].clientX; dy = 0; dragging = false; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (!sy || S.dragging) return;
      var my = e.touches[0].clientY - sy, mx = e.touches[0].clientX - sx;
      if (!dragging) { if (my > 14 && my > Math.abs(mx) * 1.4) { dragging = true; el.style.transition = 'none'; } else return; }
      e.preventDefault();
      dy = Math.max(0, my);
      el.style.transform = 'translateY(' + dy + 'px) scale(' + (1 - Math.min(dy, 400) / 2600) + ')';
      el.style.borderRadius = Math.min(40, dy / 4) + 'px';
    }, { passive: false });
    el.addEventListener('touchend', function () {
      if (!dragging) { sy = 0; return; }
      dragging = false; sy = 0;
      var v = dy / Math.max(1, Date.now() - t0);
      el.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1), border-radius .32s';
      if (dy > 130 || v > 0.6) { U.haptic(); exit(true); return; }
      el.style.transform = ''; el.style.borderRadius = '';
      setTimeout(function () { el.style.transition = ''; }, 340);
    });

    // scrubbing
    function ratioAt(x) { var r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); }
    function paint(ratioOverride) {
      var d = video.duration || 0, t = ratioOverride !== undefined ? ratioOverride * d : video.currentTime || 0;
      var r = d ? t / d : 0;
      U.$('.fill', track).style.width = (r * 100) + '%';
      U.$('.knob', track).style.left = (r * 100) + '%';
      tEl.textContent = d ? U.clock(t * 1000) : '0:00';
      tRem.textContent = d ? '−' + U.clock(Math.max(0, d - t) * 1000) : '--:--';
      try { if (video.buffered.length && d) U.$('.buf', track).style.width = (video.buffered.end(video.buffered.length - 1) / d * 100) + '%'; } catch (e) {}
    }
    var dragR = 0;
    scrub.addEventListener('touchstart', function (e) { if (!video.duration) return; S.dragging = true; scrub.classList.add('drag'); dragR = ratioAt(e.touches[0].clientX); paint(dragR); showUI(true); }, { passive: true });
    scrub.addEventListener('touchmove', function (e) { if (!S.dragging) return; e.preventDefault(); dragR = ratioAt(e.touches[0].clientX); paint(dragR); }, { passive: false });
    scrub.addEventListener('touchend', function () {
      if (!S.dragging) return;
      S.dragging = false; scrub.classList.remove('drag');
      if (video.duration) video.currentTime = dragR * video.duration;
      showUI();
    });
    scrub.addEventListener('mousedown', function (e) { if (video.duration) { video.currentTime = ratioAt(e.clientX) * video.duration; paint(); } });

    // ---------- loading ----------
    function load(stream, startAt) {
      S.stream = stream; S.fresh = false;
      var token = ++S.token;
      var mine = function () { return token === S.token && !S.closed; };
      busy(true);
      clearTimeout(S.loadTimer);
      // debrid links can take a moment to start; give up on a dead link after 45 seconds
      S.loadTimer = setTimeout(function () { if (mine() && video.readyState < 2) fail('timeout'); }, 45000);
      video.onloadedmetadata = function () {
        if (!mine()) return;
        S.duration = (video.duration || 0) * 1000;
        if (startAt > 5000 && (!S.duration || startAt < S.duration - 10000)) { try { video.currentTime = startAt / 1000; } catch (e) {} }
        paint();
      };
      video.onplaying = function () {
        if (!mine()) return;
        busy(false); clearTimeout(S.loadTimer); setPlayIcon(); showUI();
        // sound with no picture means the iPhone can't decode this video track
        setTimeout(function () { if (mine() && video.videoWidth === 0 && !video.paused) fail('no video'); }, 2500);
      };
      video.onplay = setPlayIcon;
      video.onwaiting = function () { if (mine() && !video.paused) busy(true); };
      video.oncanplay = function () { if (mine() && (!video.paused || video.readyState >= 3)) busy(false); };
      video.onprogress = function () { if (mine() && !S.dragging) paint(); };
      video.ontimeupdate = function () {
        if (!mine()) return;
        S.position = video.currentTime * 1000;
        if (video.duration) S.duration = video.duration * 1000;
        if (S.position > 1000) S.fresh = true;
        if (!S.dragging) paint();
        maybeNext();
      };
      video.onpause = function () { if (!mine()) return; setPlayIcon(); if (!S.switching && S.fresh) save(); if (!video.ended) showUI(true); };
      video.onended = function () { if (mine()) onEnded(); };
      video.onerror = function () { if (mine()) fail('error ' + (video.error && video.error.code)); };
      video.src = stream.url;
      try { video.load(); } catch (e) {}
      addSubtitles(token);
      var p = video.play();
      if (p && p.catch) p.catch(function (e) {
        // iPhone can refuse to start without a fresh tap: show the play button, ready to go
        if (mine() && e && e.name === 'NotAllowedError') { busy(false); setPlayIcon(); showUI(true); }
      });
    }

    function fail(why) {
      if (S.closed) return;
      U.log('play failed', why);
      S.tried.push(S.stream.url);
      var alt = S.tried.length <= 3 ? Smart.best(S.streams, series, S.tried) : null;
      if (alt) { U.toast('That version wouldn’t play. Trying another…'); load(alt, S.position || opts.startAt || 0); return; }
      busy(false); setPlayIcon(); showUI(true);
      U.toast(Smart.bestForVlc(S.streams, series) ? 'This one won’t play in the app. Pick a version, or open it in VLC.' : 'Couldn’t play this one. Try another version.', 5000);
      versions();
    }

    // ---------- subtitles (English from OpenSubtitles, converted for iPhone) ----------
    function addSubtitles(token) {
      U.$$('track', video).forEach(function (t) { t.remove(); });
      paintCC();
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
            setTimeout(function () { try { tr.track.mode = i === 0 && U.store.get('subsOn', false) ? 'showing' : 'disabled'; } catch (e) {} paintCC(); }, 300);
          }).catch(function () {});
        });
      }, function () {});
    }
    function setSubs(index) {
      Array.prototype.forEach.call(video.textTracks || [], function (t, i) { t.mode = i === index ? 'showing' : 'disabled'; });
      U.store.set('subsOn', index >= 0);
      paintCC();
    }
    function paintCC() { bCC.classList.toggle('on', Array.prototype.some.call(video.textTracks || [], function (t) { return t.mode === 'showing'; })); }

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
      if (S.position < S.duration * 0.95 && S.duration - S.position > 25000) return;
      nextEp().then(function (ep) { if (ep && !S.countdown && !S.cancelledNext && cur === S && !S.switching) startCountdown(ep); });
    }
    function startCountdown(ep) {
      var left = 10, from = S.videoId;
      next.innerHTML = '';
      var thumb = ep.thumbnail ? U.el('img.nthumb', { src: ep.thumbnail, alt: '' }) : null;
      var go = U.el('button.btn.primary.cap', { text: 'Play Now' });
      var no = U.el('button.btn.lgbtn.cap', { text: 'Cancel' });
      go.onclick = function () { if (S.videoId === from && S.countdown) { U.haptic(); playNext(ep); } };
      no.onclick = function () {
        if (S.videoId !== from) return;
        S.cancelledNext = true; clearInterval(S.countdown); S.countdown = null; next.classList.remove('show'); el.classList.remove('nexting'); showUI();
      };
      next.appendChild(U.el('div.nrow', null, thumb, U.el('div.ntext', null,
        U.el('div.nk', { text: 'Up Next · S' + ep.season + ', E' + ep.episode }),
        U.el('div.nn', { text: ep.title || ep.name || ('Episode ' + ep.episode) }))));
      next.appendChild(U.el('div.nb', null, go, no));
      next.classList.add('show'); el.classList.add('nexting');
      showUI(true);
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
      next.classList.remove('show'); el.classList.remove('nexting'); next.innerHTML = '';
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

    // ---------- menus ----------
    function choice(label, on, fn) {
      return U.el('button.row.link' + (on ? '.on' : ''), { onclick: function () { U.haptic(); fn(); Sheet.close(); } }, U.el('div.row-t', { text: label }), U.el('span.check', { text: on ? '✓' : '' }));
    }
    function more() {
      var body = U.el('div');
      var tracks = Array.prototype.slice.call(video.textTracks || []);
      body.appendChild(U.el('h3.grouptitle.first', { text: 'Subtitles' }));
      var g = U.el('div.group');
      var showing = tracks.map(function (t) { return t.mode === 'showing'; }).indexOf(true);
      g.appendChild(choice('Off', showing < 0, function () { setSubs(-1); }));
      tracks.forEach(function (t, i) { g.appendChild(choice(t.label || 'English', showing === i, function () { setSubs(i); })); });
      if (!tracks.length) g.appendChild(U.el('div.row', null, U.el('div.row-s', { text: 'No English subtitles found for this one' })));
      body.appendChild(g);
      var at = video.audioTracks;
      if (at && at.length > 1) {
        body.appendChild(U.el('h3.grouptitle', { text: 'Audio' }));
        var ga = U.el('div.group');
        Array.prototype.forEach.call(at, function (a, i) {
          ga.appendChild(choice(a.label || a.language || ('Track ' + (i + 1)), a.enabled, function () { Array.prototype.forEach.call(at, function (x, j) { x.enabled = j === i; }); }));
        });
        body.appendChild(ga);
      }
      body.appendChild(U.el('h3.grouptitle', { text: 'Playback Speed' }));
      var gs = U.el('div.speeds');
      [0.75, 1, 1.25, 1.5, 2].forEach(function (r) {
        var b = U.el('button.speed' + (video.playbackRate === r ? '.on' : ''), { text: r + '×' });
        b.onclick = function () { U.haptic(); video.playbackRate = r; U.$$('.speed', gs).forEach(function (x) { x.classList.toggle('on', x === b); }); };
        gs.appendChild(b);
      });
      body.appendChild(gs);
      body.appendChild(U.el('h3.grouptitle', { text: 'More' }));
      var gp = U.el('div.group');
      if (series) gp.appendChild(U.el('button.row.link', { onclick: function () { Sheet.close(); setTimeout(episodes, 360); } }, U.el('div.row-t', { text: 'Episodes' }), U.el('span.chev', { html: IC.chevron })));
      gp.appendChild(U.el('button.row.link', { onclick: function () { Sheet.close(); setTimeout(versions, 360); } }, U.el('div.row-t', { text: 'Versions' }), U.el('span.chev', { html: IC.chevron })));
      gp.appendChild(U.el('button.row.link', { onclick: function () { Sheet.close(); save(); video.pause(); Details.openVlc(S.stream); } }, U.el('div.row-t', { text: 'Open in VLC' }), U.el('span.chev', { html: IC.chevron })));
      body.appendChild(gp);
      Sheet.open(S.meta.name, body, { sub: tSub.textContent, tall: true });
    }
    function episodes() {
      var body = U.el('div.group');
      Stremio.episodes(S.meta).filter(function (e) { return !S.ep || e.season === S.ep.season; }).forEach(function (e) {
        body.appendChild(choice('E' + e.episode + ' · ' + (e.title || e.name || ''), e.id === S.videoId, function () {
          if (e.id === S.videoId) return;
          save(); busy(true);
          Stremio.streams('series', e.id).then(function (streams) {
            var pick = Smart.best(streams, true);
            if (!pick) { busy(false); U.toast('That episode isn’t ready to play in the app'); return; }
            S.videoId = e.id; S.ep = e; S.streams = streams; S.tried = []; S.nextEp = undefined; S.cancelledNext = false; S.position = 0; S.duration = 0;
            titles(); load(pick, 0); nextEp();
          });
        }));
      });
      Sheet.open('Season ' + (S.ep ? S.ep.season : ''), body, { tall: true });
    }
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
      clearInterval(S.countdown); clearInterval(S.saveTimer); clearTimeout(S.hideTimer); clearTimeout(S.loadTimer); clearTimeout(S.msgTimer);
      ['onloadedmetadata', 'onplaying', 'onplay', 'onwaiting', 'oncanplay', 'onprogress', 'ontimeupdate', 'onpause', 'onended', 'onerror'].forEach(function (k) { video[k] = null; });
      try { if (video.webkitPresentationMode === 'picture-in-picture') video.webkitSetPresentationMode('inline'); } catch (e) {}
      try { video.pause(); video.playbackRate = 1; video.removeAttribute('src'); video.load(); } catch (e) {}
      U.$$('track', video).forEach(function (t) { t.remove(); });
      try { navigator.mediaSession.metadata = null; } catch (e) {}
      if (cur === S) cur = null;
    }
    function exit(persistIt) { close(persistIt); if (Screens.top() === screen) Screens.pop(); }
    S.close = close;
    S.save = function () { if (!S.closed) { S.position = (video.currentTime || 0) * 1000 || S.position; save(); } };

    var screen = {
      el: el, name: 'player',
      onDestroy: function () {
        close(true);
        var d = Screens.stack.filter(function (x) { return x.name === 'details'; }).pop();
        if (d && d.refresh) setTimeout(d.refresh, 600);
      }
    };
    titles();
    paint();
    Screens.push(screen, { modal: true });
    S.saveTimer = setInterval(function () { if (!video.paused && !S.switching) save(); }, 15000);
    load(opts.stream, opts.startAt || 0);
    nextEp();
  }

  // leaving the app: save where you are
  document.addEventListener('visibilitychange', function () { if (cur && document.hidden) cur.save(); });
  window.addEventListener('pagehide', function () { if (cur) cur.save(); });
  // Space bar on a keyboard plays and pauses, as Apple's guidelines expect
  document.addEventListener('keydown', function (e) { if (cur && e.code === 'Space' && !/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); if (video.paused) video.play(); else video.pause(); } });

  return { open: open, prime: prime, active: function () { return !!cur; }, state: function () { return cur; } };
})();
