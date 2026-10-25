/*
 * Tra-la-la TV for iPhone: the same app as the living room and bedroom TVs, built for touch.
 * Who's Watching on launch, Up Next from your Stremio account, rows from your add-ons,
 * one-tap Play that picks a version the iPhone can play, and a next-episode countdown.
 */
'use strict';

var IC = {
  home: '<svg viewBox="0 0 24 24"><path d="M12 3.2 3 10.4V21h6.2v-6.1h5.6V21H21V10.4z"/></svg>',
  film: '<svg viewBox="0 0 24 24"><path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v2h2V6H5zm12 0v2h2V6h-2zM5 10v4h2v-4H5zm12 0v4h2v-4h-2zM5 16v2h2v-2H5zm12 0v2h2v-2h-2zM9 6v12h6V6H9z"/></svg>',
  tv: '<svg viewBox="0 0 24 24"><path d="M3 5h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v1.5h3V21H7v-1.5h3V18H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v9h16V7H4z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15.4 4.6 8 12l7.4 7.4-1.4 1.4L5.2 12 14 3.2z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/></svg>',
  tune: '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  vlc: '<svg viewBox="0 0 24 24"><path d="M12 2.5 6.6 17.2c-.9.4-1.6 1-1.6 1.8 0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5c0-.8-.7-1.4-1.6-1.8zm-1.9 7.4h3.8l.8 2.3c-1.6.6-3.8.6-5.4 0zm-1.6 4.5c2.1.8 4.9.8 7 0l.9 2.6c-2.6 1-6.2 1-8.8 0z"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zm0 1.9c-3.6 0-7.4 1.8-7.4 4.3V20h14.8v-1.6c0-2.5-3.8-4.3-7.4-4.3z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M9.4 4.6 16.8 12l-7.4 7.4-1.4-1.4 6-6-6-6z"/></svg>'
};

/* ---------------- screens ---------------- */

/*
 * A navigation stack like UINavigationController. No browser history is used, so iPhone's
 * web-page swipe gestures have nothing to go back or forward to. Instead, pushed screens can
 * be dragged away from the left edge, following the finger, exactly like a native app.
 */
var Screens = (function () {
  var stack = [];
  var root;
  var EASE = 'cubic-bezier(.2,.8,.2,1)';
  function init() { root = document.getElementById('app'); }
  function top() { return stack[stack.length - 1] || null; }
  function push(s, opts) {
    opts = opts || {};
    var prev = top();
    var tip = document.querySelector('.installtip'); if (tip) tip.remove();
    ContextMenu.close();
    stack.push(s);
    s.el.classList.add('layer');
    if (opts.modal) s.el.classList.add('modal');
    if (!opts.instant && prev) s.el.classList.add('enter');
    root.appendChild(s.el);
    if (!opts.instant && prev) { void s.el.offsetWidth; setTimeout(function () { s.el.classList.remove('enter'); }, 16); }
    if (prev) {
      prev.el.classList.add('under');
      if (opts.modal) prev.el.classList.add('under-modal');
      if (prev.onHide) prev.onHide();
    }
    if (!opts.modal && prev) edgeSwipe(s);
    if (s.onShow) s.onShow();
  }
  function pop(opts) {
    opts = opts || {};
    if (stack.length < 2) return;
    var s = stack.pop();
    if (s.onDestroy) s.onDestroy();
    var prev = top();
    if (opts.dragged) {
      // finish the drag from where the finger left it
      s.el.style.transition = 'transform .28s ' + EASE;
      s.el.style.transform = 'translateX(100%)';
      prev.el.style.transition = 'transform .28s ' + EASE + ', filter .28s ' + EASE;
      prev.el.style.transform = ''; prev.el.style.filter = '';
      setTimeout(function () { prev.el.style.transition = ''; }, 300);
    } else s.el.classList.add('leave');
    setTimeout(function () { if (s.el.parentNode) s.el.parentNode.removeChild(s.el); }, 340);
    prev.el.classList.remove('under', 'under-modal');
    if (prev.onShow) prev.onShow();
  }
  /** Replace the whole stack with one screen (sign-in, main). */
  function reset(s) {
    while (stack.length) { var x = stack.pop(); if (x.onDestroy) x.onDestroy(); if (x.el.parentNode) x.el.parentNode.removeChild(x.el); }
    stack.push(s);
    s.el.classList.add('layer');
    root.appendChild(s.el);
    if (s.onShow) s.onShow();
  }

  /** Drag from the left edge to go back, with the screen underneath sliding in behind. */
  function edgeSwipe(s) {
    var el = s.el, startX = 0, startY = 0, t0 = 0, state = 0, dx = 0, w = 1, under = null;
    el.addEventListener('touchstart', function (e) {
      if (top() !== s || Sheet.isOpen() || e.touches.length > 1) return;
      var x = e.touches[0].clientX;
      if (x > 28) return;
      startX = x; startY = e.touches[0].clientY; t0 = Date.now(); state = 1; dx = 0; w = el.offsetWidth || window.innerWidth;
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (!state) return;
      var mx = e.touches[0].clientX - startX, my = e.touches[0].clientY - startY;
      if (state === 1) {
        if (Math.abs(my) > 12 && Math.abs(my) > mx) { state = 0; return; }
        if (mx < 8) return;
        state = 2;
        under = stack[stack.length - 2];
        el.style.transition = 'none';
        if (under) under.el.style.transition = 'none';
        el.classList.add('dragging');
      }
      e.preventDefault();
      dx = Math.max(0, mx);
      var p = Math.min(1, dx / w);
      el.style.transform = 'translateX(' + dx + 'px)';
      if (under) { under.el.style.transform = 'translateX(' + (-22 + 22 * p) + '%)'; under.el.style.filter = 'brightness(' + (.6 + .4 * p) + ')'; }
    }, { passive: false });
    function end() {
      if (state !== 2) { state = 0; return; }
      state = 0;
      el.classList.remove('dragging');
      var v = dx / Math.max(1, Date.now() - t0);
      if (dx > w * 0.33 || (v > 0.45 && dx > 40)) { U.haptic(); pop({ dragged: true }); return; }
      el.style.transition = 'transform .3s ' + EASE;
      el.style.transform = '';
      if (under) { under.el.style.transition = 'transform .3s ' + EASE + ', filter .3s ' + EASE; under.el.style.transform = ''; under.el.style.filter = ''; }
      setTimeout(function () { el.style.transition = ''; if (under) under.el.style.transition = ''; }, 320);
    }
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }
  return { init: init, push: push, pop: pop, reset: reset, top: top, stack: stack };
})();

/* ---------------- long-press menus ---------------- */

/*
 * Touch and hold a poster or an Up Next card: it lifts, everything else blurs, and a glass
 * menu of actions appears, like the iPhone TV app.
 */
var ContextMenu = (function () {
  var cur = null, suppressClick = 0;
  function attach(el, actions) {
    var timer = null, sx = 0, sy = 0;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length > 1) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      clearTimeout(timer);
      timer = setTimeout(function () { timer = null; open(el, actions()); }, 430);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (timer && (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
    }, { passive: true });
    el.addEventListener('touchend', function () { clearTimeout(timer); timer = null; });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('click', function (e) { if (Date.now() < suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  function open(el, actions) {
    close();
    U.haptic();
    suppressClick = Date.now() + 600;
    var r = el.getBoundingClientRect();
    var scrim = U.el('div.cm-scrim');
    var ghost = el.cloneNode(true);
    ghost.classList.add('cm-ghost');
    ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px'; ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
    var menu = U.el('div.cm-menu.lg', { role: 'menu' });
    actions.forEach(function (a) {
      var b = U.el('button.cm-item' + (a.danger ? '.danger' : ''), { role: 'menuitem' }, U.el('span', { text: a.label }), a.icon ? U.el('span.cm-ic', { html: a.icon }) : null);
      b.onclick = function () { close(); setTimeout(a.run, 120); };
      menu.appendChild(b);
    });
    scrim.onclick = close;
    document.body.appendChild(scrim); document.body.appendChild(ghost); document.body.appendChild(menu);
    var mh = actions.length * 50 + 12, vh = window.innerHeight;
    var below = r.bottom + 12 + mh < vh - 20;
    menu.style.left = Math.min(Math.max(12, r.left), window.innerWidth - 262) + 'px';
    menu.style.top = (below ? r.bottom + 12 : Math.max(20, r.top - mh - 12)) + 'px';
    menu.style.transformOrigin = (below ? 'top' : 'bottom') + ' left';
    void menu.offsetWidth;
    setTimeout(function () { scrim.classList.add('show'); ghost.classList.add('lift'); menu.classList.add('show'); }, 10);
    cur = { scrim: scrim, ghost: ghost, menu: menu };
  }
  function close() {
    if (!cur) return;
    var c = cur; cur = null;
    c.scrim.classList.remove('show'); c.ghost.classList.remove('lift'); c.menu.classList.remove('show');
    setTimeout(function () { c.scrim.remove(); c.ghost.remove(); c.menu.remove(); }, 260);
  }
  return { attach: attach, close: close };
})();

/* ---------------- bottom sheets ---------------- */

var Sheet = (function () {
  var cur = null;
  function open(title, body, opts) {
    close(true);
    opts = opts || {};
    var scrim = U.el('div.sheet-scrim');
    var sheet = U.el('div.sheet' + (opts.tall ? '.tall' : ''), { role: 'dialog', 'aria-label': title },
      U.el('div.grab'),
      U.el('div.sheet-head', null, U.el('h2', { text: title }), U.el('button.lg.circle.small', { html: IC.close, 'aria-label': 'Close', onclick: function () { close(); } })),
      opts.sub ? U.el('div.sheet-sub', { text: opts.sub }) : null,
      U.el('div.sheet-body', null, body));
    scrim.onclick = function () { close(); };
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    void sheet.offsetWidth;
    setTimeout(function () { scrim.classList.add('show'); sheet.classList.add('show'); }, 16);
    // drag the grabber down to dismiss
    var startY = null, dy = 0;
    sheet.addEventListener('touchstart', function (e) {
      var body = U.$('.sheet-body', sheet);
      if (body.scrollTop > 0 && !e.target.closest('.sheet-head,.grab')) return;
      startY = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    sheet.addEventListener('touchend', function () {
      if (startY === null) return;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 110) close();
      startY = null;
    });
    cur = { scrim: scrim, sheet: sheet, onClose: opts.onClose };
    return sheet;
  }
  function close(instant) {
    if (!cur) return;
    var c = cur; cur = null;
    if (c.onClose) c.onClose();
    if (instant) { c.scrim.remove(); c.sheet.remove(); return; }
    c.scrim.classList.remove('show'); c.sheet.classList.remove('show');
    setTimeout(function () { c.scrim.remove(); c.sheet.remove(); }, 340);
  }
  return { open: open, close: close, isOpen: function () { return !!cur; } };
})();

/** An iOS-style switch row. */
var NATIVE_SWITCH = 'switch' in document.createElement('input');
function toggleRow(id, label, sub, on, onChange) {
  var input = U.el('input', { id: id, type: 'checkbox', role: 'switch', switch: NATIVE_SWITCH ? true : null });
  input.checked = !!on;
  input.onchange = function () { U.haptic(); onChange(input.checked); };
  return U.el('label.row.toggle', { for: id }, U.el('div.row-text', null, U.el('div.row-t', { text: label }), sub ? U.el('div.row-s', { text: sub }) : null),
    NATIVE_SWITCH ? U.el('span.nswitch', null, input) : U.el('span.switch', null, input, U.el('i')));
}

/* ---------------- sign in ---------------- */

var SignIn = (function () {
  function screen() {
    var el = U.el('div.screen.signin');
    var form = U.el('form.form', { autocomplete: 'on' });
    var email = U.el('input.field', { id: 'si-email', type: 'email', placeholder: 'Email', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', inputmode: 'email', enterkeyhint: 'next' });
    var pass = U.el('input.field', { id: 'si-pass', type: 'password', placeholder: 'Password', autocomplete: 'current-password', enterkeyhint: 'go' });
    var btn = U.el('button.btn.primary.wide', { type: 'submit', text: 'Sign In' });
    var err = U.el('div.form-err', { role: 'alert' });
    form.appendChild(U.el('label.lbl', { for: 'si-email', text: 'Email' }));
    form.appendChild(email);
    form.appendChild(U.el('label.lbl', { for: 'si-pass', text: 'Password' }));
    form.appendChild(pass);
    form.appendChild(err);
    form.appendChild(btn);
    form.onsubmit = function (e) {
      e.preventDefault();
      err.textContent = '';
      if (!email.value || !pass.value) { err.textContent = 'Enter the email and password of your Stremio account.'; return; }
      btn.disabled = true; btn.textContent = 'Signing In…';
      Stremio.login(email.value.trim(), pass.value).then(function () {
        pass.value = '';
        return Stremio.pull();
      }).then(function () { App.afterSignIn(); }, function (x) {
        btn.disabled = false; btn.textContent = 'Sign In';
        err.textContent = /password|user|wrong|not found|invalid/i.test(x.message) ? 'That email and password didn’t match a Stremio account. Check them and try again.' : 'Couldn’t reach Stremio. Check your connection and try again.';
      });
    };
    el.appendChild(U.el('img.mark', { src: 'icons/icon-192.png', alt: 'Tra-la-la TV' }));
    el.appendChild(U.el('h1.who', { text: 'Sign in to Stremio' }));
    el.appendChild(U.el('p.lede', { text: 'Use the same account as your TVs. Up Next, add-ons and progress all come along.' }));
    el.appendChild(form);
    el.appendChild(U.el('p.fine', { text: 'Your password goes only to Stremio and isn’t saved on this iPhone.' }));
    return { el: el, name: 'signin' };
  }
  return { screen: screen };
})();

/* ---------------- browse (tabs) ---------------- */

var Browse = (function () {
  var TABS = [
    { id: 'home', label: 'Home', icon: IC.home, title: 'Home' },
    { id: 'movie', label: 'Movies', icon: IC.film, title: 'Movies' },
    { id: 'series', label: 'TV Shows', icon: IC.tv, title: 'TV Shows' },
    { id: 'search', label: 'Search', icon: IC.search, title: 'Search' }
  ];

  function screen() {
    var el = U.el('div.screen.browse');
    var panes = {};
    var tabs = U.el('div.tabs.lg', { role: 'tablist' });
    var pill = U.el('span.tabpill');
    tabs.appendChild(pill);
    var searchBtn = U.el('button.tab.searchtab.lg', { 'data-tab': 'search', 'aria-label': 'Search', html: IC.search });
    var bar = U.el('nav.tabbar', { 'aria-label': 'Sections' }, tabs, searchBtn);
    var active = null;
    TABS.forEach(function (t) {
      var b = t.id === 'search' ? searchBtn : U.el('button.tab', { 'data-tab': t.id, 'aria-label': t.label, role: 'tab' }, U.el('span.ti', { html: t.icon }), U.el('span.tl', { text: t.label }));
      b.onclick = function () {
        if (bar.classList.contains('mini')) { bar.classList.remove('mini'); if (active === t.id) return; }
        if (active === t.id) { var p = panes[t.id]; if (p) p.el.scrollTo({ top: 0, behavior: 'smooth' }); if (t.id === 'search' && p) p.focus(); return; }
        U.haptic(); show(t.id);
      };
      if (t.id !== 'search') tabs.appendChild(b);
    });
    function placePill() {
      var on = U.$('.tab.on', tabs);
      pill.style.opacity = on ? 1 : 0;
      if (on) { pill.style.width = on.offsetWidth + 'px'; pill.style.transform = 'translateX(' + (on.offsetLeft - 4) + 'px)'; }
    }
    window.addEventListener('resize', function () { setTimeout(placePill, 50); });
    // the tab bar shrinks while you scroll down and comes back when you scroll up
    var lastY = 0;
    el.addEventListener('scroll', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('pane')) return;
      var y = t.scrollTop;
      if (y > lastY + 6 && y > 120) bar.classList.add('mini');
      else if (y < lastY - 6 || y < 60) bar.classList.remove('mini');
      lastY = y;
      requestAnimationFrame(function () { setTimeout(placePill, 360); });
    }, true);
    function show(id) {
      active = id; lastY = 0;
      bar.classList.remove('mini');
      U.$$('.tab', bar).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === id); });
      setTimeout(placePill, 0);
      Object.keys(panes).forEach(function (k) { panes[k].el.hidden = k !== id; });
      if (!panes[id]) {
        var t = TABS.filter(function (x) { return x.id === id; })[0];
        panes[id] = id === 'search' ? searchPane() : rowsPane(t);
        el.insertBefore(panes[id].el, bar);
      }
      panes[id].el.hidden = false;
      if (panes[id].onShow) panes[id].onShow();
    }
    el.appendChild(bar);
    show('home');
    return {
      el: el, name: 'browse',
      onShow: function () { var p = panes[active]; if (p && p.onShow) p.onShow(); },
      rebuild: function () { Object.keys(panes).forEach(function (k) { panes[k].el.remove(); }); panes = {}; show(active || 'home'); }
    };
  }

  function header(title) {
    var btn = U.el('button.me.lg.circle', { html: IC.person, 'aria-label': 'Settings' });
    btn.onclick = function () { U.haptic(); Settings.open(); };
    return [U.el('div.navbar', { 'aria-hidden': 'true' }, U.el('span', { text: title })), U.el('header.bigtitle', null, U.el('h1', { text: title }), btn)];
  }
  /** Large title on top; a compact title bar fades in once it scrolls out of view (iOS style). */
  function collapsingTitle(pane) {
    var on = false;
    pane.addEventListener('scroll', function () {
      var now = pane.scrollTop > 44;
      if (now !== on) { on = now; pane.classList.toggle('scrolled', on); }
    }, { passive: true });
  }

  function rowsPane(tab) {
    var el = U.el('div.pane', { 'data-pane': tab.id });
    header(tab.title).forEach(function (x) { el.appendChild(x); });
    collapsingTitle(el);
    var refresher = U.el('div.ptr', null, U.el('div.spinner'));
    el.insertBefore(refresher, el.firstChild);
    var upWrap = U.el('section.shelf.upnext');
    if (tab.id === 'home') el.appendChild(upWrap);
    var rowsBox = U.el('div.rows');
    el.appendChild(rowsBox);
    el.appendChild(U.el('div.tabpad'));
    var built = false;

    function buildRows() {
      built = true;
      rowsBox.innerHTML = '';
      var cats = Stremio.catalogs().filter(function (c) { return tab.id === 'home' ? (c.type === 'movie' || c.type === 'series') : c.type === tab.id; });
      if (tab.id === 'home') {
        // alternate movies and shows, like the TV
        var mv = cats.filter(function (c) { return c.type === 'movie'; }), sr = cats.filter(function (c) { return c.type === 'series'; });
        cats = [];
        for (var i = 0; i < Math.max(mv.length, sr.length); i++) { if (mv[i]) cats.push(mv[i]); if (sr[i]) cats.push(sr[i]); }
      }
      if (!cats.length) { rowsBox.appendChild(U.el('p.empty', { text: 'No catalogs yet. Add some in Stremio and they’ll show up here.' })); return; }
      cats.forEach(function (c) { rowsBox.appendChild(catalogRow(c, tab.id === 'home')); });
      setTimeout(lazyRows, 0);
    }
    function lazyRows() {
      if (el.hidden) return;
      var limit = window.innerHeight + 900;
      U.$$('.shelf', rowsBox).forEach(function (sec) { if (!sec._started && sec._load && sec.getBoundingClientRect().top < limit) sec._load(); });
    }
    var pullMax = 0, refreshing = false;
    el.addEventListener('scroll', function () { if (el.scrollTop < pullMax) pullMax = el.scrollTop; refresher.style.opacity = Math.min(1, -el.scrollTop / 70); }, { passive: true });
    el.addEventListener('touchstart', function () { pullMax = 0; }, { passive: true });
    el.addEventListener('touchend', function () {
      if (pullMax < -72 && !refreshing) {
        refreshing = true; U.haptic(); el.classList.add('refreshing');
        Promise.all([Stremio.pull(), Stremio.refreshAddons()]).then(function () { return Stremio.resolveFinished(); }).then(function () {
          renderUpNext(); buildRows();
        }).catch(function () { U.toast('Couldn’t refresh. Check your connection.'); }).then(function () {
          refreshing = false; el.classList.remove('refreshing');
        });
      }
      pullMax = 0;
    });
    var lazyTick = null;
    el.addEventListener('scroll', function () { if (!lazyTick) lazyTick = setTimeout(function () { lazyTick = null; lazyRows(); }, 120); }, { passive: true });
    function renderUpNext() {
      if (tab.id !== 'home') return;
      var items = Stremio.upNext();
      upWrap.innerHTML = '';
      if (!items.length) { upWrap.hidden = true; return; }
      upWrap.hidden = false;
      upWrap.appendChild(U.el('h2.rowtitle', { text: 'Up Next' }));
      var track = U.el('div.track.land');
      items.slice(0, 20).forEach(function (it) { track.appendChild(upNextCard(it)); });
      upWrap.appendChild(track);
      items.slice(0, 2).forEach(function (it) { Stremio.streams(it.type, it.videoId); });
    }
    return {
      el: el,
      onShow: function () {
        if (!built) buildRows();
        renderUpNext();
        setTimeout(lazyRows, 0);
        Stremio.pullIfStale(15000).then(function () { return Stremio.resolveFinished(); }).then(renderUpNext);
      }
    };
  }

  function rowName(c, mixed) {
    var n = String(c.name || '').replace(/\s+/g, ' ').trim();
    var kind = c.type === 'movie' ? 'Movies' : 'TV Shows';
    if (/\b(movies?|films?|series|shows?)\b/i.test(n)) return n;
    return n + ' ' + kind;
  }

  function catalogRow(c, mixed) {
    var sec = U.el('section.shelf');
    var head = U.el('h2.rowtitle', null, U.el('button.seeall', { html: '<span>' + rowName(c, mixed).replace(/[<&]/g, '') + '</span>' + IC.chevron, onclick: function () { Grid.open(c, rowName(c, mixed)); } }));
    var track = U.el('div.track.posters');
    for (var i = 0; i < 6; i++) track.appendChild(U.el('div.card.poster.skel'));
    sec.appendChild(head); sec.appendChild(track);
    var loaded = 0, loading = false, done = false, pool = [];
    function add(metas) {
      metas.forEach(function (m) { track.appendChild(posterCard(m)); });
    }
    function first() {
      loading = true;
      // show the last saved copy at once, then swap in the fresh list if it changed
      var cached = Stremio.cachedCatalog(c), shown = '';
      if (cached && cached.length) {
        track.innerHTML = ''; pool = cached.slice(12); add(cached.slice(0, 12)); loaded = cached.length;
        shown = cached.slice(0, 12).map(function (m) { return m.id; }).join();
      }
      Stremio.catalog(c).then(function (metas) {
        loading = false;
        if (!metas.length) { if (!shown) sec.remove(); return; }
        loaded = metas.length; done = metas.length < 12;
        if (shown && metas.slice(0, 12).map(function (m) { return m.id; }).join() === shown) { pool = metas.slice(12); return; }
        track.innerHTML = ''; track.scrollLeft = 0;
        pool = metas.slice(12); add(metas.slice(0, 12));
      });
    }
    function more() {
      if (loading || done) return;
      if (pool.length) { add(pool.splice(0, 12)); return; }
      if (!c.skip) { done = true; return; }
      loading = true;
      Stremio.catalog(c, loaded).then(function (metas) {
        loading = false;
        if (!metas.length) { done = true; return; }
        loaded += metas.length; add(metas);
      });
    }
    track.addEventListener('scroll', function () {
      if (track.scrollLeft + track.clientWidth > track.scrollWidth - 600) more();
    }, { passive: true });
    // rows load as they come near the screen (see lazyRows)
    sec._load = function () { if (!sec._started) { sec._started = true; first(); } };
    return sec;
  }

  function img(src, cls) {
    var i = U.el('img.fade' + (cls ? '.' + cls : ''), { src: src || '', alt: '', loading: 'lazy', decoding: 'async' });
    i.onload = function () { i.classList.add('in'); };
    i.onerror = function () { i.style.visibility = 'hidden'; };
    if (!src) i.style.visibility = 'hidden';
    if (i.complete && src) i.classList.add('in');
    return i;
  }

  function posterCard(m) {
    var poster = (m.poster && m.poster.indexOf('metahub') < 0 ? m.poster : U.art(m.id, 'poster', 'small')) || m.poster;
    var b = U.el('button.card.poster', { 'aria-label': m.name }, U.el('span.pname2', { text: m.name }), img(poster));
    b.onclick = function () { U.haptic(); Details.open(m); };
    ContextMenu.attach(b, function () {
      return [
        { label: 'Play', icon: IC.play, run: function () { Player.prime(); Details.open(m, { play: true }); } },
        { label: m.type === 'series' ? 'Go to Show' : 'Go to Movie', icon: IC.chevron, run: function () { Details.open(m); } }
      ];
    });
    return b;
  }

  function upNextCard(it) {
    var parts = it.videoId.split(':');
    var ep = it.type === 'series' && parts.length >= 3 ? 'S' + parts[1] + ', E' + parts[2] : '';
    var pct = it.duration ? Math.max(3, Math.round(it.position / it.duration * 100)) : 0;
    var logo = U.art(it.id, 'logo', 'medium');
    var t = U.el('div.lbl', null, logo ? img(logo, 'logo') : null, U.el('div.n', { text: it.name }));
    var left = it.duration ? shortLeft(it.duration - it.position) : '';
    var foot = pct
      ? U.el('div.meta', null, U.el('span.pi', { html: IC.play }), U.el('div.bar.mini', null, U.el('i', { style: 'width:' + pct + '%' })), U.el('span', { text: (ep ? ep + ' · ' : '') + left }))
      : U.el('div.meta', null, U.el('span', { text: it.next ? (ep ? 'Next · ' + ep : 'Next') : ep }));
    var dots = U.el('button.carddots', { html: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>', 'aria-label': 'Options for ' + it.name });
    var b = U.el('div.card.land', { role: 'button', tabindex: '0', 'aria-label': it.name + (ep ? ' ' + ep : '') },
      img(U.art(it.id, 'background', 'medium') || it.poster, 'bg'), U.el('div.shade'), t, U.el('div.foot', null, foot, dots));
    var lg = U.$('img.logo', b);
    if (lg) { lg.onload = function () { U.$('.n', b).classList.add('hide'); }; lg.onerror = function () { lg.remove(); }; }
    b.onclick = function () {
      U.haptic();
      var m = { id: it.id, type: it.type, name: it.name, poster: it.poster };
      var ready = Stremio.streamsReady(it.type, it.videoId), pick = ready && Smart.best(ready, it.type === 'series');
      if (pick) {
        // play inside this tap so iPhone opens its full-screen player; the show page sits underneath
        Details.open(m);
        Player.open({ meta: m, videoId: it.videoId, ep: null, stream: pick, streams: ready, startAt: it.position > 5000 ? it.position : 0 });
        return;
      }
      Player.prime();
      Details.open(m, { autoplay: { videoId: it.videoId, position: it.position } });
    };
    ContextMenu.attach(b, function () {
      return [
        { label: it.duration ? 'Resume' : 'Play', icon: IC.play, run: function () { b.click(); } },
        { label: it.type === 'series' ? 'Go to Show' : 'Go to Movie', icon: IC.chevron, run: function () { Details.open({ id: it.id, type: it.type, name: it.name, poster: it.poster }); } },
        { label: 'Remove from Up Next', icon: IC.close, danger: true, run: function () { Stremio.push({ id: it.id, type: it.type, name: it.name, poster: it.poster, videoId: it.videoId, position: 0, duration: 0 }); b.remove(); U.toast('Removed from Up Next'); } }
      ];
    });
    dots.onclick = function (e) {
      e.stopPropagation();
      var g = U.el('div.group',
        null,
        U.el('button.row.link', { onclick: function () { Sheet.close(); Details.open({ id: it.id, type: it.type, name: it.name, poster: it.poster }); } }, U.el('div.row-t', { text: 'Go to ' + (it.type === 'series' ? 'Show' : 'Movie') }), U.el('span.chev', { html: IC.chevron })),
        U.el('button.row.link.danger', { onclick: function () {
          Sheet.close();
          Stremio.push({ id: it.id, type: it.type, name: it.name, poster: it.poster, videoId: it.videoId, position: 0, duration: 0 });
          b.remove(); U.toast('Removed from Up Next');
        } }, U.el('div.row-t', { text: 'Remove from Up Next' })));
      Sheet.open(it.name, g, { sub: ep || null });
    };
    return b;
  }
  function shortLeft(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60 ? (m % 60) + 'm' : '') : m + 'm';
  }

  function searchPane() {
    var el = U.el('div.pane.search', { 'data-pane': 'search' });
    header('Search').forEach(function (x) { el.appendChild(x); });
    collapsingTitle(el);
    var input = U.el('input.searchfield', { id: 'q', type: 'search', placeholder: 'Movies and TV shows', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search' });
    var wrap = U.el('div.searchwrap.lg', null, U.el('span.si', { html: IC.search }), input);
    el.appendChild(wrap);
    var res = U.el('div.grid');
    var note = U.el('p.empty', { text: 'Search across all your add-ons.' });
    el.appendChild(note);
    el.appendChild(res);
    el.appendChild(U.el('div.tabpad'));
    var seq = 0;
    var run = U.debounce(function () {
      var q = input.value.trim();
      var mine = ++seq;
      if (q.length < 2) { res.innerHTML = ''; note.hidden = false; note.textContent = 'Search across all your add-ons.'; return; }
      note.hidden = false; note.textContent = 'Searching…';
      Stremio.search(q).then(function (list) {
        if (mine !== seq) return;
        res.innerHTML = '';
        note.hidden = !!list.length;
        note.textContent = 'Nothing found for “' + q + '”.';
        list.slice(0, 60).forEach(function (m) { res.appendChild(posterCard(m)); });
      });
    }, 450);
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    return { el: el, focus: function () { input.focus(); } };
  }

  return { screen: screen, posterCard: posterCard };
})();

/* ---------------- see all ---------------- */

var Grid = (function () {
  function open(c, title) {
    var el = U.el('div.screen.gridpage');
    var sc = U.el('div.pane');
    var grid = U.el('div.grid');
    sc.appendChild(U.el('div.navbar', { 'aria-hidden': 'true' }, U.el('span', { text: title })));
    sc.appendChild(U.el('header.bigtitle.sub', null, U.el('h1', { text: title })));
    sc.addEventListener('scroll', function () { sc.classList.toggle('scrolled', sc.scrollTop > 60); }, { passive: true });
    sc.appendChild(grid);
    sc.appendChild(U.el('div.tabpad'));
    el.appendChild(sc);
    el.appendChild(U.el('button.lg.circle.backbtn', { html: IC.back, 'aria-label': 'Back', onclick: function () { Screens.pop(); } }));
    var loaded = 0, loading = false, done = false;
    function more() {
      if (loading || done) return;
      loading = true;
      Stremio.catalog(c, loaded || undefined).then(function (metas) {
        loading = false;
        if (!metas.length || !c.skip) done = true;
        loaded += metas.length;
        metas.forEach(function (m) { grid.appendChild(Browse.posterCard(m)); });
      });
    }
    sc.addEventListener('scroll', function () { if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 900) more(); }, { passive: true });
    Screens.push({ el: el, name: 'grid' });
    more();
  }
  return { open: open };
})();

/* ---------------- settings ---------------- */

var Settings = (function () {
  function open() {
    var body = U.el('div.settings');
    body.appendChild(U.el('h3.grouptitle.first', { text: 'Content' }));
    body.appendChild(U.el('div.group', null, toggleRow('st-nh', 'No Horror', 'Hide horror movies and shows everywhere in the app', Filter.noHorror, function (v) {
      Filter.noHorror = v; U.store.set('noHorror', v); App.contentChanged();
    })));
    body.appendChild(U.el('h3.grouptitle', { text: 'Playback' }));
    body.appendChild(U.el('div.group', null,
      toggleRow('st-auto', 'Autoplay Next Episode', 'Counts down from 10 at the end of an episode', U.store.get('autoplay', true), function (v) { U.store.set('autoplay', v); }),
      toggleRow('st-subs', 'English Subtitles', 'Turn on English subtitles when a video starts', U.store.get('subsOn', false), function (v) { U.store.set('subsOn', v); })));
    body.appendChild(U.el('p.foot-note', { text: 'Versions that only play in VLC open in the free VLC app. Progress from VLC doesn’t sync back. Picture in Picture isn’t available to Home Screen web apps on iOS 26.' }));
    body.appendChild(U.el('h3.grouptitle', { text: 'Stremio Account' }));
    body.appendChild(U.el('div.group', null,
      U.el('div.row', null, U.el('div.row-t', { text: Stremio.email() || 'Signed in' })),
      U.el('button.row.link.danger', { onclick: function () { Stremio.logout(); Sheet.close(); App.start(); } }, U.el('div.row-t', { text: 'Sign Out' }))));
    body.appendChild(U.el('p.foot-note', { text: 'You stay signed in on this iPhone, even from the Home Screen icon. Sign Out to switch accounts.' }));
    body.appendChild(U.el('p.foot-note.center', { text: 'Tra-la-la TV ' + App.version + ' · The same app as your living room and bedroom TVs.' }));
    Sheet.open('Settings', body, { tall: true });
  }
  return { open: open };
})();

/* ---------------- details ---------------- */

var Details = (function () {
  var UPDOWN = '<svg viewBox="0 0 24 24"><path d="M12 3.5 6.8 8.7l1.4 1.4L12 6.3l3.8 3.8 1.4-1.4zM12 20.5l5.2-5.2-1.4-1.4-3.8 3.8-3.8-3.8-1.4 1.4z"/></svg>';
  var MORE = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  function epName(v) { return v.title || v.name || ('Episode ' + v.episode); }
  function shortRuntime(rt) {
    var m = /(\d+)\s*min/i.exec(rt || '');
    if (!m) return rt || '';
    var n = +m[1];
    return n >= 60 ? Math.floor(n / 60) + 'h ' + (n % 60 ? (n % 60) + 'm' : '') : n + 'm';
  }

  function open(m, opts) {
    opts = opts || {};
    var el = U.el('div.screen.details');
    var scroller = U.el('div.dscroll');
    var bgSrc = m.background || U.art(m.id, 'background', 'medium') || '';
    var heroImg = U.el('img.hero', { src: bgSrc, alt: '' });
    var blurImg = U.el('img.hblur', { src: bgSrc, alt: '' });
    heroImg.onerror = function () { heroImg.style.visibility = 'hidden'; blurImg.style.visibility = 'hidden'; };
    var info = U.el('div.dinfo');
    var head = U.el('div.dhead', null, blurImg, U.el('div.herobox', null, heroImg, U.el('div.heroshade')), info);
    var eps = U.el('section.episodes');
    scroller.appendChild(head); scroller.appendChild(eps);
    scroller.appendChild(U.el('div.tabpad'));
    var back = U.el('button.lg.circle.backbtn', { html: IC.back, 'aria-label': 'Back', onclick: function () { Screens.pop(); } });
    var spin = U.el('div.busy', { hidden: true }, U.el('div.spinner'));
    el.appendChild(scroller); el.appendChild(back); el.appendChild(spin);
    var meta = m, target = null, season = null, full = false, descOpen = false;
    var series = function () { return meta.type === 'series'; };

    function computeTarget() {
      if (!series()) {
        var p = Stremio.progressFor(meta.id, meta.id);
        return { videoId: meta.id, label: p ? 'Resume' : 'Play', progress: p };
      }
      var list = Stremio.episodes(meta);
      var lib = Stremio.findLocal(meta.id);
      var vid = lib && lib.state.video_id && lib.state.video_id.indexOf(meta.id + ':') === 0 ? lib.state.video_id : null;
      var ep = null, prog = null;
      if (vid) {
        var st = lib.state, i;
        for (i = 0; i < list.length; i++) if (list[i].id === vid) break;
        var finished = st.duration > 0 && st.timeOffset >= st.duration * 0.93;
        if (finished) ep = list[i + 1] && Stremio.released(list[i + 1]) ? list[i + 1] : null;
        else { ep = list[i] || null; prog = Stremio.progressFor(meta.id, vid); }
      }
      if (!ep) ep = list.filter(Stremio.released)[0] || list[0];
      if (!ep) return { videoId: null, label: 'Play' };
      return { videoId: ep.id, ep: ep, label: (prog ? 'Resume' : 'Play') + ' S' + ep.season + ', E' + ep.episode, progress: prog };
    }

    function render() {
      info.innerHTML = '';
      var logo = meta.logo || U.art(meta.id, 'logo', 'medium');
      var title = U.el('h1.dtitle', { text: meta.name });
      if (logo) {
        var li = U.el('img.dlogo', { src: logo, alt: meta.name });
        title.classList.add('hide');
        li.onerror = function () { li.remove(); title.classList.remove('hide'); };
        info.appendChild(li);
      }
      info.appendChild(title);
      var bits = [series() ? 'TV Show' : 'Movie'].concat((meta.genres || []).slice(0, 2));
      info.appendChild(U.el('div.dmeta', { text: bits.join(' · ') }));
      target = computeTarget();
      var label = full || !series() ? target.label : 'Play';
      var play = U.el('button.btn.primary.cap.playbtn', { html: IC.play + '<span>' + label + '</span>' });
      play.onclick = function () { U.haptic(); start(target, null); };
      info.appendChild(play);
      if (target.progress) {
        info.appendChild(U.el('div.dprog', null, U.el('div.bar', null, U.el('i', { style: 'width:' + Math.round(target.progress.ratio * 100) + '%' })),
          U.el('span', { text: U.minutesLeft(target.progress.duration - target.progress.position) })));
      }
      var acts = U.el('div.dacts');
      acts.appendChild(U.el('button.btn.lgbtn.cap.verbtn', { html: IC.tune + '<span>Versions</span>', onclick: function () { openVersions(target); } }));
      var lib = Stremio.findLocal(meta.id);
      if (target.progress || (lib && lib.state.timeOffset > 0 && lib.state.video_id === target.videoId)) {
        acts.appendChild(U.el('button.lg.circle.lgbig', { html: IC.reset, 'aria-label': 'Clear progress', onclick: function () {
          Stremio.push({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, videoId: target.videoId, position: 0, duration: target.progress ? target.progress.duration : 0 });
          U.toast('Progress cleared'); render(); renderEpisodes();
        } }));
      }
      info.appendChild(acts);
      if (meta.description) {
        var d = U.el('p.ddesc' + (descOpen ? '' : '.clamp'), { text: meta.description });
        var more = U.el('button.morepill', { text: 'MORE' });
        var wrap = U.el('div.descwrap', null, d, descOpen ? null : more);
        var toggle = function () { descOpen = !descOpen; render(); };
        d.onclick = toggle; more.onclick = toggle;
        info.appendChild(wrap);
        setTimeout(function () { if (!descOpen && d.scrollHeight <= d.clientHeight + 2) more.remove(); }, 0);
      }
      var line = [];
      if (meta.releaseInfo || meta.year) line.push(String(meta.releaseInfo || meta.year).replace(/[–-]$/, ''));
      if (meta.runtime) line.push(shortRuntime(meta.runtime));
      var lr = U.el('div.dline', { text: line.join(' · ') });
      if (meta.imdbRating) lr.appendChild(U.el('span.tag', { text: 'IMDb ' + meta.imdbRating }));
      info.appendChild(lr);
      var people = [].concat(meta.cast && meta.cast.length ? ['Starring ' + meta.cast.slice(0, 4).join(', ')] : [], meta.director && [].concat(meta.director).length ? ['Directed by ' + [].concat(meta.director).slice(0, 2).join(', ')] : []);
      if (people.length) info.appendChild(U.el('p.dpeople', { text: people.join('\n') }));
    }

    function renderEpisodes() {
      eps.innerHTML = '';
      if (!series() || !full) return;
      var list = Stremio.episodes(meta);
      if (!list.length) return;
      var seasons = [];
      list.forEach(function (e) { if (seasons.indexOf(e.season) < 0) seasons.push(e.season); });
      if (season === null) season = target && target.ep ? target.ep.season : seasons[0];
      var sel = U.el('select.seasonsel', { 'aria-label': 'Season' });
      seasons.forEach(function (n) { var o = U.el('option', { value: n, text: 'Season ' + n }); if (n === season) o.selected = true; sel.appendChild(o); });
      sel.onchange = function () { season = +sel.value; renderEpisodes(); };
      var sb = U.el('label.seasonbtn', null, U.el('span', { text: 'Season ' + season }), U.el('span.ud', { html: UPDOWN }), sel);
      if (seasons.length < 2) { sel.disabled = true; U.$('.ud', sb).hidden = true; }
      eps.appendChild(sb);
      var track = U.el('div.track.eps');
      var focusCard = null;
      var rt = shortRuntime(meta.runtime);
      list.filter(function (e) { return e.season === season; }).forEach(function (e) {
        var p = Stremio.progressFor(meta.id, e.id);
        var isT = target && target.videoId === e.id;
        var aired = Stremio.released(e);
        var when = e.released ? new Date(e.released) : null;
        var kicker = 'Episode ' + e.episode + (isT ? (p ? ' · Continue' : ' · Up Next') : '');
        var foot = !aired && when ? 'Coming ' + when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : p ? U.minutesLeft(p.duration - p.position) : rt;
        var dots = U.el('button.epdots', { html: MORE, 'aria-label': 'Versions of episode ' + e.episode });
        dots.onclick = function (ev) { ev.stopPropagation(); openVersions({ videoId: e.id, ep: e, progress: p }); };
        var card = U.el('div.epcard' + (isT ? '.target' : '') + (!aired ? '.future' : ''), { role: 'button', tabindex: '0', 'aria-label': kicker + ', ' + epName(e) },
          e.thumbnail ? U.el('img.epimg', { src: e.thumbnail, alt: '', loading: 'lazy', onerror: function () { this.style.visibility = 'hidden'; } }) : null,
          U.el('div.epshade'),
          U.el('div.epbody', null,
            U.el('div.epk', { text: kicker }),
            U.el('div.epn', { text: epName(e) }),
            e.overview || e.description ? U.el('div.epd', { text: e.overview || e.description }) : null,
            p ? U.el('div.bar.epbar', null, U.el('i', { style: 'width:' + Math.round(p.ratio * 100) + '%' })) : null,
            U.el('div.epfoot', null, U.el('span', { text: foot }), dots)));
        card.onclick = function () { U.haptic(); start({ videoId: e.id, ep: e, progress: p }, null); };
        track.appendChild(card);
        if (isT) focusCard = card;
      });
      eps.appendChild(track);
      if (focusCard) setTimeout(function () { track.scrollLeft = Math.max(0, focusCard.offsetLeft - 20); }, 0);
    }

    function seasonMenu(anchor, seasons) {
      var scrim = U.el('div.menu-scrim');
      var menu = U.el('div.popmenu');
      seasons.forEach(function (n) {
        menu.appendChild(U.el('button.mi' + (n === season ? '.on' : ''), { text: 'Season ' + n, onclick: function () { season = n; done(); renderEpisodes(); } }));
      });
      function done() { scrim.remove(); menu.classList.remove('show'); setTimeout(function () { menu.remove(); }, 200); }
      scrim.onclick = done;
      document.body.appendChild(scrim); document.body.appendChild(menu);
      var r = anchor.getBoundingClientRect();
      var h = Math.min(seasons.length * 50 + 12, window.innerHeight * 0.5);
      menu.style.left = Math.max(12, r.left - 6) + 'px';
      menu.style.top = (r.top - h - 8 > 60 ? r.top - h - 8 : r.bottom + 8) + 'px';
      menu.style.maxHeight = h + 'px';
      void menu.offsetWidth;
      setTimeout(function () { menu.classList.add('show'); }, 10);
    }

    // ---------- playback ----------
    function busy(on) { spin.hidden = !on; }
    function start(t, chosen) {
      if (!t || !t.videoId) { U.toast('Nothing to play yet'); return; }
      // versions already fetched: start right inside this tap, so iPhone opens its full-screen player at once
      var ready = Stremio.streamsReady(meta.type, t.videoId);
      var quick = chosen || (ready && Smart.best(ready, series()));
      if (quick) { Player.open({ meta: meta, videoId: t.videoId, ep: t.ep || null, stream: quick, streams: ready || [quick], startAt: t.progress ? t.progress.position : 0 }); return; }
      Player.prime();
      busy(true);
      Stremio.streams(meta.type, t.videoId).then(function (streams) {
        busy(false);
        if (!streams.length) { U.toast('No versions found for this one'); return; }
        var pick = chosen || Smart.best(streams, series());
        if (!pick) { showVersions(t, streams, 'Nothing here plays in the app instantly. Pick a version, or open one in VLC.'); return; }
        Player.open({ meta: meta, videoId: t.videoId, ep: t.ep || null, stream: pick, streams: streams, startAt: t.progress ? t.progress.position : 0 });
      });
    }

    function verLabel(t) { return t.ep ? 'S' + t.ep.season + ', E' + t.ep.episode + ' · ' + epName(t.ep) : meta.name; }
    function openVersions(t) {
      var box = U.el('div.vers', null, U.el('div.spinner.center'));
      Sheet.open('Versions', box, { tall: true, sub: verLabel(t) });
      Stremio.streams(meta.type, t.videoId).then(function (streams) { fillVersions(box, t, streams); });
    }
    function showVersions(t, streams, why) {
      var box = U.el('div.vers');
      Sheet.open('Versions', box, { tall: true, sub: why || verLabel(t) });
      fillVersions(box, t, streams);
    }
    function fillVersions(box, t, streams) {
      box.innerHTML = '';
      var ranked = Smart.rank(streams, series());
      if (!ranked.length) { box.appendChild(U.el('p.empty', { text: 'No versions found.' })); return; }
      var here = ranked.filter(function (s) { var i = Smart.info(s); return i.ready && !i.problem && i.box !== 'other'; });
      var vlc = ranked.filter(function (s) { var i = Smart.info(s); return i.ready && !i.problem && i.box === 'other'; });
      var rest = ranked.filter(function (s) { return here.indexOf(s) < 0 && vlc.indexOf(s) < 0; });
      function section(title, note, list, mode) {
        if (!list.length) return;
        box.appendChild(U.el('h3.grouptitle', { text: title }));
        if (note) box.appendChild(U.el('p.foot-note', { text: note }));
        var g = U.el('div.group');
        list.slice(0, mode === 'here' ? 25 : 15).forEach(function (st) { g.appendChild(verRow(st, t, mode)); });
        box.appendChild(g);
      }
      section('Plays Here', null, here, 'here');
      section('Opens in VLC', 'These files are a type iPhone can’t play in the app. Get the free VLC app to open them.', vlc, 'vlc');
      section('Not Ready', 'Not cached yet or won’t play on iPhone.', rest, 'off');
    }
    function verRow(st, t, mode) {
      var i = Smart.info(st);
      var pills = U.el('div.vpills');
      Smart.badges(st).forEach(function (b) { pills.appendChild(U.el('span.vp', { text: b })); });
      if (Smart.size(st)) pills.appendChild(U.el('span.vs', { text: Smart.size(st) }));
      var row = U.el('button.row.ver' + (mode === 'off' ? '.dim' : ''), null,
        U.el('div.row-text', null, pills, U.el('div.vt', { text: Smart.titleLine(st) }), U.el('div.row-s', { text: i.problem || (!i.ready ? 'Not cached yet' : Smart.detailLine(st)) })),
        mode === 'vlc' ? U.el('span.vlcbadge', { html: IC.vlc + '<span>VLC</span>' }) : null);
      row.onclick = function () {
        Sheet.close();
        if (mode === 'vlc') { openVlc(st); return; }
        start(t, st);
      };
      return row;
    }

    var s = {
      el: el, name: 'details',
      onShow: function () { if (full) Stremio.pullIfStale(8000).then(function () { render(); renderEpisodes(); }); },
      refresh: function () { render(); renderEpisodes(); }
    };
    // once the artwork scrolls away, a glass title bar takes its place (iOS style)
    var dnav = U.el('div.dnav', { 'aria-hidden': 'true' }, U.el('span', { text: m.name }));
    el.insertBefore(dnav, back);
    scroller.addEventListener('scroll', function () {
      var limit = (U.$('.herobox', scroller) || { offsetHeight: 300 }).offsetHeight - 110;
      el.classList.toggle('scrolled', scroller.scrollTop > limit);
    }, { passive: true });
    render();
    Screens.push(s);
    Stremio.meta(m.type, m.id).then(function (mm) {
      meta = mm; full = true;
      U.$('span', dnav).textContent = mm.name;
      if (!m.background && mm.background && mm.background !== bgSrc) { heroImg.src = mm.background; blurImg.src = mm.background; }
      render(); renderEpisodes();
      // warm up the versions in the background so Play starts right away
      if (!opts.autoplay && target && target.videoId) Stremio.streams(meta.type, target.videoId);
      if (opts.play && target && target.videoId) start(target, null);
      if (opts.autoplay) {
        var ap = opts.autoplay;
        var ep = series() ? Stremio.episodes(meta).filter(function (e) { return e.id === ap.videoId; })[0] : null;
        start({ videoId: ap.videoId, ep: ep, progress: ap.position > 5000 ? Stremio.progressFor(meta.id, ap.videoId) : null }, null);
      }
    }, function () { U.toast('Couldn’t load the details. Check your connection.'); });
    return s;
  }

  function openVlc(st) {
    U.toast('Opening in VLC…');
    location.href = Smart.vlcUrl(st.url);
    setTimeout(function () {
      if (!document.hidden) U.toast('If nothing opened, install the free VLC app from the App Store.', 5000);
    }, 1800);
  }

  return { open: open, openVlc: openVlc };
})();

/* ---------------- app ---------------- */

var App = (function () {
  var browse = null;
  /** Straight to the catalog when signed in; otherwise the one-time sign-in. */
  function start() {
    if (!Stremio.signedIn()) { browse = null; Screens.reset(SignIn.screen()); return; }
    openBrowse();
  }
  function afterSignIn() { openBrowse(); InstallTip.maybe(); }
  function openBrowse() {
    browse = Browse.screen();
    Screens.reset(browse);
    Stremio.refreshAddons().then(function (l) { if (browse && addonsChanged(l)) browse.rebuild(); });
    Stremio.pull();
    Stremio.ensureEmail();
  }
  var addonSig = '';
  function addonsChanged(l) {
    var sig = (l || []).map(function (a) { return a.transportUrl; }).join('|');
    var changed = sig !== addonSig;
    addonSig = sig;
    return changed;
  }
  function contentChanged() { if (browse) browse.rebuild(); }
  function init() {
    Screens.init();
    // let buttons show their pressed state the instant a finger lands (Safari waits otherwise)
    document.addEventListener('touchstart', function () {}, { passive: true });
    // no web-page zooming by double tap or pinch: this is an app
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    // offline notice
    var off = U.el('div.offline.lg', { role: 'status', text: 'You’re offline' });
    document.body.appendChild(off);
    function net() { off.classList.toggle('show', navigator.onLine === false); }
    window.addEventListener('online', net); window.addEventListener('offline', net); net();
    addonSig = (U.store.get('addons', []) || []).map(function (a) { return a.transportUrl; }).join('|');
    Filter.noHorror = !!U.store.get('noHorror', false);
    Stremio.onExpired(function () { U.toast('Please sign in to Stremio again'); start(); });
    start();
    if (Stremio.signedIn()) InstallTip.maybe();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  return { init: init, start: start, afterSignIn: afterSignIn, contentChanged: contentChanged, version: '2.0' };
})();

/* In Safari (not yet on the Home Screen), a one-line nudge to add it, once per day at most. */
var InstallTip = (function () {
  function maybe() {
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!ios || navigator.standalone || document.querySelector('.installtip')) return;
    var last = U.store.get('tipShown', 0);
    if (Date.now() - last < 86400000) return;
    U.store.set('tipShown', Date.now());
    var tip = U.el('div.installtip.lg', { role: 'note' },
      U.el('div.it-text', null, U.el('b', { text: 'Add Tra-la-la TV to your Home Screen' }), U.el('span', { text: 'Tap Share, then Add to Home Screen. It opens full screen, like an app, and stays signed in.' })),
      U.el('button.icon-btn', { html: IC.close, 'aria-label': 'Dismiss', onclick: function () { tip.remove(); } }));
    document.body.appendChild(tip);
    setTimeout(function () { tip.remove(); }, 15000);
  }
  return { maybe: maybe };
})();

document.addEventListener('DOMContentLoaded', App.init);
