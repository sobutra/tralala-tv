/* Shared helpers (same API as the TV build, minus the remote-control key codes). */
'use strict';

var U = (function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** el('div.card.big', {attrs}, children...) */
  function el(spec, attrs) {
    var parts = spec.split('.');
    var node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style') node.setAttribute('style', v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') node[k] = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    kids.forEach(function (c) { append(node, c); });
    return node;
  }
  function append(node, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(node, x); }); return; }
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  function timeout(ms, promise) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function getJson(url, ms) {
    return timeout(ms || 12000, fetch(url)).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function postJson(url, body, ms) {
    return timeout(ms || 15000, fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })).then(function (r) { return r.json(); });
  }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function clock(ms) {
    ms = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(ms / 3600), m = Math.floor(ms % 3600 / 60), s = ms % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }
  function minutesLeft(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    if (m >= 60) return Math.floor(m / 60) + ' hr ' + (m % 60 ? (m % 60) + ' min ' : '') + 'left';
    return m + ' min left';
  }

  var toastTimer = null;
  function toast(text, ms) {
    var t = document.getElementById('toast');
    t.textContent = text;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, ms || 3200);
  }
  function debounce(fn, ms) {
    var t = null;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }
  /** Image URLs for an IMDb id, from the same image service Cinemeta uses. */
  function art(id, kind, size) {
    if (!id || id.indexOf('tt') !== 0) return null;
    return 'https://images.metahub.space/' + kind + '/' + (size || 'medium') + '/' + id + '/img';
  }
  function log() { try { console.log.apply(console, ['[lumera]'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }
  function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

  return { $: $, $$: $$, el: el, timeout: timeout, getJson: getJson, postJson: postJson, store: store,
    clock: clock, minutesLeft: minutesLeft, toast: toast, debounce: debounce, art: art, log: log, pad: pad, haptic: haptic };
})();
