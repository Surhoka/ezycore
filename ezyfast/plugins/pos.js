/* EzyFast POS — pos.js (di-load dari Github via jsDelivr, defer).
 * Split dari p/plugins/POS/pos.html: definisi Alpine.data + auto-registration.
 * Tahan late-load: bila Alpine sudah start sebelum file ini tiba,
 * registrasi tetap dijalankan via polling fallback + subtree #pos-page
 * di-init ulang manual (Alpine.initTree) agar x-data tidak gagal.
 */
(function () {
  'use strict';

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
        } catch (e) {}
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
    loading: false,
    submitting: false,
    dbReady: false,
    dbId: null,
    toastMsg: '',
    toastType: 'success',

    /* ===== Catalog ===== */
    catalogProducts: [],
    catalogQuery: '',
    catalogSort: { key: 'name', asc: true },

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
      var q = (this.catalogQuery || '').toLowerCase();
      var self = this;
      var list = this.catalogProducts.filter(function (p) {
        if (!p || p.status === 'inactive') return false;
        var hay = String((p.name || '') + ' ' + (p.category || '')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      var key = self.catalogSort.key;
      var asc = self.catalogSort.asc;
      return list.slice().sort(function (a, b) {
        var va, vb;
        if (key === 'price' || key === 'stock') {
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

    /* ===== Computed: Transactions ===== */
    get txFiltered() {
      var q = (this.txQuery || '').toLowerCase();
      return this.transactions.filter(function (t) {
        if (!t) return false;
        var hay = String((t.id || '') + ' ' + (t.cashier_id || '') + ' ' + (t.payment_method || '') + ' ' + (t.status || '')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    },
    get txSorted() {
      var key = this.txSort.key;
      var asc = this.txSort.asc;
      return this.txFiltered.slice().sort(function (a, b) {
        var va = String(a[key] || '').toLowerCase();
        var vb = String(b[key] || '').toLowerCase();
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
        return 0;
      });
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
    get txPageNumbers() {
      var arr = [];
      for (var n = 1; n <= this.txTotalPages; n++) arr.push(n);
      return arr;
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
      try { hasShell = !!document.querySelector('.ezy-toast'); } catch (e) {}
      if (hasShell) {
        try {
          if (window.EzyFast && typeof window.EzyFast.toast === 'function') {
            window.EzyFast.toast(msg, t);
          } else {
            window.dispatchEvent(new CustomEvent('ezy:toast', { detail: { message: msg, type: t } }));
          }
        } catch (e) {}
        return;
      }
      // Fallback lokal bila shell template tidak ada (preview standalone).
      var self = this;
      self.toastMsg = msg;
      self.toastType = t;
      setTimeout(function () { self.toastMsg = ''; }, 3000);
    },

    /* ===== Config & JSONP ===== */
    get apiUrl() {
      var cfg = window.EzyFast && window.EzyFast.getConfig ? window.EzyFast.getConfig() : null;
      return (cfg && cfg.gasApiEndpoint) || '';
    },
    get blogId() {
      var cfg = window.EzyFast && window.EzyFast.getConfig ? window.EzyFast.getConfig() : null;
      return (cfg && cfg.blogId) || '';
    },
    get pageId() {
      var cfg = window.EzyFast && window.EzyFast.getConfig ? window.EzyFast.getConfig() : null;
      return (cfg && cfg.pageId) || '';
    },

    fetchJsonp(url, params) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var cbName = '_ezyPosCb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        var timeout = setTimeout(function () {
          delete window[cbName];
          reject(new Error('JSONP timeout'));
        }, 20000);
        window[cbName] = function (raw) {
          clearTimeout(timeout);
          delete window[cbName];
          try { resolve(typeof raw === 'string' ? JSON.parse(raw) : raw); }
          catch (e) { reject(e); }
        };
        var allParams = Object.assign({ callback: cbName, blogId: self.blogId }, params);
        var qs = Object.keys(allParams).map(function (k) { return k + '=' + encodeURIComponent(allParams[k]); }).join('&');
        var script = document.createElement('script');
        script.src = url + '?' + qs;
        script.onerror = function () {
          clearTimeout(timeout);
          delete window[cbName];
          reject(new Error('Script load error'));
        };
        document.head.appendChild(script);
      });
    },

    async api(action, params) {
      if (!this.apiUrl) {
        this.toast('GAS endpoint belum dikonfigurasi', 'error');
        return null;
      }
      try {
        return await this.fetchJsonp(this.apiUrl, Object.assign({ action: action }, params || {}));
      } catch (e) {
        console.error('[POS] API error:', e);
        return null;
      }
    },

    /* ===== Init ===== */
    async init() {
      this.syncTabFromHash();
      window.addEventListener('hashchange', () => this.syncTabFromHash());
      // Menu aksi fixed tidak mengikuti scroll — tutup saat ada scroll
      // di kontainer mana pun (capture: scroll tidak bubble) & saat resize.
      window.addEventListener('scroll', () => { this.closeTxMenus(); }, true);
      window.addEventListener('resize', () => { this.closeTxMenus(); });
      this.checkDbReady();
      if (this.dbReady) {
        await this.loadCatalog();
        await this.loadTransactions();
        await this.loadShifts();
      }
      // Prefill kasir dari user login agar tidak jatuh ke 'default'
      if (!this.shiftForm.cashier_id) {
        var loginName = this.loginCashierName();
        if (loginName) this.shiftForm.cashier_id = loginName;
      }
      var self = this;
      setTimeout(function () { self.paintSortArrows(); }, 100);
    },

    syncTabFromHash() {
      var hash = window.location.hash.replace(/^#/, '');
      var map = { Sale: 'Sale', Catalog: 'Catalog', Transactions: 'Transactions', Shifts: 'Shifts' };
      if (map[hash]) this.activeTab = hash;
    },

    selectTab(tabId) {
      this.activeTab = tabId;
      this.closeTxMenus();
      if (window.location.hash !== '#' + tabId) {
        try { window.location.hash = tabId; } catch (e) { }
      }
      var self = this;
      setTimeout(function () { self.paintSortArrows(); }, 50);
    },

    /* ===== Sort Methods ===== */
    sortCatalog(key) {
      if (this.catalogSort.key === key) {
        this.catalogSort.asc = !this.catalogSort.asc;
      } else {
        this.catalogSort = { key: key, asc: true };
      }
      this.paintSortArrows();
    },
    txSortBy(key) {
      this.closeTxMenus();
      if (this.txSort.key === key) {
        this.txSort.asc = !this.txSort.asc;
      } else {
        this.txSort = { key: key, asc: true };
      }
      this.paintSortArrows();
    },
    // Tutup semua dropdown aksi (panel per-baris mendengarkan event ini)
    closeTxMenus() {
      try { window.dispatchEvent(new CustomEvent('pos:closemenus')); } catch (e) {}
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

    checkDbReady() {
      try {
        var cache = JSON.parse(localStorage.getItem('EzyfastConfig') || '{}');
        this.dbId = cache.PLUGIN_DB_pos || null;
        this.dbReady = !!this.dbId;
      } catch (e) {
        this.dbReady = false;
      }
    },

    /* ===== Catalog: Load ===== */
    async loadCatalog() {
      if (!this.dbId) return;
      this.loading = true;
      var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Catalog' });
      this.loading = false;
      if (res && res.status === 'success') {
        this.catalogProducts = this.uniqById(res.records);
        if ((res.records || []).length !== this.catalogProducts.length) {
          console.warn('[POS] Catalog: baris duplikat/tanpa id dibuang.');
        }
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
      try { window.print(); } catch (e) {}
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
        } catch (e) {}
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
      if (!this.dbId) return;
      this.closeTxMenus();
      this.loading = true;
      var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Transactions' });
      this.loading = false;
      if (res && res.status === 'success') {
        this.transactions = this.uniqById(res.records);
        if ((res.records || []).length !== this.transactions.length) {
          console.warn('[POS] Transactions: baris duplikat/tanpa id dibuang.');
        }
        if (this.txPage > this.txTotalPages) this.txPage = this.txTotalPages;
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
      var cfg = window.EzyFast && window.EzyFast.getConfig ? window.EzyFast.getConfig() : null;
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
      } catch (e) {}
      try {
        var raw = localStorage.getItem('ezy_auth_user');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
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
      if (!this.dbId) return;
      this.loading = true;
      var res = await this.api('pos.read', { dbId: this.dbId, sheetName: 'Shifts' });
      this.loading = false;
      if (res && res.status === 'success') {
        this.shifts = this.uniqById(res.records);
        if ((res.records || []).length !== this.shifts.length) {
          console.warn('[POS] Shifts: baris duplikat/tanpa id dibuang.');
        }
        var open = this.shifts.find(function (s) { return s.status === 'open'; });
        this.currentShift = open || null;
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
  // Alpine sudah meng-init #pos-page dan gagal (posPlugin belum terdaftar).
  // Registrasi saja tidak cukup — subtree harus di-init ulang manual.
  function posPageNeedsInit() {
    try {
      if (typeof document.getElementById !== 'function') return false;
      var el = document.getElementById('pos-page');
      if (!el) return false;
      return !(el._x_dataStack && el._x_dataStack.length);
    } catch (e) { return false; }
  }
  // Evaluasi x-data yang gagal TETAP meninggalkan penanda _x_marker pada
  // elemen (walk Alpine lanjut ke elemen berikut sambil me-log tiap error —
  // persis pola di Error.txt). initTree berikutnya akan MELEWATKAN elemen
  // bertanda, sehingga perbaikan diam-diam tidak berjalan. Hapus penanda
  // (+ stack basi) di seluruh subtree dulu agar init ulang benar-benar
  // dieksekusi. Aman: hanya dipanggil bila root belum punya data stack
  // (= tree tidak berfungsi sama sekali, tidak ada yang bisa double-bind).
  function resetPosTree(root) {
    try {
      var els = [root];
      if (root.querySelectorAll) {
        els = els.concat(Array.prototype.slice.call(root.querySelectorAll('*')));
      }
      els.forEach(function (el) {
        try { delete el._x_marker; } catch (e) {}
        try { delete el._x_dataStack; } catch (e) {}
      });
    } catch (e) {}
  }
  function maybeInitTree() {
    if (window.__posTreeInited) return;
    // Jalur normal: Alpine meng-init tree sendiri — jangan init ganda.
    if (window.__posSawAlpineInit) return;
    // Parsing belum selesai = Alpine.start() belum jalan — jangan mendahului.
    try { if (document.readyState === 'loading') return; } catch (e) {}
    if (!window.Alpine || typeof window.Alpine.initTree !== 'function') return;
    if (!posPageNeedsInit()) return;
    var root = null;
    try { root = document.getElementById('pos-page'); } catch (e) {}
    if (!root) return;
    resetPosTree(root);
    try {
      window.__posTreeInited = true;
      window.Alpine.initTree(root);
    } catch (e) { window.__posTreeInited = false; }
  }

  // Fallback: file eksternal (defer/async CDN) bisa tiba setelah alpine:init.
  try { registerPosAlpine(); } catch (e) {}
  try { maybeInitTree(); } catch (e) {}
  var __posTries = 0;
  var __posTimer = setInterval(function () {
    try { registerPosAlpine(); } catch (e) {}
    try { maybeInitTree(); } catch (e) {}
    if ((window.__posAlpineRegistered && (window.__posSawAlpineInit || window.__posTreeInited || !posPageNeedsInit())) || ++__posTries > 100) clearInterval(__posTimer);
  }, 100);

  /* ===== AUTO-REGISTRATION (plugin.link_page, sekali per pageId) ===== */
  function runPosAutoReg() {
  (function () {
    'use strict';
    var PLUGIN_ID = 'pos';
    if (!window.EzyFast || !window.EzyFast.getConfig) { return; }
    var cfg = window.EzyFast.getConfig();
    if (!cfg || !cfg.pageId || !cfg.blogId) { return; }

    var storageKey = 'ezy_plugin_linked_' + PLUGIN_ID;
    if (localStorage.getItem(storageKey) === String(cfg.pageId)) { return; }

    var apiBase = cfg.gasApiEndpoint;
    if (!apiBase || apiBase.indexOf('YOUR_WEB_APP_ID') !== -1) { return; }

    var cbName = '_ezyAutoRegCb_' + PLUGIN_ID;
    window[cbName] = function (raw) {
      try {
        var res = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (res.status === 'success') {
          localStorage.setItem(storageKey, String(cfg.pageId));
          window.dispatchEvent(new CustomEvent('ezy:plugin:linked', {
            detail: { pluginId: PLUGIN_ID, pageId: cfg.pageId }
          }));
        }
      } catch (e) { }
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
    };

    var params = [
      'action=plugin.link_page',
      'pluginId=' + encodeURIComponent(PLUGIN_ID),
      'blogId=' + encodeURIComponent(cfg.blogId),
      'pageId=' + encodeURIComponent(cfg.pageId),
      'callback=' + cbName
    ];
    var s = document.createElement('script');
    s.src = apiBase + '?' + params.join('&');
    document.head.appendChild(s);
  })();
  }
  try { runPosAutoReg(); } catch (e) {}
  // EzyFast bridge template bisa load belakangan — coba lagi saat window load.
  if (window.addEventListener) {
    window.addEventListener('load', function () {
      try { runPosAutoReg(); } catch (e) {}
      setTimeout(function () { try { runPosAutoReg(); } catch (e) {} }, 1500);
      setTimeout(function () { try { runPosAutoReg(); } catch (e) {} }, 4000);
    });
  }
})();
