/*
 * Web controller: screens (menu / reader / game), keyboard, mouse and touch input,
 * settings panel, and scaling the 1920x1080 stage to the browser window.
 */
(function () {
  // Internal key codes (same as the LG TV remote, so the game code is shared)
  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
  };

  // Keyboard → internal key
  var KEYMAP = {
    27: KEY.BACK,   // Esc
    8: KEY.BACK,    // Backspace
    32: KEY.ENTER,  // Space
    82: KEY.RED,    // R
    71: KEY.GREEN,  // G
    80: KEY.YELLOW, // P
    89: KEY.YELLOW, // Y
    83: KEY.BLUE,   // S
    66: KEY.BLUE,   // B
    87: KEY.UP, 65: KEY.LEFT, 68: KEY.RIGHT // W A D (S is settings)
  };
  function code(e) { return KEYMAP[e.keyCode] || e.keyCode; }

  var s = Settings.load();
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), barsEl = $('bars'), textEl = $('text'), panel = $('panel'), list = $('settings');
  var disclaimer = $('disclaimer'), menuEl = $('menu'), menuList = $('menu-list');
  var reader = $('reader'), canvas = $('game'), gameHint = $('game-hint'), pad = $('pad');

  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var GAMES = [Blaster, Racer, Runner, Snake, Maze];
  var MENU = [
    { label: 'Reading', sub: STORIES.length + ' stories', action: function () { show('reader'); } }
  ].concat(GAMES.map(function (g) {
    return { label: g.title, sub: 'game', action: function () { startGame(g); } };
  })).concat([
    { label: 'Settings', sub: 'bars & text', action: function () { openPanel(); } }
  ]);

  var screen = 'menu';
  var menuFocus = 0, setFocus = 0, scrollY = 0, storyIdx = 0;
  var setKeys = Object.keys(Settings.LABELS);

  /* ---------- stage scaling ---------- */

  function fit() {
    var padH = pad.classList.contains('hidden') ? 0 : pad.offsetHeight;
    var w = window.innerWidth, h = window.innerHeight - padH;
    var k = Math.min(w / 1920, h / 1080);
    stage.style.transform =
      'translate(' + ((w - 1920 * k) / 2) + 'px,' + ((h - 1080 * k) / 2) + 'px) scale(' + k + ')';
  }

  /* ---------- rendering ---------- */

  function renderMenu() {
    menuList.innerHTML = MENU.map(function (m, i) {
      return '<li data-i="' + i + '" class="' + (i === menuFocus ? 'focused' : '') + '"><span>' + m.label +
        '</span><span class="sub">' + m.sub + '</span></li>';
    }).join('');
  }

  function renderText() {
    textEl.style.fontSize = s.fontSize + 'px';
    var st = STORIES[storyIdx];
    textEl.innerHTML =
      '<h2 class="story-title">' + st.title + '</h2>' +
      st.paragraphs.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      '<p class="story-end">◀ ▶ story ' + (storyIdx + 1) + ' of ' + STORIES.length + '</p>';
  }

  function changeStory(dir) {
    storyIdx = (storyIdx + dir + STORIES.length) % STORIES.length;
    renderText();
    scrollY = 0;
    scroll(0);
  }

  function renderPanel() {
    list.innerHTML = setKeys.map(function (k, i) {
      var v = s[k];
      if (k === 'opacity') v = Math.round(v * 100) + '%';
      if (k === 'barSize' || k === 'fontSize') v = v + ' px';
      return '<li data-i="' + i + '" class="' + (i === setFocus ? 'focused' : '') + '"><span>' +
        Settings.LABELS[k] + '</span><span class="value">' + v + '</span></li>';
    }).join('');
  }

  function apply() {
    Bars.render(barsEl, s);
    renderText();
    if (panelOpen()) renderPanel();
  }

  /* ---------- screens ---------- */

  function show(name) {
    screen = name;
    menuEl.classList.toggle('hidden', name !== 'menu');
    reader.classList.toggle('hidden', name !== 'reader');
    canvas.classList.toggle('hidden', name !== 'game');
    gameHint.classList.toggle('hidden', name !== 'game');
    pad.classList.toggle('hidden', !isTouch || name === 'menu');
    if (name !== 'game') Engine.stop();
    if (name === 'menu') renderMenu();
    fit();
  }

  function startGame(g) {
    show('game');
    gameHint.textContent = isTouch
      ? g.hint.replace(/OK/g, 'OK button')
      : g.hint.replace(/OK/g, 'Space') + '  ·  P pause  ·  S settings  ·  Esc menu';
    Engine.start(canvas, g);
  }

  function panelOpen() { return !panel.classList.contains('hidden'); }
  function openPanel() { Engine.pause(true); panel.classList.remove('hidden'); renderPanel(); }
  function closePanel() { panel.classList.add('hidden'); }

  function scroll(dy) {
    var max = Math.max(0, textEl.scrollHeight - 972);
    scrollY = Math.min(max, Math.max(0, scrollY + dy));
    textEl.style.transform = 'translateY(' + (-scrollY) + 'px)';
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    } catch (e) { /* not supported */ }
  }

  /* ---------- input ---------- */

  function press(k) {
    if (!disclaimer.classList.contains('hidden')) {
      if (k === KEY.ENTER) dismissDisclaimer();
      return;
    }

    if (panelOpen()) {
      if (k === KEY.ENTER || k === KEY.BACK || k === KEY.BLUE) { closePanel(); return; }
      if (k === KEY.UP) setFocus = (setFocus - 1 + setKeys.length) % setKeys.length;
      if (k === KEY.DOWN) setFocus = (setFocus + 1) % setKeys.length;
      if (k === KEY.LEFT) Settings.cycle(s, setKeys[setFocus], -1);
      if (k === KEY.RIGHT) Settings.cycle(s, setKeys[setFocus], 1);
      apply();
      return;
    }

    if (k === KEY.BLUE) { openPanel(); return; }

    if (screen === 'menu') {
      if (k === KEY.UP) menuFocus = (menuFocus - 1 + MENU.length) % MENU.length;
      if (k === KEY.DOWN) menuFocus = (menuFocus + 1) % MENU.length;
      if (k === KEY.ENTER) { MENU[menuFocus].action(); return; }
      renderMenu();
      return;
    }

    if (screen === 'reader') {
      if (k === KEY.BACK) { show('menu'); return; }
      if (k === KEY.ENTER) { openPanel(); return; }
      if (k === KEY.DOWN) scroll(120);
      if (k === KEY.UP) scroll(-120);
      if (k === KEY.LEFT) changeStory(-1);
      if (k === KEY.RIGHT) changeStory(1);
      if (k === KEY.RED) { Settings.cycle(s, 'orientation', 1); apply(); }
      if (k === KEY.GREEN) { Settings.cycle(s, 'barSize', 1); apply(); }
      return;
    }

    if (screen === 'game') {
      if (k === KEY.BACK) { show('menu'); return; }
      Engine.keydown(k);
    }
  }

  function release(k) { Engine.keyup(k); }

  function dismissDisclaimer() {
    disclaimer.classList.add('hidden');
    s.seenDisclaimer = true;
    Settings.save(s);
  }

  // Keyboard
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.keyCode === 70) { toggleFullscreen(); return; } // F
    var k = code(e);
    if ([KEY.LEFT, KEY.UP, KEY.RIGHT, KEY.DOWN, KEY.ENTER, KEY.BACK].indexOf(k) >= 0) e.preventDefault();
    if (e.repeat && screen === 'game') return; // held keys are tracked by the engine
    press(k);
  });
  document.addEventListener('keyup', function (e) { release(code(e)); });

  // Mouse / tap: menu items
  menuList.addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    menuFocus = +li.dataset.i;
    MENU[menuFocus].action();
  });

  // Mouse / tap: settings rows (click the value: left half = previous, right half = next)
  list.addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (!li) return;
    setFocus = +li.dataset.i;
    var v = e.target.closest('.value');
    if (v) {
      var r = v.getBoundingClientRect();
      Settings.cycle(s, setKeys[setFocus], e.clientX < r.left + r.width / 2 ? -1 : 1);
    }
    apply();
  });

  disclaimer.addEventListener('click', dismissDisclaimer);

  // Mouse wheel scrolls the reader
  reader.addEventListener('wheel', function (e) { scroll(e.deltaY); }, { passive: true });

  // Touch: drag to scroll the reader, swipe sideways to change story
  var touchStart = null;
  stage.addEventListener('touchstart', function (e) {
    if (screen !== 'reader' || panelOpen()) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (!touchStart) return;
    scroll((touchStart.y - e.touches[0].clientY) * 2);
    touchStart.y = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    if (Math.abs(dx) > 80) changeStory(dx < 0 ? 1 : -1);
    touchStart = null;
  });

  // Touch pad buttons: press on down, release on up (so holding works in games)
  Array.prototype.forEach.call(pad.querySelectorAll('button'), function (b) {
    var k = +b.dataset.key;
    var isDown = false;
    function down(e) { e.preventDefault(); isDown = true; b.classList.add('active'); press(k); }
    function up(e) { if (!isDown) return; e.preventDefault(); isDown = false; b.classList.remove('active'); release(k); }
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  });

  // Pause games when the tab is hidden
  document.addEventListener('visibilitychange', function () { if (document.hidden) Engine.pause(true); });
  window.addEventListener('resize', fit);

  apply();
  show('menu');
  if (!s.seenDisclaimer) disclaimer.classList.remove('hidden');
})();
