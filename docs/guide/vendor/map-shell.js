/* map-shell.js — общий chrome двух карт экосистемы. Офлайн, вендорится, framework-agnostic.
   Предоставляет (DEC-DEV-0133, doc-UX батч C3):
     · навбар «⇄ переключить вид» (команды ⇆ процессы), добавляемый первым ребёнком в <header>;
     · in-app UTF-8 doc-панель: клик по `a.doclink` → fetch .md, декод байтов как UTF-8 НАМИ,
       минимальный markdown-рендер внутри этой UTF-8 страницы. Сырой .md без charset=utf-8
       (встроенный IDE-сервер) иначе роняет locale-RU Chrome в cp1251 → «кракозябры»; декод здесь
       обходит charset-переговоры целиком.
   Оба шаблона карт подключают этот файл ПОСЛЕ своих вендор-либ и задают
   window.MAP_SHELL = { view:'map'|'processes' } ДО загрузки. Doc-ссылки помечаются
   class="doclink" data-title="…". Делегирование — в CAPTURE-фазе, чтобы ссылки, гасящие
   всплытие в bubble (напр. SPEC-ссылки внутри <summary> с onclick=stopPropagation), всё равно
   перехватывались. Грациозный фолбэк: если fetch упал (file:// без --allow-file-access-from-files),
   панель показывает подсказку + «открыть ↗» на сырой файл. */
(function () {
  "use strict";
  var CFG = window.MAP_SHELL || {};
  var VIEW = CFG.view || '';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // repo-root-относительные пути ("docs/…","commands/…") → обе карты живут в docs/guide/, префикс ../../.
  // Уже-относительные (../…), абсолютные и scheme-URL проходят как есть. (Идентично прежнему docRel
  // в шаблоне процессов — используется его side-panel'ом при сборке href.)
  function docRel(p) { return /^(?:[a-z]+:)?\/\//i.test(p) ? p : '../../' + String(p).replace(/^\.?\/*/, ''); }

  // ── навбар переключения вида ──
  var VIEWS = [
    { id: 'map', href: 'ecosystem-map.html', icon: '🗺', label: 'Карта команд' },
    { id: 'processes', href: 'ecosystem-processes.html', icon: '🔀', label: 'Карта процессов' }
  ];
  function injectNav() {
    var header = document.querySelector('header');
    if (!header || header.querySelector('.shell-nav')) return;
    var nav = document.createElement('nav');
    nav.className = 'shell-nav';
    nav.setAttribute('aria-label', 'Переключить вид карты');
    var html = '<span class="shell-brand">Карты:</span>';
    for (var i = 0; i < VIEWS.length; i++) {
      var v = VIEWS[i];
      if (v.id === VIEW) {
        html += '<span class="shell-viewlink is-current" aria-current="page"><span class="vi">' + v.icon + '</span>' + esc(v.label) + '</span>';
      } else {
        html += '<a class="shell-viewlink" href="' + v.href + '"><span class="vi">' + v.icon + '</span>' + esc(v.label) + '</a>';
      }
    }
    nav.innerHTML = html;
    header.insertBefore(nav, header.firstChild);
  }

  // ── doc-панель (модалка) ──
  var modal = null, titleEl = null, rawEl = null, bodyEl = null;
  function closeDoc() { if (modal) modal.classList.remove('open'); }
  function injectModal() {
    if (modal) return;
    modal = document.getElementById('docModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'docmodal';
      modal.id = 'docModal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Просмотр документа');
      modal.innerHTML =
        '<div class="docpanel">' +
          '<div class="dochead">' +
            '<h3 id="docTitle">Документ</h3>' +
            '<a id="docOpenRaw" href="#" target="_blank" rel="noopener">открыть ↗</a>' +
            '<button class="px" id="docClose" aria-label="Закрыть">✕</button>' +
          '</div>' +
          '<div class="docbody" id="docBody"></div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    titleEl = document.getElementById('docTitle');
    rawEl = document.getElementById('docOpenRaw');
    bodyEl = document.getElementById('docBody');
    document.getElementById('docClose').addEventListener('click', closeDoc);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeDoc(); });
  }

  function mdInline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  // намеренно минимальный markdown (заголовки/списки/цитаты/fenced-code/inline). Экранируем ПЕРВЫМИ,
  // так что сырой HTML показывается текстом.
  function renderMd(src) {
    // Срезаем ведущий YAML-фронтматтер (doc_type-метка A3) и HTML-комменты (напр. GENERATED-баннер
    // в 02/03) — это метаданные, не проза; в панели они были бы визуальным шумом.
    src = String(src).replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/<!--[\s\S]*?-->/g, '');
    var parts = src.split('```'); // чётный idx = проза, нечётный = fenced code
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var seg = esc(parts[i]);
      if (i % 2 === 1) { out += '<pre class="md-code">' + seg + '</pre>'; continue; }
      var lines = seg.split(/\r?\n/), inList = false;
      for (var j = 0; j < lines.length; j++) {
        var ln = lines[j];
        var mh = ln.match(/^(#{1,4})\s+(.*)$/);
        var mli = ln.match(/^\s*[-*]\s+(.*)$/);
        var mbq = ln.match(/^\s*&gt;\s?(.*)$/);
        if (mh) { if (inList) { out += '</ul>'; inList = false; } var lv = mh[1].length; out += '<h' + lv + '>' + mdInline(mh[2]) + '</h' + lv + '>'; }
        else if (mli) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + mdInline(mli[1]) + '</li>'; }
        else if (mbq) { if (inList) { out += '</ul>'; inList = false; } out += '<blockquote>' + mdInline(mbq[1]) + '</blockquote>'; }
        else if (ln.trim() === '') { if (inList) { out += '</ul>'; inList = false; } }
        else { if (inList) { out += '</ul>'; inList = false; } out += '<p>' + mdInline(ln) + '</p>'; }
      }
      if (inList) { out += '</ul>'; }
    }
    return out;
  }
  function openDoc(url, title) {
    injectModal();
    titleEl.textContent = title || 'Документ';
    rawEl.href = url;
    bodyEl.innerHTML = '<div class="docloading">Загрузка…</div>';
    modal.classList.add('open');
    fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) { bodyEl.innerHTML = renderMd(new TextDecoder('utf-8').decode(new Uint8Array(buf))); })
      .catch(function (err) {
        bodyEl.innerHTML = '<div class="docerr">Не удалось открыть в панели (' + esc(String(err && err.message || err)) +
          '). Ссылка «открыть ↗» выше откроет файл в новой вкладке. На file:// fetch к локальным файлам заблокирован — используй IDE-сервер.</div>';
      });
  }

  // делегированный перехват doc-ссылок В CAPTURE-фазе: бьёт stopPropagation на ссылках внутри
  // <summary> (SPEC ↗). preventDefault → нет навигации в сырьё; openDoc → читаемый UTF-8.
  function onClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a.doclink') : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    openDoc(a.getAttribute('href'), a.getAttribute('data-title') || a.textContent);
  }
  function onKey(e) { if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeDoc(); }

  function init() {
    injectNav();
    injectModal();
    document.addEventListener('click', onClick, true);  // capture
    document.addEventListener('keydown', onKey);
  }
  // Шелл подключается после <header> в теле → инжектим синхронно, чтобы навбар изменил высоту
  // header ДО того, как карта процессов измерит #wrap и разложит cytoscape (иначе граф на ~30px выше).
  if (document.querySelector('header') && document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

  window.MapShell = { openDoc: openDoc, docRel: docRel, closeDoc: closeDoc };
})();
