/*
 * Stremio account, add-ons and library ("Continue Watching"): the same data the Stremio apps
 * and both TVs use, so progress follows you everywhere. Shared with the Samsung TV build.
 */
'use strict';

var Stremio = (function () {
  var API = 'https://api.strem.io/api/';
  var LINK = 'https://link.stremio.com/api/';
  var CINEMETA = 'https://v3-cinemeta.strem.io/manifest.json';

  var auth = U.store.get('auth', null);       // {authKey, email}
  var addons = U.store.get('addons', null);   // cached add-on collection
  var library = U.store.get('library', []);   // cached library items
  var lastPull = 0;

  function signedIn() { return !!(auth && auth.authKey); }
  function email() { return auth ? auth.email : ''; }

  function call(method, body) {
    return U.postJson(API + method, body, 20000).then(function (r) {
      if (r && r.error) throw new Error(r.error.message || 'Stremio error');
      return r ? r.result : null;
    });
  }

  function setAuth(key, mail) {
    auth = { authKey: key, email: mail || '' };
    U.store.set('auth', auth);
  }

  function login(mail, password) {
    return call('login', { type: 'Login', email: mail, password: password, facebook: false }).then(function (r) {
      setAuth(r.authKey, (r.user && r.user.email) || mail);
      return refreshAddons();
    });
  }

  /** Sign-in with a code shown on the TV and approved on a phone (link.stremio.com). */
  function linkCreate() {
    return U.getJson(LINK + 'create?type=Create', 15000).then(function (r) {
      var x = r.result || r;
      return { code: x.code, link: x.link, qrcode: x.qrcode };
    });
  }
  function linkRead(code) {
    return U.getJson(LINK + 'read?type=Read&code=' + encodeURIComponent(code), 15000).then(function (r) {
      var x = r && r.result;
      if (x && x.authKey) {
        setAuth(x.authKey, x.user && x.user.email);
        return call('getUser', { type: 'GetUser', authKey: x.authKey }).then(function (u) {
          if (u && u.email) setAuth(x.authKey, u.email);
          return refreshAddons();
        }, function () { return refreshAddons(); }).then(function () { return true; });
      }
      return false;
    });
  }

  function logout() {
    auth = null; addons = null; library = [];
    U.store.del('auth'); U.store.del('addons'); U.store.del('library');
  }

  // ---------- add-ons ----------

  function refreshAddons() {
    if (!signedIn()) return Promise.resolve(defaultAddons());
    return call('addonCollectionGet', { type: 'AddonCollectionGet', authKey: auth.authKey, update: true }).then(function (r) {
      if (r && Array.isArray(r.addons) && r.addons.length) {
        addons = r.addons;
        U.store.set('addons', addons);
      }
      return list();
    }, function () { return list(); });
  }
  function defaultAddons() { return [{ transportUrl: CINEMETA, manifest: null }]; }
  // add-ons that only run on a computer (Stremio's local server) can't be reached from a phone
  function reachable(a) { return !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(a.transportUrl || ''); }
  function list() { return addons && addons.length ? addons.filter(reachable) : defaultAddons(); }

  function base(a) { return a.transportUrl.replace(/\/manifest\.json$/, ''); }
  /** Ids go into add-on URLs as Stremio writes them: "tt0898266:9:17" stays readable. */
  function enc(id) { return encodeURIComponent(id).replace(/%3A/gi, ':'); }

  function supports(a, resource, type, id) {
    var m = a.manifest;
    if (!m) return resource === 'catalog' || resource === 'meta';
    var res = m.resources || [];
    for (var i = 0; i < res.length; i++) {
      var r = res[i];
      var name = typeof r === 'string' ? r : r.name;
      if (name !== resource) continue;
      var types = (typeof r === 'object' && r.types) || m.types || [];
      var prefixes = (typeof r === 'object' && r.idPrefixes) || m.idPrefixes || null;
      if (type && types.length && types.indexOf(type) < 0) continue;
      if (id && prefixes && prefixes.length && !prefixes.some(function (p) { return id.indexOf(p) === 0; })) continue;
      return true;
    }
    return false;
  }

  /** Catalogs that can be shown as rows (no required extras). */
  function catalogs() {
    var out = [];
    list().forEach(function (a) {
      var m = a.manifest;
      if (!m) {
        out.push({ addon: a, type: 'movie', id: 'top', name: 'Popular' });
        out.push({ addon: a, type: 'series', id: 'top', name: 'Popular' });
        return;
      }
      (m.catalogs || []).forEach(function (c) {
        var extras = c.extra || [];
        var required = extras.some(function (e) { return e.isRequired; }) || (c.extraRequired || []).length > 0;
        if (required) return;
        out.push({ addon: a, type: c.type, id: c.id, name: c.name || m.name, skip: extras.some(function (e) { return e.name === 'skip'; }) || (c.extraSupported || []).indexOf('skip') >= 0 });
      });
    });
    return out;
  }

  function searchCatalogs() {
    var out = [];
    list().forEach(function (a) {
      var m = a.manifest;
      if (!m) return;
      (m.catalogs || []).forEach(function (c) {
        var extras = c.extra || [];
        if (extras.some(function (e) { return e.name === 'search'; }) || (c.extraSupported || []).indexOf('search') >= 0) {
          out.push({ addon: a, type: c.type, id: c.id, name: c.name });
        }
      });
    });
    return out;
  }

  function clean(metas) {
    return (metas || []).filter(function (m) { return m && m.id && m.name && m.type && Filter.allows(m); });
  }

  function catalog(c, skip) {
    var url = base(c.addon) + '/catalog/' + c.type + '/' + c.id + (skip ? '/skip=' + skip : '') + '.json';
    return U.getJson(url, 12000).then(function (r) { return clean(r.metas); }, function () { return []; });
  }

  function search(q) {
    var cats = searchCatalogs();
    if (!cats.length) cats = [{ addon: { transportUrl: CINEMETA }, type: 'movie', id: 'top' }, { addon: { transportUrl: CINEMETA }, type: 'series', id: 'top' }];
    return Promise.all(cats.map(function (c) {
      var url = base(c.addon) + '/catalog/' + c.type + '/' + c.id + '/search=' + encodeURIComponent(q) + '.json';
      return U.getJson(url, 12000).then(function (r) { return clean(r.metas); }, function () { return []; });
    })).then(function (lists) {
      var seen = {}, out = [];
      lists.forEach(function (l) { l.forEach(function (m) { if (!seen[m.id]) { seen[m.id] = 1; out.push(m); } }); });
      return out;
    });
  }

  var metaCache = {};
  function meta(type, id) {
    var key = type + ':' + id;
    if (metaCache[key]) return Promise.resolve(metaCache[key]);
    var sources = list().filter(function (a) { return supports(a, 'meta', type, id); });
    if (!sources.length) sources = [{ transportUrl: CINEMETA }];
    var i = 0;
    function next() {
      if (i >= sources.length) return Promise.reject(new Error('No details found'));
      var a = sources[i++];
      return U.getJson(base(a) + '/meta/' + type + '/' + enc(id) + '.json', 15000).then(function (r) {
        if (!r || !r.meta) return next();
        metaCache[key] = r.meta;
        return r.meta;
      }, next);
    }
    return next();
  }

  /** Streams from every stream add-on, in parallel. Only direct links (debrid/HTTP), no P2P. */
  function streams(type, id) {
    var sources = list().filter(function (a) { return a.manifest && supports(a, 'stream', type, id); });
    return Promise.all(sources.map(function (a) {
      return U.getJson(base(a) + '/stream/' + type + '/' + enc(id) + '.json', 20000).then(function (r) {
        return (r.streams || []).filter(function (s) { return s && s.url && /^https?:/.test(s.url); }).map(function (s) {
          s._addon = a.manifest.name;
          return s;
        });
      }, function () { return []; });
    })).then(function (lists) { return [].concat.apply([], lists); });
  }

  // ---------- library / Continue Watching ----------

  function parseTime(s) {
    if (!s) return 0;
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }
  function iso(ms) { return new Date(ms).toISOString(); }

  function pull() {
    if (!signedIn()) return Promise.resolve(library);
    lastPull = Date.now();
    return call('datastoreGet', { authKey: auth.authKey, collection: 'libraryItem', ids: [], all: true }).then(function (items) {
      var mine = {};
      library.forEach(function (it) { mine[it._id] = it; });
      library = (items || []).filter(function (it) {
        return it && (it.type === 'movie' || it.type === 'series') && (!it.removed || it.temp) && it.state;
      }).map(function (it) {
        return {
          _id: it._id, name: it.name, type: it.type, poster: it.poster, removed: it.removed, temp: it.temp,
          state: { timeOffset: it.state.timeOffset || 0, duration: it.state.duration || 0, video_id: it.state.video_id || '', lastWatched: it.state.lastWatched || it._mtime }
        };
      }).map(function (it) {
        // a save made here that the server hasn't caught up with yet wins
        var local = mine[it._id];
        return local && parseTime(local.state.lastWatched) > parseTime(it.state.lastWatched) ? local : it;
      });
      Object.keys(mine).forEach(function (id) {
        if (!library.some(function (x) { return x._id === id; }) && Date.now() - parseTime(mine[id].state.lastWatched) < 120000) library.push(mine[id]);
      });
      U.store.set('library', library);
      return library;
    }, function () { return library; });
  }
  function pullIfStale(ms) { return Date.now() - lastPull > (ms || 20000) ? pull() : Promise.resolve(library); }

  /** Up Next entries: in-progress titles and "next episode" markers, newest first. */
  function upNext() {
    var out = [];
    library.forEach(function (it) {
      var s = it.state, off = s.timeOffset, dur = s.duration;
      var series = it.type === 'series';
      var donePct = series ? 0.93 : 0.95;
      var vid = series ? (s.video_id && s.video_id.indexOf(it._id + ':') === 0 ? s.video_id : null) : it._id;
      if (!vid) return;
      var when = parseTime(s.lastWatched);
      if (series && off >= 1 && off <= 5000) out.push({ id: it._id, type: it.type, name: it.name, poster: it.poster, videoId: vid, position: 0, duration: 0, when: when, next: true });
      else if (off > 5000 && dur > 0 && off < dur * donePct) out.push({ id: it._id, type: it.type, name: it.name, poster: it.poster, videoId: vid, position: off, duration: dur, when: when });
      else if (series && dur > 0 && off >= dur * donePct && Date.now() - when < 45 * 86400000) {
        var n = nextUpCache[vid];
        if (n) out.push({ id: it._id, type: it.type, name: it.name, poster: it.poster, videoId: n, position: 0, duration: 0, when: when, next: true });
      }
    });
    out.sort(function (a, b) { return b.when - a.when; });
    return out;
  }

  /** For series finished elsewhere: look up the episode after, so it can show as Next. */
  var nextUpCache = U.store.get('nextUp', {});
  function resolveFinished() {
    var jobs = [];
    library.forEach(function (it) {
      var s = it.state;
      if (it.type !== 'series' || !(s.duration > 0) || s.timeOffset < s.duration * 0.93) return;
      if (Date.now() - parseTime(s.lastWatched) > 45 * 86400000) return;
      if (nextUpCache[s.video_id] !== undefined || jobs.length >= 6) return;
      jobs.push(nextEpisode(it._id, s.video_id).then(function (ep) {
        nextUpCache[s.video_id] = ep ? ep.id : null;
      }, function () {}));
    });
    return Promise.all(jobs).then(function () { U.store.set('nextUp', nextUpCache); });
  }

  function episodes(m) {
    return (m.videos || []).filter(function (v) { return v.season > 0 && v.episode > 0; }).sort(function (a, b) {
      return a.season - b.season || a.episode - b.episode;
    });
  }
  function released(v) { var t = parseTime(v.released); return !t || t <= Date.now(); }

  function nextEpisode(seriesId, videoId) {
    return meta('series', seriesId).then(function (m) {
      var eps = episodes(m);
      for (var i = 0; i < eps.length - 1; i++) {
        if (eps[i].id === videoId) return released(eps[i + 1]) ? eps[i + 1] : null;
      }
      return null;
    });
  }

  function findLocal(id) {
    for (var i = 0; i < library.length; i++) if (library[i]._id === id) return library[i];
    return null;
  }

  /** Save a position on the account, in the same shape the Stremio apps write. */
  function push(info) {
    // info: {id, type, name, poster, videoId, position, duration}
    var now = Date.now();
    var local = findLocal(info.id);
    if (!local) {
      local = { _id: info.id, name: info.name, type: info.type, poster: info.poster, removed: true, temp: true, state: {} };
      library.push(local);
    }
    local.state.timeOffset = info.position;
    if (info.duration > 0) local.state.duration = info.duration;
    local.state.video_id = info.videoId;
    local.state.lastWatched = iso(now);
    U.store.set('library', library);
    if (!signedIn() || info.id.indexOf('tt') !== 0) return Promise.resolve();
    return call('datastoreGet', { authKey: auth.authKey, collection: 'libraryItem', ids: [info.id], all: false }).then(function (r) {
      var item = r && r[0];
      var stamp = iso(now);
      if (!item) {
        item = {
          _id: info.id, removed: true, temp: true, _ctime: stamp, name: info.name, type: info.type,
          poster: info.poster || '', posterShape: 'poster', background: '', logo: '', year: '',
          state: { timeWatched: 0, overallTimeWatched: 0, timesWatched: 0, flaggedWatched: 0, noNotif: false, season: 0, episode: 0 }
        };
      }
      item.state = item.state || {};
      item.state.timeOffset = info.position;
      if (info.duration > 0) item.state.duration = info.duration;
      item.state.video_id = info.videoId;
      item.state.lastWatched = stamp;
      item._mtime = stamp;
      return call('datastorePut', { authKey: auth.authKey, collection: 'libraryItem', changes: [item] });
    }).catch(function (e) { U.log('push failed', e.message); });
  }

  /** Progress for one playback id (episode or movie), 0..1 plus ms left. */
  function progressFor(id, videoId) {
    var it = findLocal(id);
    if (!it || it.state.video_id !== videoId) return null;
    var s = it.state;
    if (!(s.timeOffset > 5000 && s.duration > 0)) return null;
    return { position: s.timeOffset, duration: s.duration, ratio: s.timeOffset / s.duration };
  }

  return {
    signedIn: signedIn, email: email, login: login, linkCreate: linkCreate, linkRead: linkRead, logout: logout,
    refreshAddons: refreshAddons, catalogs: catalogs, catalog: catalog, search: search, meta: meta, streams: streams,
    pull: pull, pullIfStale: pullIfStale, upNext: upNext, resolveFinished: resolveFinished, push: push,
    progressFor: progressFor, findLocal: findLocal, nextEpisode: nextEpisode, episodes: episodes, released: released,
    library: function () { return library; }
  };
})();

/** Per-profile content rules (No Horror), applied to every catalog and search result. */
var Filter = {
  noHorror: false,
  allows: function (m) {
    if (!Filter.noHorror) return true;
    var g = m.genres || m.genre || [];
    for (var i = 0; i < g.length; i++) if (String(g[i]).toLowerCase() === 'horror') return false;
    return true;
  }
};
