// ================================================================
// HELPER: Promise-based sendDataToGoogle untuk EzyFast
// ================================================================
function efApi(action, data) {
  return new Promise(function (resolve, reject) {
    if (typeof window.sendDataToGoogle !== 'function') {
      reject(new Error('sendDataToGoogle is not available'));
      return;
    }
    window.sendDataToGoogle(action, data || {}, resolve, reject);
  });
}

// ================================================================
// EZYFAST DASHBOARD
// ================================================================
Alpine.data('ezyfastDashboard', () => ({
    loading: true,
    stats: {},
    recentOrders: [],

    async init() {
        await this.loadDashboard();
    },

    async loadDashboard() {
        this.loading = true;
        try {
            var res = await efApi('ef_getDashboardStats');
            if (res && res.status === 'success' && res.data) {
                this.stats = res.data.summary || {};
                this.recentOrders = res.data.recentOrders || [];
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat dashboard', 'error');
        }
        this.loading = false;
    },

    formatCurrency(val) {
        return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
    },

    formatNumber(val) {
        return Number(val || 0).toLocaleString('id-ID');
    },

    statusColor(status) {
        var colors = {
            pending: 'bg-yellow-100 text-yellow-700',
            processing: 'bg-blue-100 text-blue-700',
            shipped: 'bg-purple-100 text-purple-700',
            delivered: 'bg-green-100 text-green-700',
            completed: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    }
}));

// ================================================================
// EZYFAST SETTINGS
// ================================================================
Alpine.data('ezyfastSettings', () => ({
    loading: true,
    isSaving: false,
    // state for blogger config page verification
    bloggerCheck: {
        loading: false,
        result: null,
        error: null
    },
    // diagnostics viewer state
    bloggerDiag: {
        loading: false,
        data: null,
        error: null
    },

    settings: {
        blogId: '',
        blogUrl: '',
        siteName: '',
        telegramBotId: '',
        currency: 'IDR',
        webAppUrl: '',
        siteKey: '',
        pageIdSystemConfig: ''
    },

    async init() {
        await this.loadSettings();
    },

    async loadSettings() {
        this.loading = true;
        try {
            // Request settings for the current blog context when available
            var blogIdParam = (this.settings && this.settings.blogId) || window.EZY_BLOG_ID || '';
            var res = await efApi('ef_getSettings', { blogId: blogIdParam });
            if (res && res.status === 'success' && res.data) {
                this.settings = { ...this.settings, ...res.data };
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat pengaturan', 'error');
        }
        this.loading = false;
    },

    async saveSettings() {
        this.isSaving = true;
        try {
            var res = await efApi('ef_saveSettings', this.settings);
            console.log('ef_saveSettings result', res);
            if (res && res.status === 'success') {
                var msg = 'Pengaturan berhasil disimpan.';
                if (res.syncInfo) msg += '\n' + res.syncInfo;
                if (window.showToast) window.showToast(msg, 'success');
                await this.loadSettings();
            } else {
                if (window.showToast) window.showToast(res.message || 'Gagal menyimpan.', 'error');
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal menyimpan pengaturan.', 'error');
        }
        this.isSaving = false;
    },

    // Verifikasi halaman konfigurasi di Blogger (dipanggil oleh UI)
    async checkBloggerConfigPage() {
        // reset state
        this.bloggerCheck.loading = true;
        this.bloggerCheck.result = null;
        this.bloggerCheck.error = null;

        if (!this.settings || !this.settings.blogId) {
            this.bloggerCheck.error = 'Blog ID kosong.';
            this.bloggerCheck.loading = false;
            return;
        }

        try {
            var res = await efApi('ef_checkBloggerConfigPage', { blogId: this.settings.blogId });
            console.log('ef_checkBloggerConfigPage', res);
            if (res && res.status === 'success') {
                this.bloggerCheck.result = res.data || null;
                if (window.showToast) window.showToast('Pemeriksaan selesai.', 'success');
            } else {
                this.bloggerCheck.error = res.message || 'Pemeriksaan gagal.';
                if (window.showToast) window.showToast(this.bloggerCheck.error, 'error');
            }
        } catch (e) {
            console.error(e);
            this.bloggerCheck.error = e.message || String(e);
            if (window.showToast) window.showToast('Gagal memeriksa halaman konfigurasi.', 'error');
        }

        this.bloggerCheck.loading = false;
    },

    // Ambil LAST_BLOGGER_SYNC / LAST_BLOGGER_PAGE_CHECK dari server
    async getBloggerDiagnostics() {
        this.bloggerDiag.loading = true;
        this.bloggerDiag.data = null;
        this.bloggerDiag.error = null;

        if (!this.settings || !this.settings.blogId) {
            this.bloggerDiag.error = 'Blog ID kosong.';
            this.bloggerDiag.loading = false;
            return;
        }

        try {
            var res = await efApi('ef_getBloggerDiagnostics', { blogId: this.settings.blogId });
            console.log('ef_getBloggerDiagnostics', res);
            if (res && res.status === 'success') {
                this.bloggerDiag.data = res;
                if (window.showToast) window.showToast('Diagnostik diambil.', 'success');
            } else {
                this.bloggerDiag.error = res.message || 'Gagal ambil diagnostik.';
                if (window.showToast) window.showToast(this.bloggerDiag.error, 'error');
            }
        } catch (e) {
            console.error(e);
            this.bloggerDiag.error = e.message || String(e);
            if (window.showToast) window.showToast('Gagal ambil diagnostik.', 'error');
        }

        this.bloggerDiag.loading = false;
    },

    // Force recreate System Config Page (delete existing PAGE_ID and create a new one)
    async forceRecreateConfig() {
        if (!this.settings || !this.settings.blogId) {
            if (window.showToast) window.showToast('Blog ID kosong.', 'error');
            return;
        }
        if (!confirm('Anda yakin akan membuat ulang System Config Page? Halaman lama akan di-overwrite/ditimpa.')) return;

        this.bloggerDiag.loading = true;
        try {
            var res = await efApi('ef_forceRecreateBloggerConfig', { blogId: this.settings.blogId });
            console.log('ef_forceRecreateBloggerConfig', res);
            if (res && res.status === 'success') {
                if (window.showToast) window.showToast('Permintaan recreate dikirim. Periksa diagnostik untuk hasil.', 'success');
                // reload settings & diagnostics
                await this.loadSettings();
                await this.getBloggerDiagnostics();
            } else {
                if (window.showToast) window.showToast(res.message || 'Gagal recreate.', 'error');
            }
        } catch (e) {
            console.error(e);
            if (window.showToast) window.showToast('Gagal mengirim permintaan recreate.', 'error');
        }
        this.bloggerDiag.loading = false;
    },

    // Sinkronisasi PAGE_ID dari LAST_BLOGGER_SYNC jika memungkinkan
    async syncPageIdFromLastSync() {
        if (!this.settings || !this.settings.blogId) {
            if (window.showToast) window.showToast('Blog ID kosong.', 'error');
            return;
        }
        if (!confirm('Sinkronkan PAGE_ID dari LAST_BLOGGER_SYNC? Operasi ini akan memvalidasi pageId yang tercatat dan menuliskannya sebagai PAGE_ID resmi jika valid.')) return;

        this.bloggerDiag.loading = true;
        this.bloggerDiag.error = null;
        try {
            var res = await efApi('ef_reconcilePageId', { blogId: this.settings.blogId });
            console.log('ef_reconcilePageId', res);
            if (res && res.status === 'success') {
                if (window.showToast) window.showToast('PAGE_ID disinkronkan dari LAST_BLOGGER_SYNC.', 'success');
                // reload settings & diagnostics
                await this.loadSettings();
                await this.getBloggerDiagnostics();
            } else {
                this.bloggerDiag.error = res.message || 'Gagal rekonsiliasi PAGE_ID.';
                if (window.showToast) window.showToast(this.bloggerDiag.error, 'error');
            }
        } catch (e) {
            console.error(e);
            this.bloggerDiag.error = e.message || String(e);
            if (window.showToast) window.showToast('Gagal melakukan rekonsiliasi PAGE_ID.', 'error');
        }
        this.bloggerDiag.loading = false;
    }
}));

// ================================================================
// EZYFAST CUSTOMERS
// ================================================================
Alpine.data('ezyfastCustomers', () => ({
    loading: true,
    customers: [],
    searchQuery: '',

    async init() {
        await this.loadCustomers();
    },

    async loadCustomers() {
        this.loading = true;
        try {
            var res = await efApi('ef_getCustomers');
            if (res && res.status === 'success') {
                this.customers = res.data || [];
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat data pelanggan', 'error');
        }
        this.loading = false;
    },

    get filteredCustomers() {
        if (!this.searchQuery) return this.customers;
        var q = this.searchQuery.toLowerCase();
        return this.customers.filter(function(c) {
            return (c.name || '').toLowerCase().includes(q) ||
                   (c.email || '').toLowerCase().includes(q) ||
                   (c.phone || '').includes(q);
        });
    },

    formatCurrency(val) {
        return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
    }
}));

// ================================================================
// EZYFAST ORDERS
// ================================================================
Alpine.data('ezyfastOrders', () => ({
    loading: true,
    orders: [],
    filter: 'all',
    selectedOrder: null,

    async init() {
        await this.loadOrders();
    },

    async loadOrders() {
        this.loading = true;
        try {
            var res = await efApi('ef_getOrders');
            if (res && res.status === 'success') {
                this.orders = res.data || [];
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat data pesanan', 'error');
        }
        this.loading = false;
    },

    get filteredOrders() {
        if (this.filter === 'all') return this.orders;
        return this.orders.filter(function(o) {
            return o.status === this.filter;
        }.bind(this));
    },

    viewOrder(order) {
        this.selectedOrder = order;
    },

    closeDetail() {
        this.selectedOrder = null;
    },

    async updateStatus(id, status) {
        try {
            var res = await efApi('ef_updateOrderStatus', { id: id, status: status });
            if (res && res.status === 'success') {
                if (window.showToast) window.showToast('Status berhasil diperbarui.', 'success');
                await this.loadOrders();
                this.closeDetail();
            } else {
                if (window.showToast) window.showToast(res.message || 'Gagal memperbarui status.', 'error');
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memperbarui status.', 'error');
        }
    },

    statusColor(status) {
        var colors = {
            pending: 'bg-yellow-100 text-yellow-700',
            processing: 'bg-blue-100 text-blue-700',
            shipped: 'bg-purple-100 text-purple-700',
            delivered: 'bg-green-100 text-green-700',
            completed: 'bg-green-100 text-green-700',
            cancelled: 'bg-red-100 text-red-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    },

    formatCurrency(val) {
        return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
    }
}));

// ================================================================
// EZYFAST ARTIKEL (Blogger Feed)
// ================================================================
Alpine.data('ezyfastArtikel', () => ({
    loading: true,
    syncing: false,
    articles: [],
    maxResults: 50,

    async init() {
        await this.loadArticles();
    },

    async loadArticles() {
        this.loading = true;
        try {
            var res = await efApi('ef_getArticles');
            if (res && res.status === 'success') {
                this.articles = res.data || [];
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat artikel', 'error');
        }
        this.loading = false;
    },

    async syncFromBlogger() {
        this.syncing = true;
        try {
            var res = await efApi('ef_fetchArticles', { maxResults: this.maxResults });
            if (res && res.status === 'success') {
                if (window.showToast) window.showToast(res.message || 'Sinkronisasi berhasil.', 'success');
                await this.loadArticles();
            } else {
                if (window.showToast) window.showToast(res.message || 'Gagal sinkronisasi.', 'error');
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal sinkronisasi dari Blogger.', 'error');
        }
        this.syncing = false;
    },

    async deleteArticle(id) {
        if (!confirm('Yakin ingin menghapus artikel ini dari cache?')) return;
        try {
            var res = await efApi('ef_deleteArticle', { id: id });
            if (res && res.status === 'success') {
                if (window.showToast) window.showToast('Artikel dihapus.', 'success');
                await this.loadArticles();
            } else {
                if (window.showToast) window.showToast(res.message || 'Gagal menghapus.', 'error');
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal menghapus artikel.', 'error');
        }
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }
}));
