(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     DOM ready guard — script যেখানেই থাকুক,
     HTML fully parse হওয়ার পরই চলবে
  ───────────────────────────────────────────── */
  function init() {

    /* ── Scene ── */
    var scene = document.getElementById('lp-scene');
    if (!scene) return; /* lp-scene না থাকলে চুপচাপ বের হও */

    /* ── Cursor elements — null check ── */
    var dot  = document.getElementById('lp-dot');
    var ring = document.getElementById('lp-ring');

    /* ── Global config from scene data-attributes ── */
    var CURSOR_SIZE     = parseFloat(scene.getAttribute('data-lp-cursor-size'))     || 8;
    var RING_SIZE       = parseFloat(scene.getAttribute('data-lp-ring-size'))       || 32;
    var RING_COLOR      = scene.getAttribute('data-lp-ring-color')                  || 'rgba(0,0,0,0.3)';
    var RING_DURATION   = parseFloat(scene.getAttribute('data-lp-ring-duration'))   || 0.3;
    var RETURN_DURATION = parseFloat(scene.getAttribute('data-lp-return-duration')) || 1.4;
    var RETURN_EASE     = scene.getAttribute('data-lp-return-ease')                 || 'elastic.out(1,0.6)';

    /* Apply cursor size + color — only if elements exist */
    if (dot) {
      gsap.set(dot, { width: CURSOR_SIZE, height: CURSOR_SIZE, opacity: 0 });
    }
    if (ring) {
      gsap.set(ring, {
        width  : RING_SIZE,
        height : RING_SIZE,
        border : '1px solid ' + RING_COLOR,
        opacity: 0
      });
    }

    /* ── All parallax items ── */
    var items = Array.from(scene.querySelectorAll('[data-lp-speed]'));
    if (!items.length) return; /* কোনো item না থাকলে বের হও */

    /* ── Helper: read attribute with typed fallback ── */
    function attr(el, key, fallback) {
      var v = el.getAttribute(key);
      if (v === null || v === '') return fallback;
      var n = parseFloat(v);
      return isNaN(n) ? v : n; /* ease string হলে string-ই রাখো */
    }

    /* ── Hover scale ── */
    items.forEach(function (el) {
      if (!attr(el, 'data-lp-scale-on-hover', 0)) return;
      var scaleTo = attr(el, 'data-lp-scale', 1.06);

      el.addEventListener('mouseenter', function () {
        gsap.to(el, { scale: scaleTo, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { scale: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
      });
    });

    /* ── Mouse move ── */
    scene.addEventListener('mousemove', function (e) {
      var rect = scene.getBoundingClientRect();
      var mx   = e.clientX - rect.left;
      var my   = e.clientY - rect.top;
      var cx   = rect.width  / 2;
      var cy   = rect.height / 2;

      /* Normalized offset: -1 → +1 */
      var nx = (mx - cx) / cx;
      var ny = (my - cy) / cy;

      /* Cursor dot — instant */
      if (dot)  gsap.to(dot,  { x: mx, y: my, duration: 0.05, ease: 'none' });

      /* Cursor ring — lagged */
      if (ring) gsap.to(ring, { x: mx, y: my, duration: RING_DURATION, ease: 'power2.out' });

      /* Each parallax item */
      items.forEach(function (el) {
        var speed    = attr(el, 'data-lp-speed',          0.08);
        var maxX     = attr(el, 'data-lp-max-x',          80);
        var maxY     = attr(el, 'data-lp-max-y',          60);
        var duration = attr(el, 'data-lp-duration',       0.9);
        var ease     = attr(el, 'data-lp-ease',           'power2.out');
        var rotate   = attr(el, 'data-lp-rotate',         0);
        var rotAmt   = attr(el, 'data-lp-rotate-amount',  5);

        /* Movement clamped to max-x / max-y */
        var factor = speed / 0.08;
        var tx  = Math.min(Math.max(nx * maxX * factor, -maxX), maxX);
        var ty  = Math.min(Math.max(ny * maxY * factor, -maxY), maxY);
        var rot = rotate ? nx * rotAmt : 0;

        gsap.to(el, {
          x        : tx,
          y        : ty,
          rotation : rot,
          duration : duration,
          ease     : ease,
          overwrite: 'auto'
        });
      });
    });

    /* ── Mouse leave — return to origin ── */
    scene.addEventListener('mouseleave', function () {
      var targets = [];
      if (dot)  targets.push(dot);
      if (ring) targets.push(ring);
      if (targets.length) gsap.to(targets, { opacity: 0, duration: 0.2 });

      items.forEach(function (el) {
        gsap.to(el, {
          x        : 0,
          y        : 0,
          rotation : 0,
          duration : RETURN_DURATION,
          ease     : RETURN_EASE,
          overwrite: 'auto'
        });
      });
    });

    /* ── Mouse enter ── */
    scene.addEventListener('mouseenter', function () {
      var targets = [];
      if (dot)  targets.push(dot);
      if (ring) targets.push(ring);
      if (targets.length) gsap.to(targets, { opacity: 1, duration: 0.2 });
    });

  } /* end init() */

  /* ─────────────────────────────────────────────
     Safe execution — DOM ready হলে চালাও,
     নইলে DOMContentLoaded-এ wait করো
  ───────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); /* already ready */
  }

}());