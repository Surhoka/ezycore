(function () {
  'use strict';

  function registerPosAlpine() {
    if (window.__posAlpineRegistered) return;
    if (!window.Alpine || typeof window.Alpine.data !== 'function') return;
    
    var Alpine = window.Alpine;

    // Dropdown aksi per-baris ala TailAdmin
    Alpine.data('posTxDropdown', function () {
      return {
        open: false,
        toggle: function (ev, panel) {
          this.open = !this.open;
          if (!this.open) return;
          var btn = ev && ev.currentTarget ? ev.currentTarget : null;
          if (!btn || !panel) return;
          var place = function () {
            try {
              var rect = btn.getBoundingClientRect();
              panel.style.position = 'fixed';
              panel.style.left = 'auto';
              panel.style.top = (rect.bottom + window.scrollY) + 'px';
              panel.style.right = (window.innerWidth - rect.right) + 'px';
              panel.style.zIndex = '999';
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
      };
    });

    Alpine.data('posPlugin', function () {
      return {
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
        formatRupiah: function (val) {
          var n = Number(val);
          return isNaN(n) ? (val || 'Rp 0') : 'Rp ' + n.toLocaleString('id-ID');
        },
        txItemCount: function (t) {
          if (!t) return '-';
          try {
            var items = JSON.parse(t.items_json || '[]');
            return items.length + ' item';
          } catch (e) { return '-'; }
        },
        uniqById: function (list) {
          var seen = {};
          return (list || []).filter(function (r) {
            if (!r || r.id === undefined || r.id === null || String(r.id).trim() === '') return false;
            var k = String(r.id);
            if (seen[k]) return false;
            seen[k] = true;
            return true;
          });
        },
        toast: function (msg, type) {
          var t = type || 'success';
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

        fetchJsonp: function (url, params) {
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

        api: function (action, params) {
          var self = this;
          if (!self.apiUrl) {
            self.toast('GAS endpoint belum dikonfigurasi', 'error');
            return Promise.resolve(null);
          }
          return self.fetchJsonp(self.apiUrl, Object.assign({ action: action }, params || {})).catch(function (e) {
            console.error('[POS] API error:', e);
            return null;
          });
        },

        /* ===== Init ===== */
        init: function () {
          var self = this;
          self.syncTabFromHash();
          window.addEventListener('hashchange', function () { self.syncTabFromHash(); });
          window.addEventListener('scroll', function () { self.closeTxMenus(); }, true);
          window.addEventListener('resize', function () { self.closeTxMenus(); });
          self.checkDbReady();
          if (self.dbReady) {
            self.loadCatalog();
            self.loadTransactions();
            self.loadShifts();
          }
          if (!self.shiftForm.cashier_id) {
            var loginName = self.loginCashierName();
            if (loginName) self.shiftForm.cashier_id = loginName;
          }
          setTimeout(function () { self.paintSortArrows(); }, 100);
        },

        syncTabFromHash: function () {
          var hash = window.location.hash.replace(/^#/, '');
          var map = { Sale: 'Sale', Catalog: 'Catalog', Transactions: 'Transactions', Shifts: 'Shifts' };
          if (map[hash]) this.activeTab = hash;
        },

        selectTab: function (tabId) {
          this.activeTab = tabId;
          this.closeTxMenus();
          if (window.location.hash !== '#' + tabId) {
            try { window.location.hash = tabId; } catch (e) { }
          }
          var self = this;
          setTimeout(function () { self.paintSortArrows(); }, 50);
        },

        /* ===== Sort Methods ===== */
        sortCatalog: function (key) {
          if (this.catalogSort.key === key) {
            this.catalogSort.asc = !this.catalogSort.asc;
          } else {
            this.catalogSort = { key: key, asc: true };
          }
          this.paintSortArrows();
        },
        txSortBy: function (key) {
          this.closeTxMenus();
          if (this.txSort.key === key) {
            this.txSort.asc = !this.txSort.asc;
          } else {
            this.txSort = { key: key, asc: true };
          }
          this.paintSortArrows();
        },
        closeTxMenus: function () {
          try { window.dispatchEvent(new CustomEvent('pos:closemenus')); } catch (e) {}
        },
        sortShifts: function (key) {
          if (this.shiftSort.key === key) {
            this.shiftSort.asc = !this.shiftSort.asc;
          } else {
            this.shiftSort = { key: key, asc: true };
          }
          this.paintSortArrows();
        },
        paintSortArrows: function () {
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

        checkDbReady: function () {
          try {
            var cache = JSON.parse(localStorage.getItem('EzyfastConfig') || '{}');
            this.dbId = cache.PLUGIN_DB_pos || null;
            this.dbReady = !!this.dbId;
          } catch (e) {
            this.dbReady = false;
          }
        },

        /* ===== Catalog: Load ===== */
        loadCatalog: function () {
          var self = this;
          if (!self.dbId) return Promise.resolve();
          self.loading = true;
          return self.api('pos.read', { dbId: self.dbId, sheetName: 'Catalog' }).then(function (res) {
            self.loading = false;
            if (res && res.status === 'success') {
              self.catalogProducts = self.uniqById(res.records);
            }
            setTimeout(function () { self.paintSortArrows(); }, 50);
          });
        },

        /* ===== Cart: Add / Qty ===== */
        addToCart: function (product) {
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
        cartQty: function (idx, delta) {
          var item = this.cart[idx];
          if (!item) return;
          item.qty += delta;
          if (item.qty <= 0) {
            this.cart.splice(idx, 1);
          } else {
            item.subtotal = item.qty * item.price;
          }
        },

        /* ===== Payment ===== */
        genTxId: function () {
          return 'TXN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        },
        openPayModal: function () {
          if (this.cart.length === 0) return;
          this.payMethod = 'cash';
          this.payAmount = 0;
          this.pendingTxId = this.genTxId();
          this.payModalOpen = true;
        },
        processPayment: function () {
          var self = this;
          if (self.submitting) return;
          if (self.payMethod === 'cash' && self.payAmount < self.cartTotal) return;
          if (self.cart.length === 0) return;

          if (self.pendingTxId) {
            var alreadySaved = self.transactions.filter(function (t) { return t && t.id === self.pendingTxId; })[0];
            if (alreadySaved) {
              self.openReceipt(alreadySaved);
              self.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
              return;
            }
          }
          if (!self.pendingTxId) self.pendingTxId = self.genTxId();
          self.submitting = true;

          var txData = {
            id: self.pendingTxId,
            cashier_id: self.resolveCashierId(),
            items_json: JSON.stringify(self.cart.map(function (i) {
              return { id: i.id, name: i.name, price: i.price, qty: i.qty, subtotal: i.subtotal };
            })),
            subtotal: self.cartSubtotal,
            tax: self.cartTax,
            discount: self.cartDiscount,
            total: self.cartTotal,
            payment_method: self.payMethod,
            amount_paid: self.payMethod === 'cash' ? self.payAmount : self.cartTotal,
            change_amount: self.payMethod === 'cash' ? self.payChange : 0,
            status: 'completed',
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };

          self.api('pos.create', {
            dbId: self.dbId,
            sheetName: 'Transactions',
            data: JSON.stringify(txData)
          }).then(function (res) {
            self.submitting = false;
            if (res && res.status === 'success') {
              if (res.record && res.record.duplicate) {
                self.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
              } else {
                self.finishPaymentSuccess();
              }
              self.openReceipt(Object.assign({}, txData));
              self.loadTransactions();
            } else {
              self.loadTransactions().then(function () {
                var exists = self.transactions.some(function (t) { return t && t.id === self.pendingTxId; });
                if (exists) {
                  self.openReceipt(Object.assign({}, txData));
                  self.finishPaymentSuccess('Transaksi sudah tersimpan sebelumnya', 'info');
                } else {
                  self.toast('Gagal menyimpan transaksi — silakan coba lagi', 'error');
                }
              });
            }
          }).catch(function () {
            self.submitting = false;
          });
        },
        finishPaymentSuccess: function (msg, type) {
          this.toast(msg || 'Transaksi berhasil!', type || 'success');
          this.cart = [];
          this.cartDiscount = 0;
          this.pendingTxId = null;
          this.payModalOpen = false;
        },

        /* ===== Struk / Cetak / Export ===== */
        openReceipt: function (tx) {
          if (!tx) return;
          this.receiptTx = tx;
          this.receiptModalOpen = true;
        },
        printReceipt: function () {
          if (!this.receiptTx) return;
          try { window.print(); } catch (e) {}
        },
        exportTransactionsCSV: function () {
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
        loadTransactions: function () {
          var self = this;
          if (!self.dbId) return Promise.resolve();
          self.closeTxMenus();
          self.loading = true;
          return self.api('pos.read', { dbId: self.dbId, sheetName: 'Transactions' }).then(function (res) {
            self.loading = false;
            if (res && res.status === 'success') {
              self.transactions = self.uniqById(res.records);
              if (self.txPage > self.txTotalPages) self.txPage = self.txTotalPages;
            }
            setTimeout(function () { self.paintSortArrows(); }, 50);
          });
        },
        deleteTransaction: function (id) {
          var self = this;
          if (!confirm('Hapus transaksi ini?')) return;
          self.api('pos.delete', { dbId: self.dbId, sheetName: 'Transactions', recordId: id }).then(function (res) {
            if (res && res.status === 'success') {
              self.toast('Transaksi dihapus', 'success');
              self.loadTransactions();
            }
          });
        },

        /* ===== Catalog: CRUD ===== */
        openAddProduct: function () {
          this.productForm = { name: '', description: '', price: 0, stock: 0, category: '', image_url: '', status: 'active' };
          this.editingProductId = null;
          this.productUploading = false;
          this.productUploadErr = '';
          this.productModalOpen = true;
        },
        openEditProduct: function (p) {
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
        saveProduct: function () {
          var self = this;
          if (!self.productForm.name) {
            self.toast('Nama produk wajib diisi', 'error');
            return;
          }
          self.submitting = true;
          var payload = {
            name: self.productForm.name,
            description: self.productForm.description,
            price: Number(self.productForm.price) || 0,
            stock: Number(self.productForm.stock) || 0,
            category: self.productForm.category,
            image_url: self.productForm.image_url,
            status: self.productForm.status || 'active'
          };
          var req;
          if (self.editingProductId) {
            req = self.api('pos.update', {
              dbId: self.dbId,
              sheetName: 'Catalog',
              recordId: self.editingProductId,
              data: JSON.stringify(payload)
            });
          } else {
            payload.id = 'PROD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
            payload.created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
            req = self.api('pos.create', {
              dbId: self.dbId,
              sheetName: 'Catalog',
              data: JSON.stringify(payload)
            });
          }
          req.then(function (res) {
            self.submitting = false;
            if (res && res.status === 'success') {
              self.toast(self.editingProductId ? 'Produk diperbarui' : 'Produk ditambahkan', 'success');
              self.productModalOpen = false;
              self.loadCatalog();
            } else {
              self.toast('Gagal menyimpan produk', 'error');
            }
          });
        },
        deleteProduct: function (id) {
          var self = this;
          if (!confirm('Hapus produk ini?')) return;
          self.api('pos.delete', { dbId: self.dbId, sheetName: 'Catalog', recordId: id }).then(function (res) {
            if (res && res.status === 'success') {
              self.toast('Produk dihapus', 'success');
              self.loadCatalog();
            }
          });
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

        /* ===== Kasir dari user login ===== */
        loginUser: function () {
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
        loginCashierName: function () {
          var u = this.loginUser();
          if (!u) return '';
          return u.name || u.email || u.id || '';
        },
        resolveCashierId: function () {
          if (this.currentShift && this.currentShift.cashier_id) return this.currentShift.cashier_id;
          var n = this.loginCashierName();
          if (n) return n;
          if (this.shiftForm.cashier_id) return this.shiftForm.cashier_id;
          return 'default';
        },
        openShiftModal: function (mode) {
          this.shiftMode = mode;
          if (mode === 'open' && !this.shiftForm.cashier_id) {
            var n = this.loginCashierName();
            if (n) this.shiftForm.cashier_id = n;
          }
          this.shiftModalOpen = true;
        },

        /* ===== Transaction Detail ===== */
        viewTxDetail: function (tx) {
          this.txDetail = tx;
          this.txDetailModalOpen = true;
        },

        /* ===== Shifts: Load / Open / Close ===== */
        loadShifts: function () {
          var self = this;
          if (!self.dbId) return Promise.resolve();
          self.loading = true;
          return self.api('pos.read', { dbId: self.dbId, sheetName: 'Shifts' }).then(function (res) {
            self.loading = false;
            if (res && res.status === 'success') {
              self.shifts = self.uniqById(res.records);
              var open = self.shifts.find(function (s) { return s.status === 'open'; });
              self.currentShift = open || null;
            }
            setTimeout(function () { self.paintSortArrows(); }, 50);
          });
        },
        openShift: function () {
          var self = this;
          if (!self.shiftForm.cashier_id) {
            self.toast('Masukkan ID kasir', 'error');
            return;
          }
          self.submitting = true;
          var shiftData = {
            id: 'SHIFT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
            cashier_id: self.shiftForm.cashier_id,
            opening_cash: self.shiftForm.opening_cash || 0,
            status: 'open',
            started_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };
          self.api('pos.create', {
            dbId: self.dbId,
            sheetName: 'Shifts',
            data: JSON.stringify(shiftData)
          }).then(function (res) {
            self.submitting = false;
            if (res && res.status === 'success') {
              self.toast('Shift berhasil dibuka!', 'success');
              self.shiftModalOpen = false;
              self.shiftForm = { opening_cash: 0, cashier_id: '' };
              self.loadShifts();
            } else {
              self.toast('Gagal membuka shift', 'error');
            }
          });
        },
        doCloseShift: function () {
          var self = this;
          if (!self.currentShift) return;
          self.submitting = true;
          var expected = Number(self.currentShift.opening_cash || 0);
          var closing = Number(self.closeShiftForm.closing_cash || 0);
          self.api('pos.update', {
            dbId: self.dbId,
            sheetName: 'Shifts',
            recordId: self.currentShift.id,
            data: JSON.stringify({
              closing_cash: closing,
              expected_cash: expected,
              difference: closing - expected,
              ended_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
              status: 'closed'
            })
          }).then(function (res) {
            self.submitting = false;
            if (res && res.status === 'success') {
              self.toast('Shift berhasil ditutup!', 'success');
              self.shiftModalOpen = false;
              self.loadShifts();
            } else {
              self.toast('Gagal menutup shift', 'error');
            }
          });
        }
      };
    });
  }

  // Event handler saat Alpine di-init secara normal
  function onAlpineInit() {
    window.__posSawAlpineInit = true;
    registerPosAlpine();
  }
  if (document.addEventListener) {
    document.addEventListener('alpine:init', onAlpineInit);
  }

  function posPageNeedsInit() {
    try {
      if (typeof document.getElementById !== 'function') return false;
      var el = document.getElementById('pos-page');
      if (!el) return false;
      return !(el._x_dataStack && el._x_dataStack.length);
    } catch (e) { return false; }
  }

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

  // REVISI KRITIS: Re-init tree bila pos-page membutuhkan pendaftaran manual
  function maybeInitTree() {
    if (window.__posTreeInited) return;
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

  // Eksekusi Pendaftaran Langsung Jika Skrip Tiba
  try { registerPosAlpine(); } catch (e) {}
  try { maybeInitTree(); } catch (e) {}

  // Polling Fallback
  var __posTries = 0;
  var __posTimer = setInterval(function () {
    try { registerPosAlpine(); } catch (e) {}
    try { maybeInitTree(); } catch (e) {}
    if ((window.__posAlpineRegistered && window.__posTreeInited) || ++__posTries > 100) {
      clearInterval(__posTimer);
    }
  }, 100);

  /* ===== AUTO-REGISTRATION ===== */
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
  if (window.addEventListener) {
    window.addEventListener('load', function () {
      try { runPosAutoReg(); } catch (e) {}
      setTimeout(function () { try { runPosAutoReg(); } catch (e) {} }, 1500);
      setTimeout(function () { try { runPosAutoReg(); } catch (e) {} }, 4000);
    });
  }
})();
