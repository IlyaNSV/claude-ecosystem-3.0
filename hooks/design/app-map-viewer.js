/* app-map-viewer.js — browser logic for the App Map USER FLOW walker.
 * Inlined into the self-contained .product/app-map.html by app-map-html.js.
 * Reads global DATA = { title, generated, modules[], features[], cjm[] }.
 *   feature = { id, title, role, screens:[{id,title,img}], edges:[{from,to,trigger,guard,external}], externals:[{id,label}] }
 * Renders: CJM band · module strip · feature tabs · screen-flow graph (cards + SVG arrows) ·
 *   lightbox step-through player (Prev/Next along flow order). No external deps.
 */
/* eslint-disable no-var, no-undef -- browser ES5 code inlined into generated app-map.html (not a Node hook) */
(function () {
  'use strict';
  var CW = 210, CH = 148, GX = 120, GY = 36, PAD = 28;
  var EMO = { neutral: '😐', positive: '😀', delighted: '🤩', anxious: '😟', frustrated: '😣' };
  var active = null, lb = { feature: null, order: [], idx: 0 };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function emoIcon(e) { if (!e) return ''; var k = String(e).toLowerCase().split(/\W/)[0]; return EMO[k] || ''; }

  function pickDefaultFeature() {
    for (var i = 0; i < DATA.features.length; i++) if (DATA.features[i].screens.some(function (s) { return s.img; })) return DATA.features[i];
    return DATA.features[0] || null;
  }

  function layout(feature) {
    var nodes = {};
    feature.screens.forEach(function (s) { nodes[s.id] = { id: s.id, kind: 'screen', title: s.title, img: s.img }; });
    (feature.externals || []).forEach(function (e) { nodes[e.id] = { id: e.id, kind: 'ext', title: e.label }; });
    var adj = {}, indeg = {};
    Object.keys(nodes).forEach(function (id) { adj[id] = []; indeg[id] = 0; });
    feature.edges.forEach(function (e) { if (nodes[e.from] && nodes[e.to]) { adj[e.from].push(e.to); indeg[e.to]++; } });
    var entry = feature.screens.filter(function (s) { return indeg[s.id] === 0; })[0] || feature.screens[0];
    var depth = {}, q = [], maxd = 0;
    if (entry) { depth[entry.id] = 0; q.push(entry.id); }
    while (q.length) { var u = q.shift(); maxd = Math.max(maxd, depth[u]); (adj[u] || []).forEach(function (v) { if (depth[v] === undefined) { depth[v] = depth[u] + 1; q.push(v); } }); }
    Object.keys(nodes).forEach(function (id) { if (depth[id] === undefined) { depth[id] = maxd + 1; } });
    var cols = {};
    Object.keys(nodes).forEach(function (id) { (cols[depth[id]] = cols[depth[id]] || []).push(id); });
    var pos = {}, maxRow = 0, maxCol = 0;
    Object.keys(cols).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
      cols[d].forEach(function (id, i) { pos[id] = { x: PAD + d * (CW + GX), y: PAD + i * (CH + GY), d: d, i: i }; maxRow = Math.max(maxRow, i); maxCol = Math.max(maxCol, d); });
    });
    return { nodes: nodes, pos: pos, width: PAD * 2 + (maxCol + 1) * (CW + GX), height: PAD * 2 + (maxRow + 1) * (CH + GY) };
  }

  function renderGraph(feature) {
    active = feature;
    var wrap = document.getElementById('graph'); wrap.innerHTML = '';
    if (!feature || !feature.screens.length) { wrap.appendChild(el('div', 'empty', 'Нет экранов (NM ещё не создан для этой фичи).')); return; }
    var lo = layout(feature);
    var canvas = el('div', 'canvas'); canvas.style.width = lo.width + 'px'; canvas.style.height = lo.height + 'px';

    // SVG arrows
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'arrows'); svg.setAttribute('width', lo.width); svg.setAttribute('height', lo.height);
    svg.innerHTML = '<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#7a8aa8"/></marker>'
      + '<marker id="ahx" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#b08400"/></marker></defs>';
    canvas.appendChild(svg);

    feature.edges.forEach(function (e) {
      var a = lo.pos[e.from], b = lo.pos[e.to]; if (!a || !b) return;
      var x1, y1, x2, y2;
      if (b.d > a.d) { x1 = a.x + CW; y1 = a.y + CH / 2; x2 = b.x; y2 = b.y + CH / 2; }
      else if (b.d < a.d) { x1 = a.x; y1 = a.y + CH / 2; x2 = b.x + CW; y2 = b.y + CH / 2; }
      else { x1 = a.x + CW / 2; y1 = a.y + CH; x2 = b.x + CW / 2; y2 = b.y; }
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var path = document.createElementNS(svgNS, 'path');
      var c = Math.abs(x2 - x1) / 2 + 1;
      path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + (x1 + c) + ',' + y1 + ' ' + (x2 - c) + ',' + y2 + ' ' + x2 + ',' + y2);
      path.setAttribute('class', e.external ? 'edge ext' : 'edge');
      path.setAttribute('marker-end', e.external ? 'url(#ahx)' : 'url(#ah)');
      svg.appendChild(path);
      var lab = el('div', 'edge-label' + (e.external ? ' ext' : ''), esc(e.trigger || '') + (e.guard ? ' <span class="g">[' + esc(e.guard) + ']</span>' : ''));
      lab.style.left = mx + 'px'; lab.style.top = (my - 10) + 'px';
      canvas.appendChild(lab);
    });

    // cards
    Object.keys(lo.nodes).forEach(function (id) {
      var n = lo.nodes[id], p = lo.pos[id];
      var card = el('div', 'card ' + n.kind); card.style.left = p.x + 'px'; card.style.top = p.y + 'px'; card.style.width = CW + 'px'; card.style.height = CH + 'px';
      if (n.kind === 'screen') {
        var thumb = n.img ? '<img class="thumb" src="' + n.img + '" alt="' + esc(n.id) + '"/>' : '<div class="thumb ph">нет PNG<br><span>(плейсхолдер)</span></div>';
        card.innerHTML = thumb + '<div class="cap"><b>' + esc(n.id) + '</b> · ' + esc(n.title) + '</div>';
        card.onclick = function () { openLightbox(feature, id); };
      } else {
        card.innerHTML = '<div class="extbody">↗ ' + esc(n.title) + '</div>';
      }
      canvas.appendChild(card);
    });
    wrap.appendChild(canvas);
  }

  function flowOrder(feature) {
    var lo = layout(feature);
    return feature.screens.slice().sort(function (a, b) {
      var pa = lo.pos[a.id], pb = lo.pos[b.id];
      return (pa.d - pb.d) || (pa.i - pb.i);
    });
  }

  function openLightbox(feature, screenId) {
    lb.feature = feature; lb.order = flowOrder(feature);
    lb.idx = Math.max(0, lb.order.findIndex(function (s) { return s.id === screenId; }));
    renderLightbox();
    document.getElementById('lb').classList.add('on');
  }
  function closeLightbox() { document.getElementById('lb').classList.remove('on'); }
  function step(d) { lb.idx = (lb.idx + d + lb.order.length) % lb.order.length; renderLightbox(); }

  function renderLightbox() {
    var s = lb.order[lb.idx], f = lb.feature;
    var outs = f.edges.filter(function (e) { return e.from === s.id; });
    var nameOf = function (id) { var sc = f.screens.filter(function (x) { return x.id === id; })[0]; if (sc) return sc.id + ' · ' + sc.title; var ex = (f.externals || []).filter(function (x) { return x.id === id; })[0]; return ex ? ex.label : id; };
    var outHtml = outs.length ? '<ul>' + outs.map(function (e) { return '<li><b>→ ' + esc(nameOf(e.to)) + '</b>: ' + esc(e.trigger || '') + (e.guard ? ' <span class="g">[' + esc(e.guard) + ']</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">терминальный экран (нет исходящих переходов в NM)</p>';
    var img = s.img ? '<img src="' + s.img + '" alt="' + esc(s.id) + '"/>' : '<div class="bigph">нет PNG-тхумбнейла для ' + esc(s.id) + '<br><span>(экран есть в NM, рендер появится после консолидации источника)</span></div>';
    document.getElementById('lb-stage').innerHTML = '<b>' + esc(f.id) + '</b> · экран ' + (lb.idx + 1) + ' / ' + lb.order.length;
    document.getElementById('lb-title').innerHTML = esc(s.id) + ' · ' + esc(s.title);
    document.getElementById('lb-img').innerHTML = img;
    document.getElementById('lb-next').innerHTML = '<h4>Куда дальше</h4>' + outHtml;
  }

  function renderChrome() {
    document.getElementById('title').textContent = DATA.title || 'App Map';
    document.getElementById('sub').textContent = 'USER FLOW · сгенерировано ' + (DATA.generated || '') + ' · /design:map --html';

    // CJM band
    var cjm = document.getElementById('cjm');
    if (DATA.cjm && DATA.cjm.length) {
      cjm.innerHTML = '<div class="band-h">CJM — стадии клиентского пути</div>';
      var row = el('div', 'band-row');
      DATA.cjm.forEach(function (st, i) {
        row.appendChild(el('div', 'stage', '<div class="emo">' + emoIcon(st.emotion) + '</div><b>' + esc(st.stage) + '</b><div class="mods">' + esc(st.modules || '') + '</div>' + (st.pain ? '<div class="pain">' + esc(st.pain) + '</div>' : '')));
        if (i < DATA.cjm.length - 1) row.appendChild(el('div', 'arr', '→'));
      });
      cjm.appendChild(row);
    } else { cjm.style.display = 'none'; }

    // module strip
    var ms = document.getElementById('modules');
    ms.innerHTML = '<div class="band-h">Модули</div>';
    var mr = el('div', 'band-row');
    DATA.modules.forEach(function (m) {
      mr.appendChild(el('div', 'mod ' + (m.nm_present ? 'live' : 'planned'), '<b>' + esc(m.id) + '</b><div class="mt">' + esc(m.short || m.title) + '</div><div class="role">' + (m.nm_present ? (m.nm.join(',')) : 'planned · нет NM') + '</div>'));
    });
    ms.appendChild(mr);

    // feature tabs
    var tabs = document.getElementById('tabs'); tabs.innerHTML = '';
    DATA.features.forEach(function (f) {
      var hasImg = f.screens.some(function (s) { return s.img; });
      var t = el('button', 'tab' + (f === active ? ' on' : ''), esc(f.id) + ' · ' + esc(f.title) + (hasImg ? ' <span class="px">pixels</span>' : ' <span class="st">structure</span>'));
      t.onclick = function () { renderGraph(f); Array.prototype.forEach.call(tabs.children, function (c) { c.classList.remove('on'); }); t.classList.add('on'); };
      tabs.appendChild(t);
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    renderChrome();
    var def = pickDefaultFeature();
    renderGraph(def);
    Array.prototype.forEach.call(document.getElementById('tabs').children, function (c) { if (c.textContent.indexOf(def.id) === 0) c.classList.add('on'); });
    document.getElementById('lb-prev').onclick = function () { step(-1); };
    document.getElementById('lb-next-btn').onclick = function () { step(1); };
    document.getElementById('lb-close').onclick = closeLightbox;
    document.getElementById('lb').onclick = function (e) { if (e.target.id === 'lb') closeLightbox(); };
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('lb').classList.contains('on')) return;
      if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
    });
  });
})();
