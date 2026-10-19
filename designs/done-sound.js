/* Shared "task done" sound for every design prototype.
 * Hooks localStorage.setItem: when a save of `todoapp.tasks.v1` flips any task
 * from done:false to done:true, a sound plays. Designs don't need to call anything.
 *
 * Sound file: put your own file at designs/sounds/done.mp3 (or .ogg / .wav).
 * If none is found, a short synthesized fanfare plays instead.
 * Mute: localStorage.setItem('todoapp.sound', 'off')  — unmute: 'on'.
 */
(function () {
  var KEY = 'todoapp.tasks.v1';
  var CANDIDATES = ['sounds/done.mp3', 'sounds/done.ogg', 'sounds/done.wav'];
  var fileUrl;   // undefined = not looked yet, null = no file found, string = file to use

  // Look for the sound file lazily (on the first "done"), so pages without a
  // sounds/ file don't log missing-file errors on every load.
  function playFile(onNone) {
    if (fileUrl === null) return onNone();
    if (fileUrl) {
      var a = new Audio(fileUrl);
      a.volume = 0.8;
      a.play().catch(onNone);
      return;
    }
    (function tryAt(i) {
      if (i >= CANDIDATES.length) { fileUrl = null; return onNone(); }
      var a = new Audio(CANDIDATES[i]);
      a.volume = 0.8;
      a.play().then(function () { fileUrl = CANDIDATES[i]; }, function () { tryAt(i + 1); });
    })(0);
  }

  var ctx = null;
  function fanfare() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    var t0 = ctx.currentTime + 0.02;
    var master = ctx.createGain();
    master.gain.value = 0.18;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.connect(master);
    master.connect(ctx.destination);
    // G4 C5 E5 — G5 (held): a small brass-like victory call
    var notes = [[392, 0, 0.13], [523.25, 0.13, 0.13], [659.25, 0.26, 0.13], [783.99, 0.39, 0.7]];
    notes.forEach(function (n) {
      [-6, 6].forEach(function (detune) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = n[0];
        o.detune.value = detune;
        var s = t0 + n[1], e = s + n[2];
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(1, s + 0.025);
        g.gain.setValueAtTime(1, e - 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, e + 0.25);
        o.connect(g);
        g.connect(lp);
        o.start(s);
        o.stop(e + 0.3);
      });
    });
  }

  function play() {
    try { if (localStorage.getItem('todoapp.sound') === 'off') return; } catch (e) {}
    playFile(fanfare);
  }

  function doneIds(json) {
    var map = {};
    try {
      var list = JSON.parse(json || '[]');
      if (Array.isArray(list)) list.forEach(function (t) { if (t && t.id != null) map[t.id] = !!t.done; });
    } catch (e) {}
    return map;
  }

  try {
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var before = null;
      if (k === KEY && this === window.localStorage) {
        try { before = doneIds(this.getItem(KEY)); } catch (e) {}
      }
      var result = original.apply(this, arguments);
      if (before) {
        var after = doneIds(v);
        for (var id in after) {
          if (after[id] && before[id] === false) { play(); break; }
        }
      }
      return result;
    };
  } catch (e) { /* storage unavailable: no sound, app still works */ }

  window.todoDoneSound = { play: play }; // handy for testing from the console
})();
