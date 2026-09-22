/* EzyFast POS — pos.js (di-load dari Github via jsDelivr, defer).
 * Split dari p/plugins/POS/pos.html: definisi Alpine.data + auto-registration.
 * Tahan late-load: bila Alpine sudah start sebelum file ini tiba,
 * registrasi tetap dijalankan via polling fallback + subtree #pos-page
 * di-init ulang manual (Alpine.initTree) agar x-data tidak gagal.
 */
(function () {
  'use strict';

  // Penanda eksekusi: dibaca oleh watchdog di pos.html untuk memastikan
  // file YANG BARU benar-benar tersaji & tereksekusi.
  window.__posJsRan = true;

  /* ===== POS Feed Engine (hash shell + feed-sourced tab konten) ==========
     Setiap tab POS = post Blogger independen berlabel `ezy-pos-tab` +
     `ezy-tab-<slug>` (URL permalink /yyyy/mm/<slug>.html) — berperan sebagai
     SUMBER KONTEN & deep-link fallback. Navigasi/URL tab sendiri memakai hash
     shell `/p/pos.html#<Tab>`: saat shell #pos-page aktif, konten tab TIDAK
     dibaca dari blok x-show di pos.html, melainkan di-fetch utuh dari feed
     Blogger (GET biasa, bebas CORS `*`; TANPA JSONP — lihat REFACTOR_PLAN
     keputusan #1) lalu di-inject ke #pos-tab-content oleh engine ini.
     Seluruh state (cart, dbId, token) tetap hidup di scope posPlugin shell —
     konten feed hanya "markup murni" yang ter-bind ke scope tersebut.   */
  var POS_SHELL_PATH = '/p/pos.html';
  var POS_FEED_LABEL = 'ezy-pos-tab';
  var POS_FEED_TTL = 5 * 60 * 1000; // indeks & konten tab di-cache 5 menit
  var POS_TAB_SLUG_TO_ID = { sale: 'Sale', catalog: 'Catalog', transactions: 'Transactions', shifts: 'Shifts' };
  var POS_TAB_TITLES = { sale: 'Kasir', catalog: 'Katalog', transactions: 'Transaksi', shifts: 'Shift' };
  var POS_TAB_ID_TO_SLUG = {};
  (function () {
    for (var k in POS_TAB_SLUG_TO_ID) {
      if (Object.prototype.hasOwnProperty.call(POS_TAB_SLUG_TO_ID, k)) {
        POS_TAB_ID_TO_SLUG[POS_TAB_SLUG_TO_ID[k]] = k;
      }
    }
  })();

  // Normalisasi hash → slug tab. Menerima '#Catalog', '#catalog', atau ID apa
  // pun yang dikenal; SELALU mengembalikan slug lowercase ('catalog') atau ''.
  function posSlugFromHash(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!h) { return ''; }
    var lower = h.toLowerCase();
    if (POS_TAB_SLUG_TO_ID[lower]) { return lower; }
    return POS_TAB_ID_TO_SLUG[h] || '';
  }

  // Slug tab dari PATHNAME permalink post Blogger (/yyyy/mm/<slug>.html).
  // '' bila bukan permalink tab POS. Dipakai untuk deep-link langsung
  // (takeover) & matcher route; navigasi internal memakai hash shell
  // (lihat posSlugFromLocation).
  function posTabSlugForPath(path) {
    var m = String(path || '').match(/^\/(\d{4})\/(\d{2})\/([a-z0-9-]+)\.html$/);
    if (m && POS_TAB_SLUG_TO_ID[m[3]]) { return m[3]; }
    return '';
  }
  function posTabTitleFor(slug) {
    return POS_TAB_TITLES[slug] || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'POS');
  }
  // Slug tab aktif dari location. Prioritas: permalink pathname (deep-link
  // langsung) → hash shell /p/pos.html#<Tab> (navigasi internal) →
  // __posBootSlug (shell dibangun via fetch saat pos.js belum sempat baca URL).
  function posSlugFromLocation() {
    var p = posTabSlugForPath(window.location.pathname);
    if (p) { return p; }
    var h = posSlugFromHash(window.location.hash);
    if (h) { return h; }
    return window.__posBootSlug || '';
  }
  // Adopsi URL kanonik tab: /p/pos.html#<Tab>. Bila SUDAH di shell ber-hash
  // (peralihan antar-tab) → pushState (memberi riwayat antar-tab). Bila berasal
  // dari URL lain (permalink deep-link / shell tanpa hash) → replaceState agar
  // tidak memerangkap tombol back (entri lama diganti, bukan ditambah). TIDAK
  // pernah mengarah ke permalink.
  function adoptPosUrl(slug) {
    var id = POS_TAB_SLUG_TO_ID[slug];
    if (!id) { return; }
    var want = POS_SHELL_PATH + '#' + id;
    var cur = (window.location.pathname + window.location.hash).replace(/\/$/, '');
    if (cur === want) { return; }
    var onShellHash = window.location.pathname.replace(/\/$/, '') === POS_SHELL_PATH && !!window.location.hash;
    var st = { spa: true, path: POS_SHELL_PATH, posTab: slug };
    try {
      if (onShellHash) { window.history.pushState(st, '', want); }
      else { window.history.replaceState(st, '', want); }
    } catch (e) { }
  }

  // Instance posPlugin yang sedang hidup. Pindai SELURUH _x_dataStack untuk
  // objek yang benar-benar scope posPlugin (punya resolveFeedMode) — elemen
  // teratas stack bisa berupa scope Alpine lain (nested x-data / root), bukan
  // selalu data component kita. Fallback: elemen teratas.
  function getPosInst() {
    try {
      var el = document.getElementById('pos-page');
      if (!el) { return null; }
      var s = el._x_dataStack;
      if (s && s.length) {
        for (var i = s.length - 1; i >= 0; i--) {
          var c = s[i];
          if (c && typeof c.resolveFeedMode === 'function') { return c; }
        }
        return s[s.length - 1];
      }
    } catch (e) { }
    return null;
  }

  /* Indeks feed: url + POSTID per slug (label ezy-pos-tab). Cache TTL 5 min.
     Beban ringan (summary feed) & idempoten — anti-race antar-tab ditangani
     caller lewat perbandingan slug sesudah await, bukan di sini. */
  var __posFeedIndex = null;
  var __posFeedIndexAt = 0;
  // Petakan feed summary → { slug: {id, slug, url, title} }. Hanya post yang
  // URL permalinknya cocok dengan slug tab POS yang dipakai (aman dari noise
  // post lain pada fallback "semua post").
  function indexFromEntries(json) {
    var map = {};
    var entries = (json && json.feed && json.feed.entry) || [];
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i] || {};
      var idm;
      try { idm = String(en.id && en.id.$t || '').match(/post-(\d+)/); } catch (e) { idm = null; }
      if (!idm) { continue; }
      var urlPath = '';
      var links = en.link || [];
      for (var li = 0; li < links.length; li++) {
        var lk = links[li] || {};
        if (lk.rel === 'alternate' && lk.href) {
          try { urlPath = new URL(lk.href, window.location.href).pathname; } catch (e) { urlPath = ''; }
          break;
        }
      }
      if (!urlPath) { continue; }
      var sm = urlPath.match(/\/(\d{4})\/(\d{2})\/([a-z0-9-]+)\.html$/);
      var slug = sm ? sm[3] : '';
      if (!slug || !POS_TAB_SLUG_TO_ID[slug]) { continue; }
      map[slug] = { id: idm[1], slug: slug, url: urlPath, title: String(en.title && en.title.$t || '') };
    }
    return map;
  }
  function cachePosFeedIndex(map) { __posFeedIndex = map; __posFeedIndexAt = Date.now(); }
  function loadPosFeedIndex(force) {
    if (!force && __posFeedIndex && (Date.now() - __posFeedIndexAt) < POS_FEED_TTL) {
      return Promise.resolve(__posFeedIndex);
    }
    var url = '/feeds/posts/summary/-/' + POS_FEED_LABEL + '?alt=json';
    return window.fetch(url).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(indexFromEntries).then(function (map) {
      if (Object.getOwnPropertyNames(map).length) { cachePosFeedIndex(map); return map; }
      // Label feed kosong (label 'ezy-pos-tab' belum dipakai post) → fallback:
      // scan seluruh post lalu petakan via slug permalink. Label tetap cara
      // kanonik (PRD), fallback ini menjaga engine tetap jalan walau label
      // post tidak konsisten.
      return window.fetch('/feeds/posts/summary?alt=json&max-results=500').then(function (r2) {
        if (!r2.ok) { throw new Error('HTTP ' + r2.status); }
        return r2.json();
      }).then(indexFromEntries).then(function (m) {
        if (!Object.getOwnPropertyNames(m).length) { throw new Error('Tidak ada post tab POS ditemukan'); }
        cachePosFeedIndex(m);
        return m;
      });
    });
  }

  // Kartu error feed (Fase 4): satu-satunya fallback bila feed gagal — blok
  // tab legacy sudah DIHAPUS dari shell, jadi error TIDAK lagi jatuh ke tab
  // lama. markup & @click via Alpine (initTree di injectTabContent) sehingga
  // tombol "Coba Lagi" memanggil method retry aktif (resolveFeedMode /
  // syncHashRoute).
  function escFeedText(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function posFeedErrorCard(msg, retryFn) {
    return '<div class="pos-page-view flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">' +
      '<div class="flex w-full flex-col gap-2">' +
      '<span class="font-semibold">Gagal memuat konten tab.</span>' +
      '<span class="text-xs">' + escFeedText(msg) + '</span>' +
      '<div><button type="button" @click="' + (retryFn || 'resolveFeedMode') + '()" ' +
      'class="mt-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/40">Coba Lagi</button></div>' +
      '</div></div>';
  }

  // Bersihkan output feed menjadi HTML murni: buang bungkus CDATA, <script>
  // & <link> (post Blogger bisa menyimpan keduanya sembarangan). <style>
  // DISIMPAN — scoped CSS inline per tab (Fase 5, §9.5) menumpang di sini.
  // Wrapper #<slug>-page dibiarkan utuh.
  // x-ignore pada akar (guard anti badai Alpine di homepage/search/archive —
  // lihat komentar di masing-masing file tabs/*.html) DIHAPUS di sini: konten
  // ini hanya akan masuk ke #pos-tab-content di DALAM shell (ada ancestor
  // x-data="posPlugin"), jadi harus alive saat Alpine.initTree dijalankan.
  function cleanupFeedContent(raw) {
    var html = String(raw || '');
    html = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<link[^>]*>/gi, '');
    html = html.replace(/\s+x-ignore(?:="[^"]*"|='[^']*')?/gi, '');
    return html;
  }

  // Ambil HTML konten tab via feed per-post (/feeds/posts/default/<POSTID>).
  // Cache TTL 5 menit per slug. Reject bila post tidak ada / konten kosong.
  function loadPosTabContent(slug) {
    var c = window.__posTabCache && window.__posTabCache[slug];
    if (c && (Date.now() - c.at) < POS_FEED_TTL) { return Promise.resolve(c.html); }
    return loadPosFeedIndex().then(function (idx) {
      var meta = (idx && idx[slug]) || null;
      if (!meta || !meta.id) { throw new Error('Post tab tidak ditemukan: ' + slug); }
      return window.fetch('/feeds/posts/default/' + meta.id + '?alt=json').then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      });
    }).then(function (json) {
      var raw = '';
      try {
        // Feed per-post (default/<POSTID>) membungkus entry di ROOT
        // {"entry":{...}}; feed list (summary) memakai {"feed":{entry:[...]}}.
        var jid = json || {};
        var single = jid.entry || (jid.feed && jid.feed.entry && jid.feed.entry[0]) || null;
        raw = String((single && single.content && single.content.$t) || '');
      } catch (e) { raw = ''; }
      if (!raw) { throw new Error('Konten tab kosong: ' + slug); }
      return cleanupFeedContent(raw);
    }).then(function (html) {
      window.__posTabCache = window.__posTabCache || {};
      window.__posTabCache[slug] = { html: html, at: Date.now() };
      return html;
    });
  }

  // Bangun markup shell POS dari halaman nyata /p/pos.html (fetch + parse
  // #pos-page). CSS layout TIDAK lagi via <link> CDN (Fase 5, §9.5) — sudah
  // di-*inline* minified ke blok <style> DI DALAM #pos-page, jadi ikut
  // terbawa otomatis oleh outerHTML. Prosedur ini hanya bertahan sebagai
  // fallback kompat: bila ada versi /p/pos.html tua yang masih memakai
  // <link ... pos.css>, stylesheet-nya tetap disalin ke <head>.
  function adoptPosShellCss(doc) {
    try {
      var links = doc.querySelectorAll('link[rel="stylesheet"]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        if (href.indexOf('pos.css') === -1) { continue; }
        if (document.querySelector('link[rel="stylesheet"][href*="pos.css"]')) { continue; }
        var L = document.createElement('link');
        L.rel = 'stylesheet';
        L.href = href;
        (document.head || document.documentElement).appendChild(L);
      }
    } catch (e) { }
  }
  function fetchPosShellMarkup() {
    return window.fetch(POS_SHELL_PATH, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var el = doc && doc.getElementById ? doc.getElementById('pos-page') : null;
        if (!el) { throw new Error('Shell POS tidak ditemukan di ' + POS_SHELL_PATH); }
        adoptPosShellCss(doc);
        return el.outerHTML;
      });
  }

  /* ===== formatRupiah GLOBAL (fallback scope) =======================
     Method formatRupiah() tetap ada di komponen posPlugin — dipakai saat
     scope komponen sehat. Fungsi global ini hanya penjamin: ekspresi
     Alpine (mis. `formatRupiah(p.price)`) yang dievaluasi pada pass/clone
     dengan scope posPlugin hilang tetap resolve ke sini, sehingga badai
     'formatRupiah is not defined' tidak pernah muncul lagi dan harga tetap
     ter-format. Idempoten: didefinisikan sekali.
  */
  if (typeof window.formatRupiah !== 'function') {
    window.formatRupiah = function (val) {
      var n = Number(val);
      return isNaN(n) ? (val || 'Rp 0') : 'Rp ' + n.toLocaleString('id-ID');
    };
  }

  /* ===== Loader overlay GLOBAL (pola calendar.html) ======================
     SATU loader overlay untuk SEMUA halaman modul via
     window.EzyFast.loader.show('...')/hide() — didefinisikan di template
     (blok "Global Overlay Loader", ref-count: show/hide boleh bertumpuk).
     Dipakai untuk fase boot (pemulihan dbId + muat data awal) DAN refetch
     per-tab (Catalog/Transactions/Shifts) — overlay menutupi seluruh area
     konten pada tab yang sedang aktif. Ref-count template membuat show/hide
     bersarang aman: setiap show menaikkan counter, tiap hide menurunkannya.
     Overlay per-kartu (.ezy-card-loader/.ezy-table-loading) dipertahankan
     sebagai fallback bila shell loader belum tersedia (preview standalone /
     guard `window.EzyFast.loader` kosong). Idempoten & aman dipanggil
     berulang (text berubah tiap show). */
  function showPosLoader(text) {
    try {
      if (window.EzyFast && window.EzyFast.loader &&
        typeof window.EzyFast.loader.show === 'function') {
        window.EzyFast.loader.show(text || 'Memuat data POS...');
      }
    } catch (e) { }
  }
  function hidePosLoader() {
    try {
      if (window.EzyFast && window.EzyFast.loader &&
        typeof window.EzyFast.loader.hide === 'function') {
        window.EzyFast.loader.hide();
      }
    } catch (e) { }
  }

  /* ===== Config mandiri (pola getCfg() di calendar.html) =================
     EzyFast bridge (`window.EzyFast.getConfig`) TIDAK dijadikan satu-satunya
     sumber: bila bridge belum siap atau CONFIG-nya terkunci kosong, baca
     langsung dari elemen #ezyfast-core-config (widget Blogger) via regex.
     Ini membuat pos.js mampu menghubungi server walau localStorage di-clear
     atau bridge gagal — behavior yang sama dgn plugin inline (calendar). */
  var __posCfg = null;
  function resolveConfig() {
    if (__posCfg) { return __posCfg; }
    var cfg = null;
    try {
      if (window.EzyFast && typeof window.EzyFast.getConfig === 'function') {
        var c = window.EzyFast.getConfig();
        if (c && c.gasApiEndpoint && !/YOUR_WEB_APP_ID|YOUR_SCRIPT_ID|PASTE_/i.test(c.gasApiEndpoint)) {
          cfg = c;
        }
      }
    } catch (e) { }
    if (!cfg) {
      try {
        var el = document.getElementById('ezyfast-core-config');
        var raw = (el && el.textContent) || '';
        var m, d = {};
        m = raw.match(/"gasApiEndpoint"\s*:\s*"([^"]*)"/);
        if (m) { d.gasApiEndpoint = m[1]; }
        m = raw.match(/"blogId"\s*:\s*"([^"]*)"/);
        if (m) { d.blogId = m[1]; }
        m = raw.match(/"pageId"\s*:\s*"([^"]*)"/);
        if (m) { d.pageId = m[1]; }
        if (d.gasApiEndpoint && /YOUR_WEB_APP_ID|YOUR_SCRIPT_ID|PASTE_/i.test(d.gasApiEndpoint)) {
          d.gasApiEndpoint = '';
        }
        if (!d.pageId) {
          // 1. Coba tangkap ID permanen dari meta tag bawaan Blogger
          var metaPost = document.querySelector("meta[itemprop='postId']");

          if (metaPost && metaPost.getAttribute("content")) {
            d.pageId = metaPost.getAttribute("content");
          } else {
            // 2. Fallback terakhir jika ID benar-benar tidak ditemukan (menggunakan URL)
            d.pageId = window.location.pathname.replace(/\/+$/, '') || '';
          }
        }
        if (d.gasApiEndpoint || d.blogId || d.pageId) { cfg = d; }
      } catch (e2) { }
    }
    if (cfg && cfg.gasApiEndpoint) { __posCfg = cfg; }
    return cfg || null;
  }

  /* ===== Pagination/Filter — memo + windowed page =====================
     Pipeline filter+sort dipanggil berkali-kali dalam SATU render pass
     (catalogFiltered, catalogTotalPages, catalogPaged, catalogStart/End,
     page-window — masing-masing menjalankan ulang filter & sort penuh).
     Memo berbasis (referensi array sumber + kunci query/sort) membuat
     kerja berat hanya berjalan sekali per perubahan data bersangkutan.
     Keunikan Alpine: getter tetap menulis ulang kunci dari nilai reaktif
     di SETIAP akses (mendaftarkan dependensi untuk re-render), tapi hasil
     sort/filter bila kunci sama & sumber identik cukup dibaca dari cache.
  */
  var __posMemoCatalog = null;
  var __posMemoTx = null;
  function catalogMemo(self) {
    var key = (self.catalogQuery || '').toLowerCase() + '|' + self.catalogSort.key + '|' + (self.catalogSort.asc ? '1' : '0');
    var m = __posMemoCatalog;
    if (m && m.src === self.catalogProducts && m.key === key) { return m.val; }
    var q = (self.catalogQuery || '').toLowerCase();
    var list = self.catalogProducts.filter(function (p) {
      if (!p || p.status === 'inactive') return false;
      var hay = String((p.name || '') + ' ' + (p.category || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    var sk = self.catalogSort.key;
    var asc = self.catalogSort.asc;
    var sorted = list.slice().sort(function (a, b) {
      var va, vb;
      if (sk === 'price' || sk === 'stock') {
        va = Number(a[sk]) || 0; vb = Number(b[sk]) || 0;
      } else {
        va = String(a[sk] || '').toLowerCase();
        vb = String(b[sk] || '').toLowerCase();
      }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    __posMemoCatalog = { src: self.catalogProducts, key: key, val: sorted };
    return sorted;
  }
  function txMemo(self) {
    var key = (self.txQuery || '').toLowerCase() + '|' + self.txSort.key + '|' + (self.txSort.asc ? '1' : '0');
    var m = __posMemoTx;
    if (m && m.src === self.transactions && m.key === key) { return m.val; }
    var q = (self.txQuery || '').toLowerCase();
    var filtered = self.transactions.filter(function (t) {
      if (!t) return false;
      var hay = String((t.id || '') + ' ' + (t.cashier_id || '') + ' ' + (t.payment_method || '') + ' ' + (t.status || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    var sk = self.txSort.key;
    var asc = self.txSort.asc;
    var sorted = filtered.slice().sort(function (a, b) {
      var va = String(a[sk] || '').toLowerCase();
      var vb = String(b[sk] || '').toLowerCase();
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    __posMemoTx = { src: self.transactions, key: key, val: sorted };
    return sorted;
  }
  // Jendela nomor halaman ber-ellipsis: selalu 1 & terakhir, ±spread di
  // sekitar halaman aktif, gap ditandai {type:'gap'} — bukan ratusan tombol.
  function posPageWindow(page, total, spread) {
    if (total <= 1) { return [{ type: 'p', n: 1, key: 'p1' }]; }
    var s = spread || 2;
    var items = [];
    var pushBtn = function (n) { items.push({ type: 'p', n: n, key: 'p' + n }); };
    var pushGap = function (k) { items.push({ type: 'gap', n: null, key: 'g' + k }); };
    if (total <= s * 2 + 1) {
      for (var i = 1; i <= total; i++) { pushBtn(i); }
      return items;
    }
    var start = Math.max(2, page - s);
    var end = Math.min(total - 1, page + s);
    pushBtn(1);
    if (start > 2) { pushGap('l'); }
    for (var j = start; j <= end; j++) { pushBtn(j); }
    if (end < total - 1) { pushGap('r'); }
    pushBtn(total);
    return items;
  }

  function registerPosAlpine() {
    if (window.__posAlpineRegistered) return;
    if (!window.Alpine || typeof window.Alpine.data !== 'function') return;
    window.__posAlpineRegistered = true;
    var Alpine = window.Alpine;
    // Dropdown aksi per-baris ala TailAdmin (demo products-list):
    // panel fixed + flip ke atas terukur bila overflow viewport.
    // Sengaja TANPA this.$el/$refs/$nextTick/$watch di dalam method:
    // button & panel dioper dari template agar kebal konteks init.
    Alpine.data('posTxDropdown', () => ({
      open: false,
      toggle(ev, panel) {
        this.open = !this.open;
        if (!this.open) return;
        var btn = ev && ev.currentTarget ? ev.currentTarget : null;
        if (!btn || !panel) return;
        var place = function () {
          try {
            var rect = btn.getBoundingClientRect();
            panel.style.position = 'fixed';
            panel.style.left = 'auto'; // wajib: agar 'right' di bawah tidak diabaikan browser
            panel.style.top = (rect.bottom + window.scrollY) + 'px';
            panel.style.right = (window.innerWidth - rect.right) + 'px';
            panel.style.zIndex = '999';
            // Flip ke atas (di atas tombol/paginasi) bila overflow viewport
            var pr = panel.getBoundingClientRect();
            if (pr.bottom > window.innerHeight) {
              panel.style.top = (rect.top + window.scrollY - pr.height) + 'px';
            }
          } catch (e) { }
        };
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () { requestAnimationFrame(place); });
        } else {
          setTimeout(place, 0);
        }
      }
    }));
    Alpine.data('posPlugin', () => ({
      activeTab: 'Sale',
      // Mode feed: posFeedActive=true saat tab aktif dirender dari feed
      // Blogger ke #pos-tab-content; URL tetap /p/pos.html#<Tab>. posFeedSlug =
      // slug aktif; posFeedError pesan kegagalan feed. (Blok tab legacy sudah
      // dihapus dari shell — seluruh konten tab berasal dari feed post.)
      posFeedActive: false,
      posFeedSlug: '',
      posFeedError: '',
      catalogLoading: true,
      txLoading: true,
      shiftsLoading: true,
      catalogLoaded: false,
      txLoaded: false,
      shiftsLoaded: false,
      submitting: false,
      dbReady: false,
      dbId: null,
      toastMsg: '',
      toastType: 'success',

      /* ===== Catalog ===== */
      catalogProducts: [],
      catalogQuery: '',
      catalogSort: { key: 'name', asc: true },
      catalogPage: 1,
      catalogPerPage: 10,

      /* ===== Cart ===== */
      cart: [],
      cartDiscount: 0,

      /* ===== Transactions ===== */
      transactions: [],
      txQuery: '',
      txSort: { key: 'created_at', asc: false },
      txPage: 1,
      txPerPage: 10,
      txSelected: [],

      /* ===== Shifts ===== */
      shifts: [],
      currentShift: null,
      shiftModalOpen: false,
      shiftMode: 'open',
      shiftForm: { opening_cash: 0, cashier_id: '' },
      closeShiftForm: { closing_cash: 0 },
      shiftSort: { key: 'started_at', asc: false },

      /* ===== Payment ===== */
      payModalOpen: false,
      payMethod: 'cash',
      payAmount: 0,
      pendingTxId: null,

      /* ===== Product Form (CRUD) ===== */
      productModalOpen: false,
      editingProductId: null,
      productForm: { name: '', description: '', price: 0, stock: 0, category: '', image_url: '', status: 'active' },
      productUploading: false,
      productUploadErr: '',

      /* ===== Transaction Detail ===== */
      txDetailModalOpen: false,
      txDetail: null,

      /* ===== Struk / Print / Export ===== */
      receiptTx: null,
      receiptModalOpen: false,

      /* ===== Computed: Cart ===== */
      get cartSubtotal() {
        return this.cart.reduce(function (s, i) { return s + i.subtotal; }, 0);
      },
      get cartTax() {
        return Math.round(this.cartSubtotal * 0.11);
      },
      get cartTotal() {
        return this.cartSubtotal + this.cartTax - this.cartDiscount;
      },
      get payChange() {
        return Math.max(0, this.payAmount - this.cartTotal);
      },

      /* ===== Computed: Catalog ===== */
      get catalogFiltered() {
        return catalogMemo(this);
      },

      get catalogTotalPages() {
        return Math.max(1, Math.ceil(this.catalogFiltered.length / this.catalogPerPage));
      },
      get catalogPaged() {
        var page = Math.min(this.catalogPage, this.catalogTotalPages);
        var start = (page - 1) * this.catalogPerPage;
        return this.catalogFiltered.slice(start, start + this.catalogPerPage);
      },
      get catalogStart() {
        var page = Math.min(this.catalogPage, this.catalogTotalPages);
        return this.catalogFiltered.length === 0 ? 0 : (page - 1) * this.catalogPerPage + 1;
      },
      get catalogEnd() {
        var page = Math.min(this.catalogPage, this.catalogTotalPages);
        return Math.min(page * this.catalogPerPage, this.catalogFiltered.length);
      },
      get catalogPageWindow() {
        return posPageWindow(this.catalogPage, this.catalogTotalPages, 2);
      },

      /* ===== Computed: Transactions ===== */
      get txFiltered() {
        return txMemo(this);
      },
      get txSorted() {
        return txMemo(this);
      },
      get txTotalPages() {
        return Math.max(1, Math.ceil(this.txSorted.length / this.txPerPage));
      },
      get txPaged() {
        var start = (this.txPage - 1) * this.txPerPage;
        return this.txSorted.slice(start, start + this.txPerPage);
      },
      get txStart() {
        return this.txSorted.length === 0 ? 0 : (this.txPage - 1) * this.txPerPage + 1;
      },
      get txEnd() {
        return Math.min(this.txPage * this.txPerPage, this.txSorted.length);
      },
      get txPageWindow() {
        return posPageWindow(this.txPage, this.txTotalPages, 2);
      },

      /* ===== Computed: Shifts ===== */
      get shiftsFiltered() {
        var self = this;
        var key = self.shiftSort.key;
        var asc = self.shiftSort.asc;
        return this.shifts.slice().sort(function (a, b) {
          var va, vb;
          if (key === 'opening_cash' || key === 'closing_cash' || key === 'difference') {
            va = Number(a[key]) || 0; vb = Number(b[key]) || 0;
          } else {
            va = String(a[key] || '').toLowerCase();
            vb = String(b[key] || '').toLowerCase();
          }
          if (va < vb) return asc ? -1 : 1;
          if (va > vb) return asc ? 1 : -1;
          return 0;
        });
      },

      /* ===== Computed: Transaction Detail ===== */
      get txDetailItems() {
        if (!this.txDetail) return [];
        try {
          var items = JSON.parse(this.txDetail.items_json || '[]');
          return Array.isArray(items) ? items : [];
        }
        catch (e) { return []; }
      },

      /* ===== Computed: Struk ===== */
      get receiptItems() {
        if (!this.receiptTx) return [];
        try {
          var rItems = JSON.parse(this.receiptTx.items_json || '[]');
          return Array.isArray(rItems) ? rItems : [];
        }
        catch (e) { return []; }
      },

      /* ===== Helpers ===== */
      formatRupiah(val) {
        var n = Number(val);
        return isNaN(n) ? (val || 'Rp 0') : 'Rp ' + n.toLocaleString('id-ID');
      },
      txItemCount(t) {
        if (!t) return '-';
        try {
          var items = JSON.parse(t.items_json || '[]');
          return items.length + ' item';
        } catch (e) { return '-'; }
      },
      uniqById(list) {
        var seen = {};
        return (list || []).filter(function (r) {
          if (!r || r.id === undefined || r.id === null || String(r.id).trim() === '') return false;
          var k = String(r.id);
          if (seen[k]) return false;
          seen[k] = true;
          return true;
        });
      },
      toast(msg, type) {
        var t = type || 'success';
        // Sinkron ke toast global template (EzyFast_Admin_Panel.xml:1789,
        // listen 'ezy:toast.window') bila shell tersedia — satu sumber toast.
        var hasShell = false;
        try { hasShell = !!document.querySelector('.ezy-toast'); } catch (e) { }
        if (hasShell) {
          try {
            if (window.EzyFast && typeof window.EzyFast.toast === 'function') {
              window.EzyFast.toast(msg, t);
            } else {
              window.dispatchEvent(new CustomEvent('ezy:toast', { detail: { message: msg, type: t } }));
            }
          } catch (e) { }
          return;
        }
        // Fallback lokal bila shell template tidak ada (preview standalone).
        var self = this;
        self.toastMsg = msg;
        self.toastType = t;
        setTimeout(function () { self.toastMsg = ''; }, 3000);
      },

      /* ===== Config & API (fetch/POST CORS-safe) ===== */
      get apiUrl() {
        var cfg = resolveConfig();
        return (cfg && cfg.gasApiEndpoint) || '';
      },
      get blogId() {
        var cfg = resolveConfig();
        return (cfg && cfg.blogId) || '';
      },
      get pageId() {
        var cfg = resolveConfig();
        return (cfg && cfg.pageId) || '';
      },

      apiFetch(action, options) {
        // fetch/POST CORS-safe (pola store.api): Content-Type
        // text/plain;charset=utf-8 + TANPA header Authorization agar request
        // "simple" (tanpa preflight OPTIONS yang diblokir GAS); blogId &
        // token dikirim di body. GAS membalas ACAO:* → res.json() terbaca.
        if (!this.apiUrl) { return Promise.resolve(null); }
        var self = this;
        var payload = Object.assign({}, options || {});
        payload.action = action;
        if (self.blogId && !('blogId' in payload)) { payload.blogId = self.blogId; }
        try {
          var token = localStorage.getItem('ezy_auth_token');
          if (token && !('token' in payload)) { payload.token = token; }
        } catch (e) { }
        var attempt = 0;
        var MAX_RETRIES = 2;
        var TIMEOUT_MS = 30000;
        return new Promise(function (resolve, reject) {
          function exec() {
            var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
            var done = function () { if (timer) { clearTimeout(timer); } };
            fetch(self.apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload),
              signal: controller ? controller.signal : undefined
            }).then(function (res) {
              if (!res.ok) { throw new Error('HTTP ' + res.status); }
              return res.json();
            }).then(function (data) {
              done();
              resolve(data);
            }).catch(function (err) {
              done();
              if (attempt < MAX_RETRIES) {
                attempt++;
                setTimeout(exec, 1000 * attempt);
              } else {
                reject(err);
              }
            });
          }
          exec();
        });
      },

      async api(action, params) {
        if (!this.apiUrl) {
          this.toast('GAS endpoint belum dikonfigurasi', 'error');
          return null;
        }
        try {
          var result = await this.apiFetch(action, params || {});
          return result;
        } catch (e) {
          // Error jaringan terekposisi ke toast POS (unifikasi Fase 5: modal
          // #pos-api-error sudah dihapus — sebelumnya hanya overlay pemisahan
          // arsitektur lama yang mana-dipakai sebagai lapisan kedua blokir).
          var msg = (e && e.message) || 'Gagal terhubung ke server.';
          this.toast('POS gagal terhubung ke server: ' + msg, 'error');
          return null;
        }
      },

      /* ===== Init ===== */
      async init() {
        // Slug tab aktif dari URL: permalink (deep-link langsung) → hash shell
        // /p/pos.html#<Tab> (navigasi internal) → __posBootSlug (shell dibangun
        // via fetch; pos.js belum sempat baca URL saat itu).
        this.posFeedSlug = posSlugFromLocation();
        // Shell feed-first: pertahankan URL hash shell (TIDAK redirect ke
        // permalink post). syncHashRoute menormalkan /p/pos.html → /p/pos.html#<Tab>
        // (default 'sale'; #X → tab terkait) + set posFeedSlug/activeTab; render
        // dilakukan blok `if (this.posFeedSlug) resolveFeedMode()` di bawah.
        await this.syncHashRoute();
        // Listener hashchange terpasang SEKALI (shell bisa di-re-inject SPA →
        // init berulang; tanpa guard, listener menumpuk). Handler me-resolve
        // instance terkini via getPosInst().
        if (!window.__posHashBound) {
          window.__posHashBound = true;
          window.addEventListener('hashchange', function () {
            var inst = getPosInst();
            if (!inst || typeof inst.syncHashRoute !== 'function') { return; }
            inst.syncHashRoute().then(function () {
              try { inst.resolveFeedMode(); } catch (e) { }
            }).catch(function () { });
          });
        }
        // Menu aksi fixed tidak mengikuti scroll — tutup saat ada scroll
        // di kontainer mana pun (capture: scroll tidak bubble) & saat resize.
        // Terpasang SEKALI (guard) agar tidak menumpuk saat shell di-re-inject.
        if (!window.__posScrollBound) {
          window.__posScrollBound = true;
          window.addEventListener('scroll', function () {
            var i = getPosInst(); if (i) { try { i.closeTxMenus(); } catch (e) { } }
          }, true);
          window.addEventListener('resize', function () {
            var i = getPosInst(); if (i) { try { i.closeTxMenus(); } catch (e) { } }
          });
        }
        // Boot: overlay loader GLOBAL (pola calendar.html) — tampil selama
        // pemulihan dbId (__ezyPosDbReady) + muat katalog awal, lalu hide di
        // SEMUA jalur selesai (try/catch/finally) agar show/hide berpasangan
        // (loader global ref-counted; show tanpa hide = overlay menggantung).
        showPosLoader('Memuat data POS...');
        try {
          await this.checkDbReady();
          if (this.dbReady) {
            // Hybrid SPA: tab aktif dimuat saat init; tab lain dimuat lazy via
            // ensureTabLoaded (dipicu resolveFeedMode saat tab dikunjungi) —
            // loader per-kartunya ikut aktif di kunjungan pertama tiap tab.
            await this.loadCatalog();
            // Deep-link langsung (#Transactions/#Shifts/#Catalog): tab aktif
            // saat boot ikut dimuat (dbId sudah tersedia sekarang).
            this.ensureTabLoaded(this.activeTab);
          } else {
            this.catalogLoading = false;
            this.txLoading = false;
            this.shiftsLoading = false;
          }
        } catch (e) {
          // Jalur error: matikan loader per-kartu & tetap hide overlay global.
          this.catalogLoading = false;
          this.txLoading = false;
          this.shiftsLoading = false;
        } finally {
          hidePosLoader();
        }
        // Prefill kasir dari user login agar tidak jatuh ke 'default'
        if (!this.shiftForm.cashier_id) {
          var loginName = this.loginCashierName();
          if (loginName) this.shiftForm.cashier_id = loginName;
        }
        // Mode feed: setelah db datang (state shell sehat), render konten tab
        // dari feed Blogger ke #pos-tab-content — independen dari boot db.
        if (this.posFeedSlug) {
          try { this.resolveFeedMode(); } catch (e) { }
        }
        var self = this;
        setTimeout(function () { self.paintSortArrows(); }, 100);
        // Jaga halaman tetap valid saat hasil filter menyusut: perbesar
        // per-halaman / ketik query / sort bisa membuat catalogPage naik di
        // atas jumlah halaman yang tersisa → clamp otomatis ke halaman akhir.
        if (typeof this.$watch === 'function') {
          var clampCat = function () {
            if (self.catalogPage > self.catalogTotalPages) { self.catalogPage = self.catalogTotalPages; }
          };
          var clampTx = function () {
            if (self.txPage > self.txTotalPages) { self.txPage = self.txTotalPages; }
          };
          try { this.$watch(function () { return self.catalogFiltered.length; }, clampCat); } catch (e) { }
          try { this.$watch(function () { return self.txSorted.length; }, clampTx); } catch (e) { }
          try { this.$watch(function () { return self.catalogPerPage; }, clampCat); } catch (e) { }
          try { this.$watch(function () { return self.txPerPage; }, clampTx); } catch (e) { }
        }
      },

      // Sinkronisasi rute hash shell. Pathname SUDAH permalink tab (deep-link
      // langsung /yyyy/mm/<slug>.html) → set state + kanonikalisasi URL ke hash
      // shell. Selain itu: baca hash #<Tab> (default 'sale'), set
      // posFeedSlug/activeTab, lalu NORMALKAN URL ke /p/pos.html#<Tab> tanpa
      // reload — TIDAK mengganti ke permalink post, sesuai permintaan user.
      // Render konten dilakukan pemanggil (init / hashchange) lewat
      // resolveFeedMode() agar konten tetap berasal dari feed post.
      async syncHashRoute() {
        var permalinkSlug = posTabSlugForPath(window.location.pathname);
        if (permalinkSlug) {
          if (permalinkSlug !== this.posFeedSlug) {
            this.posFeedSlug = permalinkSlug;
            if (POS_TAB_SLUG_TO_ID[permalinkSlug]) { this.activeTab = POS_TAB_SLUG_TO_ID[permalinkSlug]; }
          }
          adoptPosUrl(permalinkSlug);
          return;
        }
        var hash = String(window.location.hash || '').replace(/^#/, '');
        var slugFromHash = posSlugFromHash(hash);
        var idx = null;
        try { idx = await loadPosFeedIndex(); } catch (e) { idx = null; }
        var targetSlug = slugFromHash || (idx && idx.sale ? 'sale' : '');
        if (!targetSlug && idx) {
          for (var s in idx) {
            if (Object.prototype.hasOwnProperty.call(idx, s)) { targetSlug = s; break; }
          }
        }
        var meta = (idx && targetSlug && idx[targetSlug]) || null;
        if (!meta || !meta.url) {
          this.posFeedError = 'Post tab POS belum terbit. Publikasikan 4 post berlabel ezy-pos-tab (sale, catalog, transactions, shifts).';
          this.injectTabContent(posFeedErrorCard(this.posFeedError, 'syncHashRoute'));
          this.revealTabContent();
          return;
        }
        this.posFeedSlug = targetSlug;
        if (POS_TAB_SLUG_TO_ID[targetSlug]) { this.activeTab = POS_TAB_SLUG_TO_ID[targetSlug]; }
        adoptPosUrl(targetSlug);
      },

      // Hybrid SPA: tab yang belum pernah dimuat (loader masih true) dimuat
      // saat pertama kali dikunjungi (hash direct atau klik tab) agar loader
      // per-kartu tampil di kunjungan pertama, bukan hanya saat page-load.
      ensureTabLoaded(tabId) {
        if (!this.dbId) return;
        if (tabId === 'Catalog' && !this.catalogLoaded) { this.loadCatalog(); }
        else if (tabId === 'Transactions' && !this.txLoaded) { this.loadTransactions(); }
        else if (tabId === 'Shifts' && !this.shiftsLoaded) { this.loadShifts(); }
      },

      /* ===== Anti-"bocor" konten tab =================================
         maskTabContent(): sembunyikan & kosongkan #pos-tab-content serta
         set posFeedActive=false SEBELUM memuat tab (fetch feed async).
         Tanpa ini konten tab sebelumnya tetap terlihat selama loader —
         terlihat seperti konten bocor antar-tab. revealTabContent():
         tampilkan kembali konten yang siap setelah inject (display:'' +
         posFeedActive=true). Idempoten & aman dipanggil berulang. */
      maskTabContent() {
        try {
          var host = document.getElementById('pos-tab-content');
          if (host) {
            var prev = host.firstChild;
            if (prev && window.Alpine && typeof window.Alpine.destroyTree === 'function') {
              try { window.Alpine.destroyTree(prev); } catch (e) { }
            }
            host.innerHTML = '';
            host.style.display = 'none';
          }
        } catch (e) { }
        this.posFeedActive = false;
      },
      revealTabContent() {
        try {
          var host = document.getElementById('pos-tab-content');
          if (host) { host.style.display = ''; }
        } catch (e) { }
        this.posFeedActive = true;
      },

      /* ===== Feed Mode ===== */
      // Render konten tab dari feed Blogger ke #pos-tab-content. Membaca slug
      // dari posFeedSlug (set di init / goTab / route handler). Anti-race
      // sinkron vs async dilakukan oleh pemanggil lewat perbandingan slug
      // sesudah await (lihat resolveFeedMode).
      injectTabContent(html) {
        var host = document.getElementById('pos-tab-content');
        if (!host) {
          try {
            host = document.createElement('div');
            host.id = 'pos-tab-content';
            host.className = 'w-full';
            document.getElementById('pos-page').appendChild(host);
          } catch (e) { return; }
        }
        try {
          var prev = host.firstChild;
          if (prev && window.Alpine && typeof window.Alpine.destroyTree === 'function') {
            window.Alpine.destroyTree(prev);
          }
        } catch (e) { }
        host.innerHTML = html;
        // Defensif: lepas x-ignore (guard anti badai Alpine di luar shell) dari
        // akar konten SEBELUM MutationObserver/initTree melihatnya — konten ini
        // sudah berada di dalam #pos-tab-content (ancestor x-data="posPlugin")
        // yang HARUS mengevaluasi ekspresinya. cleanupFeedContent sudah menormalkan
        // ini; strip di sini menjaga cache/pos.js versi lawas yang belum striping.
        try {
          var _root = host.firstElementChild;
          if (_root && _root.hasAttribute && _root.hasAttribute('x-ignore')) {
            _root.removeAttribute('x-ignore');
          }
        } catch (e) { }
        // Anti-router: tautan internal ke tab POS (permalink /yyyy/mm/<slug>.html
        // ATAU /p/pos.html) ditandai data-no-spa agar click-interceptor SPA tidak
        // menavigasi ke permalink. Klik tetap ditangani posFeedClick → goPosTab
        // (hash shell). Defensif: konten feed boleh saja memuat tautan antar-tab.
        try {
          var anchors = host.querySelectorAll('a[href]');
          for (var ai = 0; ai < anchors.length; ai++) {
            var hrefP = '';
            try { hrefP = new URL(anchors[ai].getAttribute('href'), window.location.href).pathname; } catch (e2) { continue; }
            if (posTabSlugForPath(hrefP) || hrefP.replace(/\/$/, '') === POS_SHELL_PATH) {
              anchors[ai].setAttribute('data-no-spa', '1');
            }
          }
        } catch (e) { }
        try {
          if (window.Alpine && typeof window.Alpine.initTree === 'function') {
            window.Alpine.initTree(host);
          }
        } catch (e) { }
      },
      setPosFeedTitle(slug) {
        try {
          var t = posTabTitleFor(slug);
          var bt = document.getElementById('ezy-blog-title');
          var blogName = bt ? (bt.textContent || '').trim() : '';
          document.title = t + (blogName ? ' | ' + blogName : '');
        } catch (e) { }
      },
      async resolveFeedMode() {
        var slug = this.posFeedSlug || posSlugFromLocation();
        // Sembunyikan & kosongkan konten tab lama SEBELUM fetch feed. Tanpa
        // ini konten tab SEBELUMNYA tetap tampil (host x-show posFeedActive
        // masih true) selama tab baru dimuat — terasa "bocor" antar-tab.
        this.maskTabContent();
        if (!slug || !POS_TAB_SLUG_TO_ID[slug]) {
          return;
        }
        this.posFeedSlug = slug;
        if (POS_TAB_SLUG_TO_ID[slug]) { this.activeTab = POS_TAB_SLUG_TO_ID[slug]; }
        // Lazy-load DATA tab yang baru diaktifkan (Catalog/Transactions/Shifts)
        // — tanpa ini tabel Transactions/Shifts tetap `*Loading=true` (overlay
        // kartu menggantung) karena load* hanya dipicu di init untuk tab awal.
        try { this.ensureTabLoaded(this.activeTab); } catch (e) { }
        this.posFeedError = '';
        // Indikator loading memakai overlay GLOBAL ref-counted
        // (window.EzyFast.loader via showPosLoader/hidePosLoader) — konsisten
        // dengan boot & load data tab. show/hide WAJIB berpasangan, termasuk
        // job yang disusul job lain (hide di finally tanpa syarat slug) agar
        // ref-count tidak bocor. Konten tab tetap di-fetch dari feed post.
        showPosLoader('Memuat tab ' + posTabTitleFor(slug) + '...');
        try {
          var html = await loadPosTabContent(slug);
          if (this.posFeedSlug !== slug) { return; }
          this.injectTabContent(html);
          this.revealTabContent();
          this.posFeedError = '';
          this.setPosFeedTitle(slug);
          try {
            if (window.__EzySpa && typeof window.__EzySpa.handleHashChange === 'function') {
              window.__EzySpa.handleHashChange();
            }
          } catch (e) { }
        } catch (err) {
          if (this.posFeedSlug !== slug) { return; }
          this.posFeedError = (err && err.message) || 'Gagal memuat konten tab via feed.';
          // Fase 4: blok tab legacy sudah dihapus dari shell → tidak ada
          // fallback tab lama lagi; sajikan kartu error yang bisa di-retry.
          this.injectTabContent(posFeedErrorCard(this.posFeedError, 'resolveFeedMode'));
          this.revealTabContent();
        } finally {
          // Setiap show dipasangkan tepat satu hide (job yang disusul pun).
          hidePosLoader();
        }
      },

      /* ===== Sort Methods ===== */
      sortCatalog(key) {
        if (this.catalogSort.key === key) {
          this.catalogSort.asc = !this.catalogSort.asc;
        } else {
          this.catalogSort = { key: key, asc: true };
        }
        this.catalogPage = 1;
        this.paintSortArrows();
      },
      txSortBy(key) {
        this.closeTxMenus();
        if (this.txSort.key === key) {
          this.txSort.asc = !this.txSort.asc;
        } else {
          this.txSort = { key: key, asc: true };
        }
        this.txPage = 1;
        this.paintSortArrows();
      },
      // Tutup semua dropdown aksi (panel per-baris mendengarkan event ini)
      closeTxMenus() {
        try { window.dispatchEvent(new CustomEvent('pos:closemenus')); } catch (e) { }
      },
      sortShifts(key) {
        if (this.shiftSort.key === key) {
          this.shiftSort.asc = !this.shiftSort.asc;
        } else {
          this.shiftSort = { key: key, asc: true };
        }
        this.paintSortArrows();
      },
      paintSortArrows() {
        var brandColor = '#465fff';
        var brandColorDark = '#7592ff';
        var inactiveLight = '#d0d5dd';
        var inactiveDark = 'rgba(152,162,179,0.5)';
        var self = this;
        var isDark = document.documentElement.classList.contains('dark');
        var allArrows = document.querySelectorAll('[data-sort-arrows]');
        allArrows.forEach(function (holder) {
          var raw = holder.getAttribute('data-sort-arrows');
          var active = false, asc = true;
          if (raw.indexOf('catalog-') === 0) {
            active = self.catalogSort.key === raw.slice(8);
            asc = self.catalogSort.asc;
          } else if (raw.indexOf('tx-') === 0) {
            active = self.txSort.key === raw.slice(3);
            asc = self.txSort.asc;
          } else if (raw.indexOf('shift-') === 0) {
            active = self.shiftSort.key === raw.slice(6);
            asc = self.shiftSort.asc;
          }
          var up = holder.querySelector('[data-sort-up] path');
          var down = holder.querySelector('[data-sort-down] path');
          if (up) up.setAttribute('fill', active && asc ? (isDark ? brandColorDark : brandColor) : (isDark ? inactiveDark : inactiveLight));
          if (down) down.setAttribute('fill', active && !asc ? (isDark ? brandColorDark : brandColor) : (isDark ? inactiveDark : inactiveLight));
        });
      },

      async checkDbReady() {
        var self = this;
        // Bootstrap inline pos.html (self-recovery setelah localStorage.clear())
        // mungkin masih memulihkan dbId via get/set_plugin_meta — tunggu dulu
        // agar fast-path cache terpakai & tidak memicu request ganda. Halaman
        // tanpa bootstrap → promise tak ada → langsung lanjut.
        if (window.__ezyPosDbReady && typeof window.__ezyPosDbReady.then === 'function') {
          try { await window.__ezyPosDbReady; } catch (e) { }
        }
        try {
          var cache = JSON.parse(localStorage.getItem('EzyfastConfig') || '{}');
          this.dbId = cache.PLUGIN_DB_pos || null;
        } catch (e) {
          this.dbId = null;
        }
        if (this.dbId) {
          this.dbReady = true;
          // Reconcile ringan ke backend (paritas dgn pola calendar yang selalu
          // verifikasi dbId saat boot): non-blocking, perbaiki cache lokal bila
          // dbId di server berubah (mis. user mengulang Setup Database) dan
          // laporkan pageId agar sheet Plugins_Active tetap sinkron.
          // Sengaja ditunda ±1 dtk agar tidak ikut membanjiri 6+ request paralel
          // saat GAS cold start (bootstrap + menu + verify + notifications) —
          // request transien yang menyusul VANILLA biasanya lolos saat proses
          // GAS sudah hangat.
          try {
            var self = this;
            var dbId = this.dbId;
            var pid = this.pageId;
            setTimeout(function () {
              try {
                if (pid) {
                  self.api('set_plugin_meta', { pluginId: 'pos', pageId: pid }).catch(function () { });
                }
                self.api('get_plugin_meta', { pluginId: 'pos' }).then(function (res) {
                  if (res && res.status === 'success' && res.dbId && String(res.dbId) !== String(dbId)) {
                    self.dbId = res.dbId;
                    try {
                      var cfg = JSON.parse(localStorage.getItem('EzyfastConfig') || '{}');
                      cfg.PLUGIN_DB_pos = res.dbId;
                      localStorage.setItem('EzyfastConfig', JSON.stringify(cfg));
                    } catch (e) { }
                  }
                }).catch(function () { });
              } catch (e2) { }
            }, 1000);
          } catch (e) { }
          return;
        }
        // Fallback: localStorage hilang (mis. localStorage.clear()) → tanya
        // backend via get_plugin_meta (ScriptProperties cache), lalu laporkan
        // pageId (dari pathname) lewat set_plugin_meta agar tersimpan di property.
        try {
          if (this.pageId) {
            await this.api('set_plugin_meta', { pluginId: 'pos', pageId: this.pageId });
          }
          var res = await this.api('get_plugin_meta', { pluginId: 'pos' });
          if (res && res.status === 'success' && res.dbId) {
            this.dbId = res.dbId;
            this.dbReady = true;
            try {
              var cfg = JSON.parse(localStorage.getItem('EzyfastConfig') || '{}');
              cfg.PLUGIN_DB_pos = res.dbId;
              localStorage.setItem('EzyfastConfig', JSON.stringify(cfg));
            } catch (e2) { }
          } else {
            this.dbReady = false;
            this.toast('Database plugin belum terpasang — buka Plugin Manager', 'error');
          }
        } catch (err) {
          this.dbReady = false;
          this.toast('Gagal memulihkan koneksi database POS', 'error');
        }
      },

      /* ===== Catalog: Load ===== */
      async loadCatalog() {
        if (!this.dbId) { this.catalogLoading = false; return; }
        this.catalogLoading = true;
        this.catalogPage = 1;
        showPosLoader(this.activeTab === 'Sale' ? 'Memuat data Sale...' : 'Memuat katalog...');
        try {
          var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Catalog' });
          this.catalogLoading = false;
          if (res && res.status === 'success') {
            this.catalogProducts = this.uniqById(res.records);
            this.catalogLoaded = true;
          }
        } finally {
          hidePosLoader();
        }
        var self = this;
        setTimeout(function () { self.paintSortArrows(); }, 50);
      },

      /* ===== Cart: Add / Qty ===== */
      addToCart(product) {
        if (product.stock != null && product.stock <= 0) {
          this.toast('Stok habis', 'error');
          return;
        }
        var existing = this.cart.find(function (i) { return i.id === product.id; });
        if (existing) {
          if (product.stock != null && existing.qty >= product.stock) {
            this.toast('Stok tidak cukup', 'error');
            return;
          }
          existing.qty++;
          existing.subtotal = existing.qty * existing.price;
        } else {
          this.cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            qty: 1,
            subtotal: Number(product.price) || 0
          });
        }
      },
      cartQty(idx, delta) {
        var item = this.cart[idx];
        if (!item) return;
        item.qty += delta;
        if (item.qty <= 0) {
          this.cart.splice(idx, 1);
        } else {
          item.subtotal = item.qty * item.price;
        }
      },

      /* ===== Payment (idempoten: 1 niat bayar = 1 ID) ===== */
      genTxId() {
        return 'TXN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      },
      openPayModal() {
        if (this.cart.length === 0) return;
        this.payMethod = 'cash';
        this.payAmount = 0;
        this.pendingTxId = this.genTxId();
        this.payModalOpen = true;
      },
      async processPayment() {
        // Guard 1: cegah klik ganda / eksekusi bersamaan
        if (this.submitting) return;
        if (this.payMethod === 'cash' && this.payAmount < this.cartTotal) return;
        if (this.cart.length === 0) return;
        // Guard 2: ID sudah tersimpan (mis. retry setelah timeout) → jangan buat lagi
        if (this.pendingTxId) {
          var alreadySaved = this.transactions.filter(function (t) { return t && t.id === this.pendingTxId; }, this)[0];
          if (alreadySaved) {
            this.openReceipt(alreadySaved);
            this.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
            return;
          }
        }
        if (!this.pendingTxId) this.pendingTxId = this.genTxId();
        this.submitting = true;
        var txData = {
          id: this.pendingTxId,
          cashier_id: this.resolveCashierId(),
          items_json: JSON.stringify(this.cart.map(function (i) {
            return { id: i.id, name: i.name, price: i.price, qty: i.qty, subtotal: i.subtotal };
          })),
          subtotal: this.cartSubtotal,
          tax: this.cartTax,
          discount: this.cartDiscount,
          total: this.cartTotal,
          payment_method: this.payMethod,
          amount_paid: this.payMethod === 'cash' ? this.payAmount : this.cartTotal,
          change_amount: this.payMethod === 'cash' ? this.payChange : 0,
          status: 'completed',
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        var res = null;
        try {
          res = await this.api('pos.create', {
            dbId: this.dbId,
            sheetName: 'Transactions',
            data: JSON.stringify(txData)
          });
        } finally {
          this.submitting = false;
        }
        if (res && res.status === 'success') {
          if (res.record && res.record.duplicate) {
            this.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
          } else {
            this.finishPaymentSuccess();
          }
          this.openReceipt(Object.assign({}, txData));
          await this.loadTransactions();
          return;
        }
        // Gagal/timeout: request mungkin sudah masuk di server.
        // Verifikasi dulu sebelum mengizinkan retry (retry pakai ID yang sama).
        await this.loadTransactions();
        var exists = this.transactions.some(function (t) { return t && t.id === this.pendingTxId; }, this);
        if (exists) {
          this.openReceipt(Object.assign({}, txData));
          this.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
        } else {
          this.toast('Gagal menyimpan transaksi — silakan coba lagi', 'error');
        }
      },
      finishPaymentSuccess(msg, type) {
        this.toast(msg || 'Transaksi berhasil!', type || 'success');
        this.cart = [];
        this.cartDiscount = 0;
        this.pendingTxId = null;
        this.payModalOpen = false;
      },

      /* ===== Struk / Cetak / Export ===== */
      openReceipt(tx) {
        if (!tx) return;
        this.receiptTx = tx;
        this.receiptModalOpen = true;
      },
      printReceipt() {
        if (!this.receiptTx) return;
        try { window.print(); } catch (e) { }
      },
      exportTransactionsCSV() {
        var rows = this.txFiltered;
        if (!rows || rows.length === 0) {
          this.toast('Tidak ada data transaksi untuk diekspor', 'error');
          return;
        }
        function esc(v) {
          var s = (v === null || v === undefined) ? '' : String(v);
          return '"' + s.replace(/"/g, '""') + '"';
        }
        var lines = [['ID', 'Kasir', 'Jumlah Item', 'Subtotal', 'PPN', 'Diskon', 'Total',
          'Metode', 'Dibayar', 'Kembalian', 'Status', 'Tanggal'].map(esc).join(';')];
        rows.forEach(function (t) {
          var itemCount = 0;
          try {
            var items = JSON.parse(t.items_json || '[]');
            itemCount = Array.isArray(items) ? items.length : 0;
          } catch (e) { }
          lines.push([t.id, t.cashier_id, itemCount, t.subtotal, t.tax, t.discount, t.total,
          t.payment_method, t.amount_paid, t.change_amount, t.status, t.created_at].map(esc).join(';'));
        });
        var now = new Date();
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        var fname = 'transaksi-pos-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
          '-' + pad(now.getHours()) + pad(now.getMinutes()) + '.csv';
        try {
          var blob = new Blob(["\ufeff" + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
          var url = window.URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toast('Berhasil mengekspor ' + rows.length + ' transaksi', 'success');
        } catch (e) {
          this.toast('Gagal mengekspor CSV', 'error');
        }
      },

      /* ===== Transactions: Load / Delete ===== */
      async loadTransactions() {
        if (!this.dbId) { this.txLoading = false; return; }
        this.closeTxMenus();
        this.txLoading = true;
        showPosLoader('Memuat transaksi...');
        try {
          var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Transactions' });
          this.txLoading = false;
          if (res && res.status === 'success') {
            this.transactions = this.uniqById(res.records);
            this.txLoaded = true;
            if (this.txPage > this.txTotalPages) this.txPage = this.txTotalPages;
          }
        } finally {
          hidePosLoader();
        }
        var self = this;
        setTimeout(function () { self.paintSortArrows(); }, 50);
      },
      async deleteTransaction(id) {
        if (!confirm('Hapus transaksi ini?')) return;
        var res = await this.api('pos.delete', { dbId: this.dbId, sheetName: 'Transactions', recordId: id });
        if (res && res.status === 'success') {
          this.toast('Transaksi dihapus', 'success');
          await this.loadTransactions();
        }
      },

      /* ===== Catalog: CRUD ===== */
      openAddProduct() {
        this.productForm = { name: '', description: '', price: 0, stock: 0, category: '', image_url: '', status: 'active' };
        this.editingProductId = null;
        this.productUploading = false;
        this.productUploadErr = '';
        this.productModalOpen = true;
      },
      openEditProduct(p) {
        this.productForm = {
          name: p.name || '',
          description: p.description || '',
          price: Number(p.price) || 0,
          stock: Number(p.stock) || 0,
          category: p.category || '',
          image_url: p.image_url || '',
          status: p.status || 'active'
        };
        this.editingProductId = p.id;
        this.productUploading = false;
        this.productUploadErr = '';
        this.productModalOpen = true;
      },
      async saveProduct() {
        if (!this.productForm.name) {
          this.toast('Nama produk wajib diisi', 'error');
          return;
        }
        this.submitting = true;
        var payload = {
          name: this.productForm.name,
          description: this.productForm.description,
          price: Number(this.productForm.price) || 0,
          stock: Number(this.productForm.stock) || 0,
          category: this.productForm.category,
          image_url: this.productForm.image_url,
          status: this.productForm.status || 'active'
        };
        var res;
        if (this.editingProductId) {
          res = await this.api('pos.update', {
            dbId: this.dbId,
            sheetName: 'Catalog',
            recordId: this.editingProductId,
            data: JSON.stringify(payload)
          });
        } else {
          payload.id = 'PROD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
          payload.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
          res = await this.api('pos.create', {
            dbId: this.dbId,
            sheetName: 'Catalog',
            data: JSON.stringify(payload)
          });
        }
        this.submitting = false;
        if (res && res.status === 'success') {
          this.toast(this.editingProductId ? 'Produk diperbarui' : 'Produk ditambahkan', 'success');
          this.productModalOpen = false;
          await this.loadCatalog();
        } else {
          this.toast('Gagal menyimpan produk', 'error');
        }
      },
      async deleteProduct(id) {
        if (!confirm('Hapus produk ini?')) return;
        var res = await this.api('pos.delete', { dbId: this.dbId, sheetName: 'Catalog', recordId: id });
        if (res && res.status === 'success') {
          this.toast('Produk dihapus', 'success');
          await this.loadCatalog();
        }
      },

      /* ===== Catalog: Upload Image ===== */
      uploadProductImage: function (event) {
        var self = this;
        var file = event.target.files && event.target.files[0];
        if (!file) { return; }

        var allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.indexOf(file.type) === -1) {
          self.productUploadErr = 'Hanya JPEG, PNG, atau WebP.';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          self.productUploadErr = 'Ukuran maks. 5 MB.';
          return;
        }

        self.productUploading = true;
        self.productUploadErr = '';

        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            var SIZE = 400;
            var canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            var ctx = canvas.getContext('2d');

            var sw = img.width, sh = img.height;
            var sx = 0, sy = 0;
            if (sw > sh) { sx = Math.floor((sw - sh) / 2); sw = sh; }
            else { sy = Math.floor((sh - sw) / 2); sh = sw; }
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

            var base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

            self._postProductUpload({
              action: 'plugin.image.upload',
              token: self._getToken(),
              blogId: self.blogId,
              fileName: 'product.jpg',
              mimeType: 'image/jpeg',
              base64: base64
            }, function (res) {
              self.productUploading = false;
              if (!res || res.status === 'error') {
                self.productUploadErr = (res && res.error) || 'Gagal upload gambar.';
                return;
              }
              self.productForm.image_url = res.url;
              event.target.value = '';
            });
          };
          img.onerror = function () {
            self.productUploading = false;
            self.productUploadErr = 'Gagal membaca gambar.';
          };
          img.src = e.target.result;
        };
        reader.onerror = function () {
          self.productUploading = false;
          self.productUploadErr = 'Gagal membaca file.';
        };
        reader.readAsDataURL(file);
      },

      _postProductUpload: function (params, callback) {
        var cfg = resolveConfig();
        var endpoint = cfg && cfg.gasApiEndpoint ? cfg.gasApiEndpoint : '';
        if (!endpoint) {
          callback({ status: 'error', error: 'Endpoint GAS belum dikonfigurasi.' });
          return;
        }
        var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var timer = setTimeout(function () { if (controller) controller.abort(); }, 30000);
        var fetchOpts = {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(params)
        };
        if (controller) fetchOpts.signal = controller.signal;
        fetch(endpoint, fetchOpts).then(function (r) {
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (data) {
          callback(data);
        }).catch(function (err) {
          clearTimeout(timer);
          callback({ status: 'error', error: 'Gagal upload: ' + (err.message || err) });
        });
      },

      _getToken: function () {
        try { return localStorage.getItem('ezy_auth_token') || ''; } catch (e) { return ''; }
      },

      /* ===== Kasir dari user login (sinkron Alpine.store('admin')) ===== */
      loginUser() {
        try {
          if (window.Alpine && window.Alpine.store) {
            var s = window.Alpine.store('admin');
            if (s && s.user) return s.user;
          }
        } catch (e) { }
        try {
          var raw = localStorage.getItem('ezy_auth_user');
          if (raw) return JSON.parse(raw);
        } catch (e) { }
        return null;
      },
      loginCashierName() {
        var u = this.loginUser();
        if (!u) return '';
        return u.name || u.email || u.id || '';
      },
      // Prioritas: shift aktif → user login → input manual → 'default'
      resolveCashierId() {
        if (this.currentShift && this.currentShift.cashier_id) return this.currentShift.cashier_id;
        var n = this.loginCashierName();
        if (n) return n;
        if (this.shiftForm.cashier_id) return this.shiftForm.cashier_id;
        return 'default';
      },
      openShiftModal(mode) {
        this.shiftMode = mode;
        if (mode === 'open' && !this.shiftForm.cashier_id) {
          var n = this.loginCashierName();
          if (n) this.shiftForm.cashier_id = n;
        }
        this.shiftModalOpen = true;
      },

      /* ===== Transaction Detail ===== */
      viewTxDetail(tx) {
        this.txDetail = tx;
        this.txDetailModalOpen = true;
      },

      /* ===== Shifts: Load / Open / Close ===== */
      async loadShifts() {
        if (!this.dbId) { this.shiftsLoading = false; return; }
        this.shiftsLoading = true;
        showPosLoader('Memuat shift...');
        try {
          var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Shifts' });
          this.shiftsLoading = false;
          if (res && res.status === 'success') {
            this.shifts = this.uniqById(res.records);
            this.shiftsLoaded = true;
            var open = this.shifts.find(function (s) { return s.status === 'open'; });
            this.currentShift = open || null;
          }
        } finally {
          hidePosLoader();
        }
        var self = this;
        setTimeout(function () { self.paintSortArrows(); }, 50);
      },
      async openShift() {
        if (!this.shiftForm.cashier_id) {
          this.toast('Masukkan ID kasir', 'error');
          return;
        }
        this.submitting = true;
        var shiftData = {
          id: 'SHIFT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
          cashier_id: this.shiftForm.cashier_id,
          opening_cash: this.shiftForm.opening_cash || 0,
          status: 'open',
          started_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        var res = await this.api('pos.create', {
          dbId: this.dbId,
          sheetName: 'Shifts',
          data: JSON.stringify(shiftData)
        });
        this.submitting = false;
        if (res && res.status === 'success') {
          this.toast('Shift berhasil dibuka!', 'success');
          this.shiftModalOpen = false;
          this.shiftForm = { opening_cash: 0, cashier_id: '' };
          await this.loadShifts();
        } else {
          this.toast('Gagal membuka shift', 'error');
        }
      },
      async doCloseShift() {
        if (!this.currentShift) return;
        this.submitting = true;
        var expected = Number(this.currentShift.opening_cash || 0);
        var closing = Number(this.closeShiftForm.closing_cash || 0);
        var res = await this.api('pos.update', {
          dbId: this.dbId,
          sheetName: 'Shifts',
          recordId: this.currentShift.id,
          data: JSON.stringify({
            closing_cash: closing,
            expected_cash: expected,
            difference: closing - expected,
            ended_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            status: 'closed'
          })
        });
        this.submitting = false;
        if (res && res.status === 'success') {
          this.toast('Shift berhasil ditutup!', 'success');
          this.shiftModalOpen = false;
          await this.loadShifts();
        } else {
          this.toast('Gagal menutup shift', 'error');
        }
      }
    }));
  }

  // Registrasi normal: pos.js tiba SEBELUM Alpine.start() (kasus inline dulu).
  function onAlpineInit() {
    window.__posSawAlpineInit = true;
    registerPosAlpine();
  }
  if (document.addEventListener) {
    document.addEventListener('alpine:init', onAlpineInit);
  }

  // Bila pos.js tiba SETELAH Alpine.start() (umum untuk script async CDN),
  // Alpine sudah meng-init #pos-page dan GAGAL (posPlugin belum terdaftar).
  // PALING PENTING (terbukti di Error.txt): Alpine yang gagal meng-eval
  // x-data tetap MEMBUAT data stack kosong `{}` lalu meneruskan walk ke
  // anak — seluruh binding di dalam #pos-page me-render error "X is not
  // defined" selamanya. Karena itu "ceklis ada dataStack" TIDAK bisa
  // dipakai sebagai bukti hidup: tree rusak pun punya stack.
  //
  // Cek sungguhan: stack teratas harus mengekspos `activeTab` — properti
  // yang SELALU ada di data posPlugin. Status:
  //   'alive'   → ter-bind benar (posPlugin). Diam.
  //   'unbound' → Alpine belum memroses node. Tunggu (start/bind normal).
  //   'broken'  → stack kosong/fallback (x-data gagal). Paksa init ulang.
  function posTreeState(root) {
    try {
      var s = root && root._x_dataStack;
      if (!s || !s.length) return 'unbound';
      for (var i = 0; i < s.length; i++) {
        if (s[i] && ('activeTab' in s[i])) return 'alive';
      }
      return 'broken';
    } catch (e) { return 'broken'; }
  }
  function isPosTreeAlive() {
    try {
      if (typeof document.getElementById !== 'function') return false;
      var el = document.getElementById('pos-page');
      return !!el && posTreeState(el) === 'alive';
    } catch (e) { return false; }
  }
  // Evaluasi x-data yang gagal TETAP meninggalkan penanda _x_marker pada
  // elemen (walk Alpine lanjut ke elemen berikut sambil me-log tiap error —
  // persis pola di Error.txt). initTree berikutnya akan MELEWATKAN elemen
  // bertanda, sehingga perbaikan diam-diam tidak berjalan. Hapus penanda
  // (+ stack basi) di seluruh subtree dulu agar init ulang benar-benar
  // dieksekusi. Aman: hanya dipanggil bila root TERBUKTI broken.
  // SPA-HARDENING: selain menghapus marker, WAJIB memanggil Alpine.destroyTree
  // terlebih dahulu. Tree "broken" hasil initTree yang gagal TETAP memiliki
  // reactive effects tersendiri yang terdaftar di scheduler Alpine. Bila
  // marker dihapus lalu initTree dijalankan tanpa destroy, efek pohon lama
  // yang yatim menjadi DUPLIKAT dari pohon baru → saat store/state berubah,
  // Alpine mengeksekusi kedua set efek; set lama mereferensikan closure yang
  // sudah dibuang → badai 'Uncaught ReferenceError: p/n is not defined' di
  // cdn.min.js (ribuan, tanpa henti) setiap kali activeRoute/hash berganti.
  //
  // CATATAN (perilaku saat ini): di bawah SPA, maybeInitTree TIDAK memakai
  // resetPosTree+initTree — ia meminta clean re-inject dari cache via
  // EzyFast.rehydratePluginTree. resetPosTree hanya fallback MPA.
  // PERINGATAN: resetPosTree menghapus _x_initialized tapi TIDAK menghapus
  // clone x-for yang sudah ter-render; initTree ulang di atas DOM seperti itu
  // mere-evaluasi binding clone (mis. p.image_url) di luar scope loop → badai
  // ReferenceError p/n. Karena itu jangan gunakan jalur ini selama ada SPA.
  function resetPosTree(root) {
    try {
      if (root && window.Alpine && typeof window.Alpine.destroyTree === 'function') {
        window.Alpine.destroyTree(root);
      }
    } catch (e) { }
    try {
      var els = [root];
      if (root.querySelectorAll) {
        els = els.concat(Array.prototype.slice.call(root.querySelectorAll('*')));
      }
      els.forEach(function (el) {
        try { delete el._x_marker; } catch (e) { }
        try { delete el._x_dataStack; } catch (e) { }
        // Alpine menandai elemen yang sudah di-init via _x_initialized;
        // bila tidak dihapus, initTree ulang akan dilewati diam-diam.
        try { delete el._x_initialized; } catch (e) { }
      });
    } catch (e) { }
  }
  var __posTries = 0;
  // Kunci rehydrate: setelah request clean re-inject dikirim, polling menunggu
  // sampai #pos-page hidup sebelum mengirim request berikutnya (mencegah loop
  // rehydrate gegabah saat inject pipeline masih bekerja).
  // SPA-HARDENING: di bawah SPA, pohon yang unbound/broken TIDAK boleh
  // di-re-init in-place di atas DOM yang sudah berisi clone render (marker
  // dihapus tapi clone tersisa → init pass berikutnya mengeksekusi ulang
  // x-bind/x-text clone (p.image_url dll) di luar scope loop → badai
  // 'ReferenceError: p/n is not defined'). Solusinya minta router SPA
  // melakukan CLEAN re-inject dari cache.
  window.__posRehydrating = false;
  function requestCleanRehydrate() {
    try {
      if (window.EzyFast && typeof window.EzyFast.rehydratePluginTree === 'function') {
        window.__posRehydrating = true;
        var p = window.EzyFast.rehydratePluginTree('pos');
        // SPA bisa MENOLAK (sedang inject nav / cache kosong) → promise resolve
        // false. Kalau __posRehydrating dibiarkan true, watchdog menunggu
        // sampai isPosTreeAlive() yang tak kunjung datang → request tidak
        // pernah diulang (deadlock). Lepas flag agar polling berikutnya bisa
        // meng-request ulang setelah inject nav selesai.
        if (p && typeof p.then === 'function') {
          p.then(function (ok) { if (!ok) { window.__posRehydrating = false; } },
                 function () { window.__posRehydrating = false; });
        }
        return true;
      }
    } catch (e) {}
    return false;
  }
  function maybeInitTree() {
    // Shell dibangun oleh POS feed engine (boot permalink / route handler)
    // memakai resilientCLEAN innerHTML+initTree-nya sendiri; watchdog TIDAK
    // boleh rehydrate via CACHE halaman post (isi cache saat itu = markup tab
    // mentah, BUKAN shell) — akan merusak tree. Lihat juga __posShellOwned.
    if (window.__posShellOwned) { return; }
    if (window.__posTreeInited) return;
    // SPA-HARDENING #2: rute navigasi sedang mengganti konten #ezy-admin-content
    // (injectContent aktif). Pohon #pos-page yang 'unbound' selama window ini
    // ADALAH hal normal — SPA akan memanggil initTree sendiri setelah script
    // plugin selesai di-wait. Rehydrate/manipulasi di sini BALAP DENGAN inject
    // nav → dua siklus safeClear/initTree pada node yang sama → Alpine observer
    // crash 'Cannot convert undefined or null to object' + scope hilang
    // (formatRupiah is not defined). Reset counter & menunggu adalah benar.
    if (window.EzyFast && typeof window.EzyFast.isInjecting === 'function') {
      if (window.EzyFast.isInjecting()) {
        __posTries = 0;
        return;
      }
    }
    if (window.__posRehydrating) {
      if (isPosTreeAlive()) { window.__posRehydrating = false; }
      return;
    }
    // Jalur normal: Alpine meng-init tree sendiri — jangan init ganda.
    if (window.__posSawAlpineInit) return;
    // Parsing belum selesai = Alpine.start() belum jalan — jangan mendahului.
    try { if (document.readyState === 'loading') return; } catch (e) { }
    if (!window.Alpine || typeof window.Alpine.initTree !== 'function') return;
    var root = null;
    try { root = document.getElementById('pos-page'); } catch (e) { }
    if (!root) return;
    var state = posTreeState(root);
    if (state === 'alive') return;
    if (state === 'unbound') {
      // Hati-hati: belum tentu rusak. Bila alamiah, Alpine.start() akan
      // menghasilkan 'alive' atau 'broken' sendiri beberapa tick berikutnya.
      // APA BILA TIDAK PERNAH? Beri pagar: >30 tick (~3 dtk) dengan posisi
      // dokument sudah ter-parse dan Alpine ada ⇒ start sudah pasti selesai
      // namun tidak menyentuh node ini ⇒ paksa pemulihan juga (bukan
      // 'unbound' alami, melainkan x-data tidak ada dari markup/terlewat).
      if (__posTries < 30) return;
      state = 'broken';
    }
    if (requestCleanRehydrate()) {
      return;
    }
    resetPosTree(root);
    try {
      window.__posTreeInited = true;
      window.Alpine.initTree(root);
      if (posTreeState(root) !== 'alive') {
        window.__posTreeInited = false;
      }
    } catch (e) {
      window.__posTreeInited = false;
    }
  }

  // Fallback: file eksternal (defer/async CDN) bisa tiba setelah alpine:init.
  try { registerPosAlpine(); } catch (e) { }
  try { maybeInitTree(); } catch (e) { }
  // SPA-HARDENING #3: setiap kunjungan SPA ke /p/pos.html meng-evaluasi pos.js
  // ULANG (inject script baru) → tanpa guard, interval watchdog N menumpuk
  // (satu per nav). Instance lama harus bunuh diri: simpan ID instance global,
  // yang baru menaikkannya; interval lama mengecek & berhenti sendiri.
  window.__posWatchdogInst = (window.__posWatchdogInst || 0) + 1;
  var __posInstId = window.__posWatchdogInst;
  var __posTimer = setInterval(function () {
    if (window.__posWatchdogInst !== __posInstId) {
      clearInterval(__posTimer);
      return;
    }
    try { registerPosAlpine(); } catch (e) { }
    try { maybeInitTree(); } catch (e) { }
    var stopReason = '';
    if (window.__posAlpineRegistered && (window.__posSawAlpineInit || window.__posTreeInited || isPosTreeAlive())) {
      stopReason = window.__posSawAlpineInit ? 'jalur normal (alpine:init)' :
        (window.__posTreeInited ? 'perbaikan late-load selesai' : '#pos-page sudah hidup');
      window.__posRehydrating = false;
    } else if (++__posTries > 100) {
      stopReason = 'batas 100x polling tercapai (Alpine tak kunjung ada / halaman bukan POS)';
      window.__posRehydrating = false;
    }
    if (stopReason) {
      clearInterval(__posTimer);
    }
  }, 100);

  /* ===== Feed Engine — navigasi tab (hash shell) & interaksi feed =====
     - URL tab SELALU /p/pos.html#<Tab> (permintaan user); konten tab tetap
       di-fetch dari feed post. TIDAK ada navigasi ke permalink post.
     - Klik tautan tab (permalink antar-tab atau /p/pos.html#X) dicegat →
       goPosTab (pushState hash + feed render, tanpa reload).
     - Route 'pos-tab' (matcher + handler) DIDAFTARKAN OLEH PLUGIN ini
       (registerRoute + registerRouteHandler) — template hanya menyediakan
       mekanisme generik registerRoute/registerRouteHandler, TIDAK ada daftar
       slug POS. Cold-load full page ditembak loader generik marker-based
       (data-ezy-plugin="pos" pada post tab → template muat pos.js).
     - Direct-hit permalink: pos.js (dimuat oleh loader generik template)
       mengambil alih: bangun shell /p/pos.html lalu normalisasi URL ke
       /p/pos.html#<Tab> dan render tab dari feed.
     Semua idempoten terhadap re-exec pos.js oleh inject SPA. */
  function posShellActive() { return !!document.getElementById('pos-page'); }
  function resolvePosTarget(hrefAttr, hrefAbs) {
    if (!posShellActive()) { return null; }
    var path = '';
    var hash = String(hrefAbs || hrefAttr || '').split('#')[1] || '';
    try {
      var u = new URL(hrefAbs || hrefAttr, window.location.href);
      path = u.pathname;
    } catch (e) { return null; }
    var slug = posTabSlugForPath(path);
    if (slug) { return { slug: slug }; }
    if (path.replace(/\/$/, '') === '/p/pos.html') {
      var want = String(hash || '').toLowerCase();
      for (var idName in POS_TAB_ID_TO_SLUG) {
        if (Object.prototype.hasOwnProperty.call(POS_TAB_ID_TO_SLUG, idName) &&
          idName.toLowerCase() === want) {
          return { slug: POS_TAB_ID_TO_SLUG[idName] };
        }
      }
    }
    return null;
  }
  function posFeedClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) { return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
    if (e.button !== 0) { return; }
    if (a.target === '_blank') { return; }
    var hrefAttr = a.getAttribute('href');
    if (!hrefAttr) { return; }
    var target = resolvePosTarget(hrefAttr, a.href);
    if (!target) { return; }
    // Shell aktif → cegat pindah tab lewat hash shell, apa pun URL saat ini
    // (permalink deep-link atau /p/pos.html). Jangan biarkan router SPA
    // menavigasi ke permalink post.
    e.preventDefault();
    goPosTab(target.slug);
  }
  function goPosTab(slug) {
    if (!POS_TAB_SLUG_TO_ID[slug]) { return; }
    var inst = getPosInst();
    if (!inst || typeof inst.resolveFeedMode !== 'function') { return; }
    // Navigasi tab = hash shell (bukan permalink post). Meta feed hanya
    // dipakai resolveFeedMode saat mengambil konten, bukan untuk URL.
    adoptPosUrl(slug);
    inst.posFeedSlug = slug;
    if (POS_TAB_SLUG_TO_ID[slug]) { inst.activeTab = POS_TAB_SLUG_TO_ID[slug]; }
    if (typeof inst.closeTxMenus === 'function') { inst.closeTxMenus(); }
    inst.resolveFeedMode();
  }
  function bootPosTabPage(slug) {
    if (window.__posShellBuilding) { return; }
    window.__posShellBuilding = true;
    window.__posBootSlug = slug || window.__posBootSlug || '';
    fetchPosShellMarkup().then(function (shellHtml) {
      var target = document.getElementById('ezy-admin-content');
      if (!target) { window.__posShellBuilding = false; return; }
      try {
        if (window.Alpine && typeof window.Alpine.destroyTree === 'function') {
          window.Alpine.destroyTree(target);
        }
      } catch (e) { }
      target.innerHTML = shellHtml;
      try { registerPosAlpine(); } catch (e) { }
      var initDone = function () {
        try {
          if (window.Alpine && typeof window.Alpine.initTree === 'function') {
            window.Alpine.initTree(target);
          }
        } catch (e) { }
        window.__posShellOwned = true;
        window.__posShellBuilding = false;
        try {
          var st = window.Alpine && window.Alpine.store('admin');
          if (st) {
            if (typeof st.syncSidebarFromRoute === 'function') { st.syncSidebarFromRoute(); }
            if (typeof st.updateBreadcrumb === 'function') { st.updateBreadcrumb(); }
          }
        } catch (e) { }
      };
      if (window.Alpine && typeof window.Alpine.initTree === 'function') {
        initDone();
      } else {
        var _iv = 0;
        var _timer = setInterval(function () {
          if (window.Alpine && typeof window.Alpine.initTree === 'function') {
            clearInterval(_timer);
            initDone();
          } else if (++_iv > 50) {
            clearInterval(_timer);
            window.__posShellBuilding = false;
          }
        }, 100);
      }
    }).catch(function () {
      window.__posShellBuilding = false;
    });
  }
  // One-Core: matcher 'pos-tab' adalah milik plugin (bukan template). Route
  // ini membuat pageKindFor()/render() router mengenali /yyyy/mm/<slug>.html
  // sebagai milik POS saat pos.js sudah termuat. Idempoten: diregistrasi satu
  // kali per dokumen (duplicate push tidak berbahaya karena pageKindFor
  // mengambil kecocokan pertama, tapi dijaga agar registry bersih).
  function registerPosRoute() {
    try {
      if (!window.EzyFast || typeof window.EzyFast.registerRoute !== 'function') { return; }
      if (window.__posRouteRegistered) { return; }
      window.__posRouteRegistered = true;
      window.EzyFast.registerRoute({
        kind: 'pos-tab',
        match: function (path) { return posTabSlugForPath(path) ? true : false; }
      });
    } catch (e) {}
  }
  function registerPosRouteHandler() {
    try {
      if (!window.EzyFast || typeof window.EzyFast.registerRouteHandler !== 'function') { return; }
      window.EzyFast.registerRouteHandler('pos-tab', function (path) {
        try {
          var st = window.Alpine && window.Alpine.store('admin');
          if (st && typeof st.guard === 'function') { st.guard(); }
        } catch (e) { }
        var slug = posTabSlugForPath(path);
        if (posShellActive()) {
          var inst = getPosInst();
          if (inst && typeof inst.resolveFeedMode === 'function') {
            if (slug) {
              if (slug !== inst.posFeedSlug) {
                inst.posFeedSlug = slug;
                if (POS_TAB_SLUG_TO_ID[slug]) { inst.activeTab = POS_TAB_SLUG_TO_ID[slug]; }
                adoptPosUrl(slug);
                inst.resolveFeedMode();
              } else {
                // Slug sama tapi URL masih permalink (mis. klik ulang tab yang
                // sama) → cukup kanonikalisasi URL, tanpa render ulang.
                adoptPosUrl(slug);
              }
            }
            try {
              var st2 = window.Alpine && window.Alpine.store('admin');
              if (st2) {
                if (typeof st2.syncSidebarFromRoute === 'function') { st2.syncSidebarFromRoute(); }
                if (typeof st2.updateBreadcrumb === 'function') { st2.updateBreadcrumb(); }
              }
            } catch (e) { }
            return;
          }
        }
        // Shell belum ada (popstate/SOA ke permalink dari halaman non-POS):
        // bangun shell pos.html lalu render tab dari feed.
        bootPosTabPage(slug);
      });
    } catch (e) { }
  }
  if (!window.__posFeedEngineInstalled) {
    window.__posFeedEngineInstalled = true;
    if (document.addEventListener) { document.addEventListener('click', posFeedClick, true); }
  }
  registerPosRoute();
  registerPosRouteHandler();
  // Takeover direct-hit: pos.js tiba di permalink tab & shell belum ada.
  // (saat full-load permalink, loader generik marker-based template memuat
  // pos.js ini lewat data-ezy-plugin="pos"; saat SPA-inject, script inline
  // pos.js di-exec oleh reExecuteDynamicContent)
  try {
    var __bootSlugNow = posTabSlugForPath(window.location.pathname);
    if (__bootSlugNow && !posShellActive() && window.__posShellBuilding !== true) {
      window.__posBootSlug = __bootSlugNow;
      bootPosTabPage(__bootSlugNow);
    }
  } catch (e) { }

  /* ===== AUTO-REGISTRATION (plugin.link_page — kirim pageId tiap halaman ditampilkan) ===== */
  // Guard: satu request link_page aktif saja. runPosAutoReg dipanggil berulang
  // (immediate + load + 2× timeout); tanpa guard, beberapa request POST yang
  // tumpang-tindih bisa menulis pageId dari halaman lain.
  var __posAutoRegPending = false;
  function runPosAutoReg() {
    // pos.js dimuat template-wide: hanya daftarkan halaman yang benar-benar
    // memuat UI POS, agar pageId halaman lain tidak tertaut ke plugin pos.
    try {
      if (typeof document.getElementById !== 'function') return;
      if (!document.getElementById('pos-page')) return;
    } catch (e) { return; }
    (function () {
      'use strict';
      var PLUGIN_ID = 'pos';
      var cfg = resolveConfig();
      if (!cfg || !cfg.pageId || !cfg.blogId) { return; }

      var apiBase = cfg.gasApiEndpoint;
      if (!apiBase || apiBase.indexOf('YOUR_WEB_APP_ID') !== -1) { return; }

      // Bila ada request link_page yang masih berjalan, tunggu yang selesai
      // (retry berikutnya via window.load / timeout tetap akan jalan).
      if (__posAutoRegPending) { return; }

      // Dikirim SETIAP kali halaman plugin ditampilkan (bukan hanya sekali),
      // agar kolom pageId di sheet Plugins_Active selalu sinkron/terisi.

      // fetch/POST CORS-safe (pola apiFetch): action + params di body JSON,
      // TANPA callback/script-injection. Guard pending dibebaskan di mana pun
      // chain berakhir (sukses/gagal) agar request berikutnya bisa jalan.
      var storageKey = 'ezy_plugin_linked_' + PLUGIN_ID;
      // Canonical pageId (rencana Fase 3, §7 REFACTOR_PLAN): saat pos.js
      // berjalan di permalink tab (/yyyy/mm/<slug>.html) setelah takeover
      // shell, plugin harus tetap tertaut ke SHELL POS, bukan ke post tab —
      // kalau tidak, Plugins_Active & recovery dbId terpecah ke 4 halaman.
      var pageIdCanon = String(cfg.pageId || '');
      if (posTabSlugForPath(window.location.pathname)) { pageIdCanon = POS_SHELL_PATH; }
      var payload = {
        action: 'plugin.link_page',
        pluginId: PLUGIN_ID,
        blogId: cfg.blogId,
        pageId: pageIdCanon
      };
      try {
        var token = localStorage.getItem('ezy_auth_token');
        if (token) { payload.token = token; }
      } catch (e) { }

      __posAutoRegPending = true;
      var clean = function () { __posAutoRegPending = false; };

      fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (res) { return res.json(); }).then(function (res) {
        if (res && res.status === 'success') {
          localStorage.setItem(storageKey, String(cfg.pageId));
          window.dispatchEvent(new CustomEvent('ezy:plugin:linked', {
            detail: { pluginId: PLUGIN_ID, pageId: cfg.pageId }
          }));
        }
      }).catch(function () {
        // Gagal dimuat (network/offline/preflight) → lepas pending agar retry
        // berikutnya (window load / timeout) bisa berjalan.
      }).then(clean);
  })();

  }
  try { runPosAutoReg(); } catch (e) { }
  // EzyFast bridge template bisa load belakangan — coba lagi saat window load.
  if (window.addEventListener) {
    window.addEventListener('load', function () {
      try { runPosAutoReg(); } catch (e) { }
      setTimeout(function () { try { runPosAutoReg(); } catch (e) { } }, 1500);
      setTimeout(function () { try { runPosAutoReg(); } catch (e) { } }, 4000);
    });
  }
})();
