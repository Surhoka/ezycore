// ================================================================
// HELPER: Promise-based sendDataToGoogle untuk ecommerce
// ================================================================
function ecomApi(action, data) {
  return new Promise(function (resolve, reject) {
    if (typeof window.sendDataToGoogle !== 'function') {
      reject(new Error('sendDataToGoogle is not available'));
      return;
    }
    window.sendDataToGoogle(action, data || {}, resolve, reject);
  });
}

// ================================================================
// ECOMMERCE DASHBOARD
// ================================================================
Alpine.data('ecommerceDashboard', () => ({
    charts: {},
    map: null,
    loading: true,

    totalCustomers: 0,
    totalOrders: 0,
    orderPercentChange: 0,
    orderPercentChangeNeg: false,
    todayRevenue: 0,
    thisMonthRevenue: 0,
    revenuePercentChange: 0,

    countries: [],
    recentOrders: [],
    mapMarkers: [],

    monthlySales: { labels: [], sales: [], revenue: [] },
    weeklyTarget: { labels: [], sales: [], revenue: [] },
    statistics: { labels: [], sales: [], revenue: [] },

    async init() {
        await this.loadDashboardData();
        this.$nextTick(() => {
            this.initDatePicker();
            this.initCharts();
            this.initMap();
        });
    },

    async loadDashboardData() {
        this.loading = true;
        try {
            const res = await ecomApi('getDashboardStats');
            if (res && res.status === 'success' && res.data) {
                const d = res.data;
                const s = d.summary || {};
                this.totalCustomers = s.totalCustomers || 0;
                this.totalOrders = s.totalOrders || 0;
                this.orderPercentChange = Math.abs(s.orderPercentChange || 0);
                this.orderPercentChangeNeg = (s.orderPercentChange || 0) < 0;
                this.todayRevenue = s.todayRevenue || 0;
                this.thisMonthRevenue = s.thisMonthRevenue || 0;
                this.revenuePercentChange = s.revenuePercentChange || 0;
                this.monthlySales = d.monthlySales || this.monthlySales;
                this.weeklyTarget = d.weeklyTarget || this.weeklyTarget;
                this.statistics = d.statistics || this.statistics;
                this.recentOrders = d.recentOrders || [];
                this.countries = d.demographics || [];
                this.mapMarkers = d.mapMarkers || [];
            }
        } catch (e) {
            if (window.showToast) window.showToast('Gagal memuat data dashboard', 'error');
        }
        this.loading = false;
    },

    formatCurrency(val) {
        return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
    },

    formatNumber(val) {
        return Number(val || 0).toLocaleString('id-ID');
    },

    initDatePicker() {
        if (typeof flatpickr !== 'undefined') {
            flatpickr(".datepicker", {
                mode: "range", static: true, monthSelectorType: "static", dateFormat: "M j, Y",
                defaultDate: [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()],
                prevArrow: '<svg class="fill-current" width="7" height="11" viewBox="0 0 7 11"><path d="M5.4 10.8L1.4 6.8 5.4 2.8 6.8 4.2 4.2 6.8 6.8 9.4z" /></svg>',
                nextArrow: '<svg class="fill-current" width="7" height="11" viewBox="0 0 7 11"><path d="M1.4 10.8L5.4 6.8 1.4 2.8 0 4.2 2.6 6.8 0 9.4z" /></svg>',
            });
        }
    },

    async initCharts() {
        if (typeof Chart === 'undefined') {
            try { await window.app.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'); }
            catch (e) { return; }
        }

        const ms = this.monthlySales;
        const wt = this.weeklyTarget;
        const st = this.statistics;

        const ctx1 = document.getElementById("chartOne");
        if (ctx1) {
            this.charts.chartOne = new Chart(ctx1, {
                type: "line",
                data: {
                    labels: ms.labels,
                    datasets: [
                        { label: "Sales", data: ms.sales, borderColor: "#3C50E0", backgroundColor: "rgba(60, 80, 224, 0.1)", borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: "#fff", pointBorderColor: "#3C50E0" },
                        { label: "Revenue", data: ms.revenue, borderColor: "#80CAEE", backgroundColor: "rgba(128, 202, 238, 0.1)", borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: "#fff", pointBorderColor: "#80CAEE" }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { grid: { display: false } }, y: { grid: { borderDash: [5, 5] }, beginAtZero: true } } }
            });
        }

        const ctx2 = document.getElementById("chartTwo");
        if (ctx2) {
            this.charts.chartTwo = new Chart(ctx2, {
                type: "bar",
                data: {
                    labels: wt.labels,
                    datasets: [
                        { label: "Sales", data: wt.sales, backgroundColor: "#3C50E0", borderRadius: 4, barThickness: 10 },
                        { label: "Revenue", data: wt.revenue, backgroundColor: "#80CAEE", borderRadius: 4, barThickness: 10 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, display: false } } }
            });
        }

        const ctx3 = document.getElementById("chartThree");
        if (ctx3) {
            this.charts.chartThree = new Chart(ctx3, {
                type: "bar",
                data: {
                    labels: st.labels,
                    datasets: [
                        { label: "Sales", data: st.sales, backgroundColor: "#3C50E0", borderRadius: 2, barPercentage: 0.6 },
                        { label: "Revenue", data: st.revenue, backgroundColor: "#80CAEE", borderRadius: 2, barPercentage: 0.6 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { borderDash: [5, 5] }, beginAtZero: true } } }
            });
        }
    },

    initMap() {
        const mapEl = document.getElementById("mapOne");
        if (mapEl && typeof jsVectorMap !== 'undefined') {
            mapEl.innerHTML = '';
            this.map = new jsVectorMap({
                selector: "#mapOne", map: "world", zoomButtons: true,
                regionStyle: { initial: { fill: "#C8D0D8" }, hover: { fillOpacity: 1, fill: "#3056D3" } },
                markers: this.mapMarkers,
                markerStyle: { initial: { r: 5, fill: "#3056D3", opacity: 1, stroke: "#FFF", strokeWidth: 1 }, hover: { stroke: "#3056D3", fill: "#FFF", strokeWidth: 2 } },
            });
        }
    }
}));

// ================================================================
// ECOMMERCE PRODUCTS
// ================================================================
// ECOMMERCE PRODUCTS
// ================================================================
Alpine.data('ecommerceProducts', () => ({
  dbId: null,
  products: [],
  categories: [],
  isLoading: false,
  isSyncing: false,
  isSaving: false,
  newImageUrl: '',
  showModal: false,
  isEditing: false,
  editingItem: {},

  init() {
    var storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
    var config = JSON.parse(localStorage.getItem(storageKey) || '{}');
    this.dbId = config.pluginContentDbId || config.sheetId || config.dbId || null;
    if (!this.dbId && window.showToast) window.showToast('Database ID tidak ditemukan.', 'error');
    this.loadData();
  },

  async loadData() {
    this.isLoading = true;
    try {
      var [pRes, cRes] = await Promise.all([
        ecomApi('getProducts'),
        ecomApi('getCategories')
      ]);
      this.products = pRes.data || [];
      this.categories = cRes.data || [];
    } catch (e) {
      if (window.showToast) window.showToast('Gagal memuat data', 'error');
    }
    this.isLoading = false;
  },

  openAddModal() {
    this.isEditing = false;
    this.newImageUrl = '';
    this.editingItem = { name: '', description: '', sku: '', imageurl: '', images: [], price: 0, compareatprice: 0, stock: 0, weight: 0, category: '', status: 'draft', active: true };
    this.showModal = true;
  },

  editProduct(product) {
    this.isEditing = true;
    this.newImageUrl = '';
    var item = { ...product };
    item.price = Number(item.price || 0);
    item.compareatprice = Number(item.compareatprice || 0);
    item.stock = Number(item.stock || 0);
    item.weight = Number(item.weight || 0);
    item.imageurl = item.imageurl || '';
    try { item.images = typeof item.images === 'string' ? JSON.parse(item.images) : (item.images || []); } catch (e) { item.images = []; }
    item.active = item.active === true || item.active === 'TRUE' || item.status === 'published' || item.status === 'active';
    this.editingItem = item;
    this.showModal = true;
  },

  async saveProduct() {
    if (!this.editingItem.name) { if (window.showToast) window.showToast('Nama produk harus diisi', 'warning'); return; }
    this.isSaving = true;
    try {
      var images = this.editingItem.images || [];
      var payload = {
        ...this.editingItem,
        images: JSON.stringify(images),
        imageurl: images.length > 0 ? images[0] : (this.editingItem.imageurl || ''),
        dbId: this.dbId
      };
      if (!payload.slug) {
        payload.slug = (payload.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      payload.status = payload.active ? 'published' : 'draft';
      if (this.editingItem.publishedat) payload.publishedat = this.editingItem.publishedat;
      var res = await ecomApi('saveProduct', payload);
      if (res.status === 'success') {
        var d = res.data || {};
        var savedStatus = d.status || payload.status;
        var pubMsg = '';
        if (res.publish) {
          if (res.publish.status === 'success') {
            var ts = res.publish.published;
            pubMsg = ts ? ' SSR berhasil (' + new Date(ts).toLocaleString('id-ID') + ')' : ' SSR berhasil';
          } else {
            pubMsg = ' SSR: ' + (res.publish.message || 'gagal');
          }
        }
        this.editingItem.status = savedStatus;
        this.editingItem.id = d.id || this.editingItem.id;
        if (d.publishedAt) this.editingItem.publishedat = d.publishedAt;
        if (window.showToast) window.showToast('Produk berhasil disimpan.' + pubMsg, 'success');
        this.showModal = false;
        this.loadData();
      } else {
        if (window.showToast) window.showToast(res.message || 'Gagal menyimpan', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Terjadi kesalahan: ' + e, 'error');
    } finally {
      this.isSaving = false;
    }
  },

  async deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    try {
      var res = await ecomApi('deleteProduct', { id: id, dbId: this.dbId });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Produk dihapus', 'success');
        this.loadData();
      } else {
        if (window.showToast) window.showToast(res.message || 'Gagal menghapus', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Gagal menghapus: ' + e, 'error');
    }
  },

  async syncAllToBlogger() {
    var activeCount = this.products.filter(function (p) { return p.active === true || p.active === 'TRUE' || p.status === 'published' || p.status === 'active'; }).length;
    if (activeCount === 0) {
      if (window.showToast) window.showToast('Tidak ada produk aktif yang perlu disinkronkan.', 'warning');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin menyinkronkan ' + activeCount + ' produk ke Blogger?')) return;
    this.isSyncing = true;
    if (window.showToast) window.showToast('Sedang menyinkronkan seluruh produk...', 'info');
    try {
      var res = await ecomApi('syncAllProductsToBlogger', { dbId: this.dbId });
      if (res.status === 'success') {
        if (window.showToast) window.showToast(res.message, 'success');
      } else {
        if (window.showToast) window.showToast(res.message || 'Gagal sinkronisasi', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Terjadi kesalahan koneksi saat sinkronisasi.', 'error');
    } finally {
      this.isSyncing = false;
    }
  },

  addImageUrl() {
    var url = (this.newImageUrl || '').trim();
    if (!url) { if (window.showToast) window.showToast('Masukkan URL gambar', 'warning'); return; }
    if (!this.editingItem.images) this.editingItem.images = [];
    this.editingItem.images.push(url);
    this.newImageUrl = '';
  },

  removeImage(idx) {
    if (!this.editingItem.images) return;
    this.editingItem.images.splice(idx, 1);
  },

  setPrimaryImage(idx) {
    if (!this.editingItem.images || idx <= 0) return;
    var img = this.editingItem.images.splice(idx, 1)[0];
    this.editingItem.images.unshift(img);
    if (window.showToast) window.showToast('Thumbnail utama diperbarui', 'success');
  },

  copyImageUrl(url) {
    if (!navigator.clipboard) { if (window.showToast) window.showToast('Clipboard tidak tersedia', 'error'); return; }
    navigator.clipboard.writeText(url).then(function () {
      if (window.showToast) window.showToast('URL disalin', 'success');
    }).catch(function () {
      if (window.showToast) window.showToast('Gagal menyalin URL', 'error');
    });
  },

  getFirstImage(product) {
    if (product.imageurl) return product.imageurl;
    try {
      var images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []);
      return images.length > 0 ? images[0] : null;
    } catch (e) { return null; }
  },

  formatPrice(price) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return 'â€”';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'â€”';
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'â€”'; }
  }
}));

// ================================================================
// ECOMMERCE ALBUMS
// ================================================================
Alpine.data('ecommerceAlbums', () => ({
  dbId: null,
  albums: [],
  albumFiles: [],
  fileSearchQuery: '',
  selectedAlbumId: '',
  isLoading: false,
  expandedIds: [],
  isSyncing: false,
  showAlbumModal: false,
  showYoutubeModal: false,
  showDriveModal: false,
  isEditing: false,
  editingAlbum: {},
  youtubeInput: { url: '', title: '', isSaving: false },
  driveInput: { url: '', title: '', isSaving: false },
  currentPage: 1,
  itemsPerPage: 10,

  get paginatedAlbumFiles() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAlbumFiles.slice(start, start + this.itemsPerPage);
  },

  get totalPages() {
    return Math.max(1, Math.ceil(this.filteredAlbumFiles.length / this.itemsPerPage));
  },

  get filteredAlbumFiles() {
    if (!this.fileSearchQuery.trim()) return this.albumFiles;
    const q = this.fileSearchQuery.toLowerCase();
    return this.albumFiles.filter(f =>
      (f.filename && f.filename.toLowerCase().includes(q)) ||
      (f.originalfilename && f.originalfilename.toLowerCase().includes(q))
    );
  },

  get selectedAlbumPath() {
    if (!this.selectedAlbumId) return [];
    const path = [];
    let currentId = this.selectedAlbumId;
    let safety = 0;
    while (currentId && safety < 10) {
      const album = this.albums.find(a => a.id === currentId);
      if (album) { path.unshift(album); currentId = album.parentid; }
      else break;
      safety++;
    }
    return path;
  },

  async init() {
    if (this.$watch) {
      this.$watch('fileSearchQuery', () => { this.currentPage = 1; });
      this.$watch('selectedAlbumId', () => { this.currentPage = 1; });
    }
    var storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
    var cache = JSON.parse(localStorage.getItem(storageKey) || '{}');
    this.dbId = cache.pluginContentDbId || cache.sheetId || cache.dbId || null;
    this.fetchAlbums();
  },

  openAddAlbum() {
    this.isEditing = false;
    this.editingAlbum = { name: '', slug: '', description: '', parent_id: '', active: true, sortOrder: 0 };
    this.showAlbumModal = true;
  },

  editAlbum(item) {
    this.isEditing = true;
    this.editingAlbum = { ...item, parent_id: item.parentid || '' };
    this.showAlbumModal = true;
  },

  async saveAlbum() {
    if (!this.editingAlbum.name) { if (window.showToast) window.showToast('Nama album harus diisi', 'warning'); return; }
    const btn = document.getElementById('save-album-btn');
    if (window.setButtonLoading) window.setButtonLoading(btn, true);
    try {
      const payload = { ...this.editingAlbum, dbId: this.dbId };
      if (!payload.slug) {
        payload.slug = window.slugify_ ? window.slugify_(payload.name) : payload.name.toLowerCase().replace(/\s+/g, '-');
      }
      const res = await ecomApi('saveAlbum', payload);
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('Album berhasil disimpan', 'success');
        this.showAlbumModal = false;
        await this.fetchAlbums();
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal menyimpan album', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Terjadi kesalahan: ' + e, 'error');
    } finally {
      if (window.setButtonLoading) window.setButtonLoading(btn, false);
    }
  },

  async deleteAlbum(id) {
    if (!confirm('Hapus album ini? Semua file di dalamnya akan dihapus.')) return;
    try {
      const res = await ecomApi('deleteAlbum', { id: id, dbId: this.dbId });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('Album dihapus', 'success');
        if (this.selectedAlbumId === id) { this.selectedAlbumId = ''; this.albumFiles = []; }
        await this.fetchAlbums();
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal menghapus album', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Gagal menghapus: ' + e, 'error');
    }
  },

  async fetchAlbums() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getAlbums', { dbId: this.dbId });
      if (res && res.status === 'success') {
        this.albums = res.data || [];
        if (!this.selectedAlbumId && this.albums.length) {
          this.selectAlbum(this.albums[0].id);
        }
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal memuat album', 'error');
      }
    } catch (e) {
      console.error('fetchAlbums:', e);
      if (window.showToast) window.showToast('Gagal memuat album', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  async selectAlbum(albumId) {
    this.selectedAlbumId = albumId;
    await this.fetchAlbumFiles(albumId);
  },

  async fetchAlbumFiles(albumId) {
    if (!albumId) return;
    this.isLoading = true;
    try {
      const res = await ecomApi('getAlbumImages', { dbId: this.dbId, albumId: albumId });
      if (res && res.status === 'success') {
        this.albumFiles = res.data || [];
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal memuat file', 'error');
      }
    } catch (e) {
      console.error('fetchAlbumFiles:', e);
      if (window.showToast) window.showToast('Gagal memuat file album', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  async editFileCaption(file) {
    const newName = prompt('Ubah Nama/Caption:', file.filename || '');
    if (newName !== null && newName !== file.filename) {
      const originalName = file.filename;
      file.filename = newName;
      try {
        const res = await ecomApi('saveAlbumImage', {
          ...file, dbId: this.dbId, albumId: this.selectedAlbumId,
          fileName: file.filename, originalFileName: file.originalfilename,
          fileUrl: file.fileurl, contentType: file.contenttype || 'image',
          thumbnailUrl: file.thumbnailurl || '',
          createdat: file.createdat || ''
        });
        if (res && res.status === 'success') {
          if (window.showToast) window.showToast('Caption diperbarui', 'success');
        } else {
          file.filename = originalName;
          if (window.showToast) window.showToast((res && res.message) || 'Gagal menyimpan caption', 'error');
        }
      } catch (e) {
        file.filename = originalName;
        if (window.showToast) window.showToast('Gagal menyimpan: ' + e, 'error');
      }
    }
  },

  async deleteFile(id) {
    if (!confirm('Hapus file ini?')) return;
    try {
      const res = await ecomApi('deleteAlbumImage', { id: id, dbId: this.dbId });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('File dihapus', 'success');
        await this.fetchAlbumFiles(this.selectedAlbumId);
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal menghapus file', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Gagal menghapus: ' + e, 'error');
    }
  },

  async openBloggerEditor() {
    if (!this.selectedAlbumId) {
      if (window.showToast) window.showToast('Pilih album terlebih dahulu!', 'warning');
      return;
    }
    var storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
    var cache = JSON.parse(localStorage.getItem(storageKey) || '{}');
    var blogId = cache.blogId || '';
    var pageId = cache.pageIdAlbum;
    if (!blogId || !pageId) {
      try {
        const res = await ecomApi('getEcommerceSettings');
        if (res.status === 'success' && res.data) {
          blogId = res.data.blogId || blogId;
          pageId = res.data.pageIdAlbum || pageId;
          cache.blogId = blogId;
          cache.pageIdAlbum = pageId;
          localStorage.setItem(storageKey, JSON.stringify(cache));
        }
      } catch (e) {
        console.error('Failed to fetch settings:', e);
      }
    }
    if (!blogId || !pageId) {
      if (window.showToast) window.showToast('Harap isi Blog ID dan Album Page ID di menu Settings.', 'warning');
      return;
    }

    if (window.showToast) window.showToast('Menginjeksi template ke halaman Blogger...', 'info');
    var injectTime = new Date().toISOString();
    var template = '<div class="ezy-album-entry" data-album-id="' + this.selectedAlbumId + '" style="background-color: white; border-radius: 20px; border: 2px solid rgb(226, 232, 240); box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px; font-family: Inter, sans-serif; margin-bottom: 30px; padding: 25px;">\n  <h3 style="border-bottom: 1px solid rgb(241, 245, 249); color: #0f172a; font-size: 18px; margin-top: 0px; padding-bottom: 10px;"><span style="color: #475569; font-size: 13px;">Area Gambar :</span></h3><div style="text-align: center;"><br /></div>\n  <div style="display:none" data-meta=\'{"_type":"album_image","datePublished":"' + injectTime + '"}\'></div>\n  \n  <div style="align-items: center; border-top: 1px solid rgb(241, 245, 249); display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px;">\n    <span style="color: #94a3b8; font-size: 11px;">EzyStore Metadata System v2.0</span>\n    <span style="background: rgb(59, 130, 246); border-radius: 4px; color: white; font-size: 10px; font-weight: bold; padding: 2px 8px;">SYNC READY</span>\n  </div>\n</div><br />';

    try {
      const res = await ecomApi('injectAlbumTemplate', {
        dbId: this.dbId,
        blogId: blogId,
        pageIdAlbum: pageId,
        html: template,
        title: 'Album - ' + this.selectedAlbumId
      });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('Template berhasil diinjeksi! Buka Editor Blogger untuk upload gambar.', 'success');
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal injeksi template', 'error');
      }
    } catch (e) {
      console.error('injectAlbumTemplate:', e);
      if (window.showToast) window.showToast('Gagal injeksi template: ' + e.message, 'error');
    }

    var url = 'https://draft.blogger.com/blog/page/edit/' + blogId + '/' + pageId;
    window.open(url, 'BloggerEditor', 'width=1100,height=800,scrollbars=yes,resizable=yes');
  },

  openYoutubeModal() {
    if (!this.selectedAlbumId) { if (window.showToast) window.showToast('Pilih album terlebih dahulu!', 'warning'); return; }
    this.youtubeInput = { url: '', title: '', isSaving: false };
    this.showYoutubeModal = true;
  },

  openDriveModal() {
    if (!this.selectedAlbumId) { if (window.showToast) window.showToast('Pilih album terlebih dahulu!', 'warning'); return; }
    this.driveInput = { url: '', title: '', isSaving: false };
    this.showDriveModal = true;
  },

  async addYoutubeVideo() {
    const url = (this.youtubeInput.url || '').trim();
    if (!url) { if (window.showToast) window.showToast('URL YouTube harus diisi', 'warning'); return; }
    const videoId = extractYoutubeId(url);
    if (!videoId) { if (window.showToast) window.showToast('URL YouTube tidak valid.', 'error'); return; }
    this.youtubeInput.isSaving = true;
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const title = (this.youtubeInput.title || '').trim() || 'Video ' + videoId;
    try {
      const res = await ecomApi('saveAlbumImage', {
        albumId: this.selectedAlbumId, dbId: this.dbId,
        fileName: title, originalFileName: url, fileUrl: embedUrl,
        thumbnailUrl: thumbUrl, contentType: 'youtube', mimeType: 'video/youtube', size: 0,
        createdat: new Date().toISOString()
      });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('Video YouTube berhasil ditambahkan!', 'success');
        this.showYoutubeModal = false;
        await this.fetchAlbumFiles(this.selectedAlbumId);
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal menyimpan video', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Terjadi kesalahan: ' + e, 'error');
    } finally {
      this.youtubeInput.isSaving = false;
    }
  },

  async addDriveVideo() {
    const url = (this.driveInput.url || '').trim();
    if (!url) { if (window.showToast) window.showToast('URL Google Drive harus diisi', 'warning'); return; }
    const driveId = this._extractDriveId(url);
    if (!driveId) { if (window.showToast) window.showToast('URL Google Drive tidak valid.', 'error'); return; }
    this.driveInput.isSaving = true;
    const directUrl = 'https://drive.google.com/uc?id=' + driveId;
    const title = (this.driveInput.title || '').trim() || 'Drive Video ' + driveId.slice(-4);
    try {
      const res = await ecomApi('saveAlbumImage', {
        albumId: this.selectedAlbumId, dbId: this.dbId,
        fileName: title, originalFileName: url, fileurl: directUrl,
        thumbnailUrl: '', contentType: 'drive', mimeType: 'video/mp4', size: 0,
        createdat: new Date().toISOString()
      });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast('Video Drive berhasil ditambahkan!', 'success');
        this.showDriveModal = false;
        await this.fetchAlbumFiles(this.selectedAlbumId);
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal menyimpan video', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Terjadi kesalahan: ' + e, 'error');
    } finally {
      this.driveInput.isSaving = false;
    }
  },

  async syncMetadata() {
    if (!this.selectedAlbumId) { if (window.showToast) window.showToast('Pilih album terlebih dahulu!', 'warning'); return; }
    this.isSyncing = true;
    if (window.showToast) window.showToast('Menarik metadata dari Blogger...', 'info');
    try {
      const storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
      var cache = JSON.parse(localStorage.getItem(storageKey) || '{}');
      var webUrl = cache.webUrl || cache.blogUrl || '';
      if (!webUrl) {
        try {
          const res = await ecomApi('getEcommerceSettings');
          if (res.status === 'success' && res.data) {
            webUrl = res.data.blogUrl || '';
            cache.blogUrl = webUrl;
            cache.webUrl = webUrl;
            localStorage.setItem(storageKey, JSON.stringify(cache));
          }
        } catch (e) {
          console.error('Failed to fetch settings:', e);
        }
      }
      if (!webUrl) { throw new Error('Web URL tidak ditemukan. Harap simpan konfigurasi di menu Settings.'); }
      const res = await ecomApi('syncAlbumMetadata', { dbId: this.dbId, albumId: this.selectedAlbumId });
      if (res && res.status === 'success') {
        if (window.showToast) window.showToast(res.message, 'success');
        await this.fetchAlbumFiles(this.selectedAlbumId);
      } else {
        if (window.showToast) window.showToast((res && res.message) || 'Gagal sinkron metadata', 'error');
      }
    } catch (e) {
      console.error('syncMetadata:', e);
      if (window.showToast) window.showToast(e.message || 'Gagal sinkron metadata', 'error');
    } finally {
      this.isSyncing = false;
    }
  },

  hasChildren(id) {
    return this.albums.some(a => a.parentid === id);
  },

  toggleExpand(id) {
    if (this.expandedIds.includes(id)) {
      this.expandedIds = this.expandedIds.filter(i => i !== id);
    } else {
      this.expandedIds.push(id);
    }
  },

  isRowVisible(alb) {
    if (!alb.parentid) return true;
    let currentParentId = alb.parentid;
    while (currentParentId) {
      if (!this.expandedIds.includes(currentParentId)) return false;
      const parent = this.albums.find(a => a.id === currentParentId);
      currentParentId = parent ? parent.parentid : null;
    }
    return true;
  },

  formatDate(dateStr) {
    if (!dateStr) return 'â€”';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'â€”';
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'â€”'; }
  },

  getThumbUrl(file) {
    if (file.thumbnailurl) return file.thumbnailurl;
    if (file.contenttype === 'youtube') {
      const m = String(file.fileurl || '').match(/embed\/([a-zA-Z0-9_-]{11})/);
      if (m) return 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg';
    }
    if (file.contenttype === 'drive') return 'https://www.gstatic.com/images/branding/product/2x/drive_48dp.png';
    if (file.contenttype === 'blogger_video') return 'https://www.gstatic.com/images/icons/material/system/2x/movie_black_48dp.png';
    return file.fileurl || '';
  },

  isYoutube(file) { return file.contenttype === 'youtube' || file.mimetype === 'video/youtube'; },
  isDriveVideo(file) { return file.contenttype === 'drive'; },
  isBloggerVideo(file) { return file.contenttype === 'blogger_video'; },
  isVideo(file) { return this.isYoutube(file) || this.isDriveVideo(file) || this.isBloggerVideo(file) || (file.contenttype && file.contenttype.includes('video')); },

  _extractDriveId(url) {
    if (!url) return null;
    const m = String(url).match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  },

  copyUrl(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      if (window.showToast) window.showToast('URL disalin!', 'success');
    }
  }
}));

// Helper: extract YouTube ID
if (typeof window.extractYoutubeId !== 'function') {
  window.extractYoutubeId = function (url) {
    if (!url) return null;
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };
}

// ================================================================
// ECOMMERCE ORDERS
// ================================================================
Alpine.data('ecommerceOrders', () => ({
  isLoading: true,
  orders: [],
  selectedOrder: null,
  filter: 'all',

  init() { this.loadOrders(); },

  async loadOrders() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getOrders');
      this.orders = res.data || [];
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load orders', 'error');
    }
    this.isLoading = false;
  },

  get filteredOrders() {
    if (this.filter === 'all') return this.orders;
    return this.orders.filter(o => o.status === this.filter);
  },

  viewOrder(order) {
    this.selectedOrder = order;
    try {
      this.selectedOrder.items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    } catch (e) { this.selectedOrder.items = []; }
  },

  closeDetail() { this.selectedOrder = null; },

  async updateStatus(orderId, status) {
    try {
      const res = await ecomApi('updateOrderStatus', { id: orderId, status: status });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Order status updated', 'success');
        this.loadOrders();
        if (this.selectedOrder?.id === orderId) this.selectedOrder.status = status;
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to update order', 'error');
    }
  }
}));

// ================================================================
// ECOMMERCE CUSTOMERS
// ================================================================
Alpine.data('ecommerceCustomers', () => ({
  isLoading: true,
  customers: [],

  init() { this.loadCustomers(); },

  async loadCustomers() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getCustomers');
      this.customers = res.data || [];
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load customers', 'error');
    }
    this.isLoading = false;
  }
}));

// ================================================================
// ECOMMERCE REPORTS
// ================================================================
Alpine.data('ecommerceReports', () => ({
  isLoading: true,
  report: { totalOrders: 0, paidOrders: 0, totalRevenue: 0, orders: [] },
  period: 'month',

  init() { this.loadReport(); },

  async loadReport() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getSalesReport', { period: this.period });
      this.report = res.data || { totalOrders: 0, paidOrders: 0, totalRevenue: 0, orders: [] };
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load report', 'error');
    }
    this.isLoading = false;
  }
}));

// ================================================================
// ECOMMERCE CATEGORIES
// ================================================================
Alpine.data('ecommerceCategories', () => ({
  dbId: null,
  isLoading: true,
  categories: [],
  editingCat: {},
  showForm: false,

  init() {
    var storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
    var config = JSON.parse(localStorage.getItem(storageKey) || '{}');
    this.dbId = config.pluginContentDbId || config.sheetId || config.dbId || null;
    this.loadCategories();
  },

  async loadCategories() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getCategories');
      this.categories = res.data || [];
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load categories', 'error');
    }
    this.isLoading = false;
  },

  getParentName(parentId) {
    if (!parentId) return '';
    const parent = this.categories.find(c => c.id === parentId);
    return parent ? parent.name : '';
  },

  openAddForm() {
    this.editingCat = { name: '', slug: '', description: '', parentId: '', sortOrder: 0, active: true };
    this.showForm = true;
  },

  openEditForm(cat) {
    this.editingCat = {
      id: cat.id,
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      parentId: cat.parentid || '',
      sortOrder: Number(cat.sortorder || 0),
      active: cat.active === 'TRUE' || cat.active === true
    };
    this.showForm = true;
  },

  closeForm() {
    this.showForm = false;
    this.editingCat = {};
  },

  async saveCategory() {
    if (!this.editingCat.name) { if (window.showToast) window.showToast('Category name is required', 'warning'); return; }
    try {
      const payload = { ...this.editingCat, dbId: this.dbId };
      const res = await ecomApi('saveCategory', payload);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Category saved', 'success');
        this.closeForm();
        this.loadCategories();
      } else {
        if (window.showToast) window.showToast(res.message || 'Failed to save', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error: ' + e.message, 'error');
    }
  },

  async deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
      const res = await ecomApi('deleteCategory', { id: id, dbId: this.dbId });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Category deleted', 'success');
        this.loadCategories();
      } else {
        if (window.showToast) window.showToast(res.message || 'Failed to delete', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error: ' + e.message, 'error');
    }
  }
}));

// ================================================================
// ECOMMERCE SHIPPING
// ================================================================
Alpine.data('ecommerceShipping', () => ({
  isLoading: true,
  rates: [],
  editingRate: {},
  showForm: false,

  init() { this.loadRates(); },

  async loadRates() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getShippingRates');
      this.rates = res.data || [];
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load shipping rates', 'error');
    }
    this.isLoading = false;
  },

  openAddForm() {
    this.editingRate = { id: '', zone: '', courier: '', rate: 0, estimatedDays: '', minWeight: 0, maxWeight: 0, freeShippingMin: 0, status: 'active' };
    this.showForm = true;
  },

  openEditForm(rate) {
    this.editingRate = { ...rate };
    this.editingRate.rate = Number(rate.rate || 0);
    this.editingRate.minWeight = Number(rate.minWeight || 0);
    this.editingRate.maxWeight = Number(rate.maxWeight || 0);
    this.editingRate.freeShippingMin = Number(rate.freeShippingMin || 0);
    this.showForm = true;
  },

  closeForm() {
    this.showForm = false;
    this.editingRate = {};
  },

  async saveRate() {
    try {
      const res = await ecomApi('saveShippingRate', { ...this.editingRate });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Shipping rate saved', 'success');
        this.closeForm();
        this.loadRates();
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to save shipping rate', 'error');
    }
  },

  async deleteRate(id) {
    if (!confirm('Delete this shipping rate?')) return;
    try {
      const res = await ecomApi('deleteShippingRate', { id: id });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Shipping rate deleted', 'success');
        this.loadRates();
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to delete shipping rate', 'error');
    }
  }
}));

// ================================================================
// ECOMMERCE SETTINGS
// ================================================================
Alpine.data('ecommerceSettings', () => ({
  isLoading: true,
  isSaving: false,
  isPublishing: false,
  isGeneratingAuth: false,
  isDebugging: false,
  debugOutput: '',
  activeTab: 'general',
  accesstradePass: '',
  showPassword: false,
  isTestingAt: false,
  settings: {
    blogId: '', blogUrl: '', webAppUrl: '', pageIdShop: '', pageIdAlbum: '', pageIdHomeData: '',
    pageIdSystemConfig: '',
    currency: 'IDR', taxRate: '11', midtransClientKey: '', siteKey: '',
    accesstradeApiKey: '', accesstradeSiteId: '', accesstradeEmail: '', accesstradeCountryCode: 'ID', accesstradeApiUrl: ''
  },
  homeData: {
    companyName: '', supportPhone: '', supportEmail: '', storeAddress: '',
    operatingHours: '', operatingDays: '',
    socialFacebook: '', socialTwitter: '', socialInstagram: '', socialLinkedin: '',
    storeMapUrl: ''
  },

  init() {
    this.loadSettings();
    this.loadHomeData();
  },

  async loadSettings() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getEcommerceSettings');
      if (res.status === 'success' && res.data) {
        this.settings = { ...this.settings, ...res.data };
        this.syncToConfig();
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load settings', 'error');
    }
    this.isLoading = false;
  },

  async saveSettings() {
    this.isSaving = true;
    var payload = {
      blogId: this.settings.blogId,
      blogUrl: this.settings.blogUrl,
      pageIdShop: this.settings.pageIdShop,
      pageIdAlbum: this.settings.pageIdAlbum,
      pageIdHomeData: this.settings.pageIdHomeData,
      currency: this.settings.currency,
      taxRate: this.settings.taxRate,
      midtransClientKey: this.settings.midtransClientKey,
      siteKey: this.settings.siteKey,
      accesstradeApiKey: this.settings.accesstradeApiKey,
      accesstradeSiteId: this.settings.accesstradeSiteId,
      accesstradeEmail: this.settings.accesstradeEmail,
      accesstradeCountryCode: this.settings.accesstradeCountryCode || 'ID',
      accesstradeApiUrl: this.settings.accesstradeApiUrl
    };
    try {
      const res = await Promise.race([
        ecomApi('saveEcommerceSettings', payload),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Timeout')); }, 25000); })
      ]);
      if (res.status === 'success') {
        var syncMsg = res.syncInfo ? (typeof res.syncInfo === 'object' ? res.syncInfo.message || JSON.stringify(res.syncInfo) : res.syncInfo) : '';
        if (window.showToast) window.showToast('Settings saved. Sync: ' + syncMsg, 'success');
        this.syncToConfig();
        await this.loadSettings();
      } else {
        if (window.showToast) window.showToast(res.message, 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast(e.message === 'Timeout' ? 'Server tidak merespon, coba lagi' : 'Failed to save settings', 'error');
    }
    this.isSaving = false;
  },

  async generateAccesstradeHeader() {
    if (!this.settings.accesstradeEmail || !this.accesstradePass) {
      if (window.showToast) window.showToast('Mohon isi email dan password!', 'error');
      return;
    }
    this.isGeneratingAuth = true;
    try {
      if (typeof CryptoJS === 'undefined') {
        await new Promise((resolve, reject) => {
          let script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const email = this.settings.accesstradeEmail.trim();
      const passwordMd5 = CryptoJS.MD5(this.accesstradePass).toString();
      const stringToHash = email + ':' + passwordMd5;
      const finalHash = CryptoJS.SHA256(stringToHash).toString();
      
      console.log('[Accesstrade Gen] email:', email);
      console.log('[Accesstrade Gen] MD5(password):', passwordMd5);
      console.log('[Accesstrade Gen] string:', stringToHash);
      console.log('[Accesstrade Gen] SHA256:', finalHash);
      
      this.settings.accesstradeApiKey = finalHash;
      if (window.showToast) window.showToast('Header berhasil di-generate! (SHA256: ' + finalHash.substring(0, 8) + '...) Silakan Save Settings.', 'success');
    } catch (e) {
      console.error('[Accesstrade Gen] Error:', e);
      if (window.showToast) window.showToast('Gagal memuat crypto-js', 'error');
    }
    this.isGeneratingAuth = false;
  },

  async testAtProvisioning() {
    this.isTestingAt = true;
    try {
      const res = await ecomApi('testAccesstradeConnection', {
        apiKey: this.settings.accesstradeApiKey,
        email: this.settings.accesstradeEmail,
        countryCode: this.settings.accesstradeCountryCode
      });
      console.log('[AT Test] Result:', res);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Connection OK! Sites: ' + JSON.stringify(res.data).substring(0, 100), 'success');
      } else {
        if (window.showToast) window.showToast(res.message || 'Test failed', 'error');
      }
    } catch (e) {
      console.error('[AT Test] Error:', e);
      if (window.showToast) window.showToast('Test error: ' + e.message, 'error');
    }
    this.isTestingAt = false;
  },

  async runDebug() {
    this.isDebugging = true;
    this.debugOutput = 'Running debug...\n';
    try {
      const res = await ecomApi('debugAccesstrade', {});
      if (res.status === 'success' && res.data && res.data.log) {
        var lines = [];
        res.data.log.forEach(function(entry) {
          lines.push('--- ' + entry.step + ' [' + entry.status.toUpperCase() + '] ---');
          lines.push(JSON.stringify(entry.detail, null, 2));
          lines.push('');
        });
        this.debugOutput = lines.join('\n');
      } else {
        this.debugOutput = 'Error: ' + (res.message || JSON.stringify(res));
      }
      console.log('[Debug AT] Full result:', res);
    } catch (e) {
      this.debugOutput = 'Exception: ' + e.message;
      console.error('[Debug AT] Error:', e);
    }
    this.isDebugging = false;
  },

  async loadHomeData() {
    try {
      const res = await ecomApi('getHomeData');
      if (res.status === 'success' && res.data) {
        this.homeData = { ...this.homeData, ...res.data };
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load home data', 'error');
    }
  },

  async saveHomeData() {
    this.isSaving = true;
    try {
      const res = await ecomApi('saveHomeData', this.homeData);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Home data saved', 'success');
      } else {
        if (window.showToast) window.showToast(res.message, 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to save home data', 'error');
    }
    this.isSaving = false;
  },

  syncToConfig() {
    var blogId = this.settings.blogId || window.EZY_BLOG_ID || '';
    if (!blogId) return;
    var storageKey = 'EzycoreConfig_' + blogId;
    var config = JSON.parse(localStorage.getItem(storageKey) || '{}');
    config.pageIdAlbum = this.settings.pageIdAlbum;
    config.pageIdHomeData = this.settings.pageIdHomeData;
    config.pageIdSystemConfig = this.settings.pageIdSystemConfig;
    config.blogId = blogId;
    config.blogUrl = this.settings.blogUrl;
    config.webUrl = this.settings.blogUrl;
    config.siteKey = this.settings.siteKey;
    config.accesstradeApiKey = this.settings.accesstradeApiKey;
    config.accesstradeSiteId = this.settings.accesstradeSiteId;
    config.accesstradeEmail = this.settings.accesstradeEmail;
    config.accesstradeCountryCode = this.settings.accesstradeCountryCode;
    config.accesstradeApiUrl = this.settings.accesstradeApiUrl;
    localStorage.setItem(storageKey, JSON.stringify(config));
  },

  handleSave() {
    if (this.activeTab === 'homedata') {
      this.saveHomeData();
    } else {
      this.saveSettings();
    }
  }
}));

// ================================================================
// ECOMMERCE PROMOTIONS
// ================================================================
Alpine.data('ecommercePromotions', () => ({
  dbId: null,
  isLoading: true,
  isSaving: false,
  isPublishing: false,
  activeTab: 'hero',

  heroSlides: [],
  promoBanners: [],
  discountSettings: { percentage: 0, code: '', minPurchase: 0, active: false },
  freeShipping: { minAmount: 0, label: 'Free Shipping', active: false },
  featuredProducts: [],
  specialProduct: { name: '', price: 0, originalPrice: 0, imageUrl: '', link: '', badge: '', active: false },

  showHeroModal: false,
  heroEditingIndex: null,
  heroForm: { title: '', subtitle: '', imageUrl: '', buttonText: '', buttonLink: '', sortOrder: 0, active: true },

  showBannerModal: false,
  bannerEditingIndex: null,
  bannerForm: { title: '', imageUrl: '', link: '', sortOrder: 0, active: true },

  showFeaturedPicker: false,
  featuredSearch: '',
  allProducts: [],

  init() {
    var storageKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
    var config = JSON.parse(localStorage.getItem(storageKey) || '{}');
    this.dbId = config.pluginContentDbId || config.sheetId || config.dbId || null;
    this.loadAll();
  },

  async loadAll() {
    this.isLoading = true;
    try {
      var res = await ecomApi('getPromotionData', { dbId: this.dbId });
      if (res.status === 'success' && res.data) {
        this.heroSlides = res.data.hero_slides || [];
        this.promoBanners = res.data.promo_banners || [];
        this.discountSettings = res.data.discount_settings || { percentage: 0, code: '', minPurchase: 0, active: false };
        this.freeShipping = res.data.free_shipping || { minAmount: 0, label: 'Free Shipping', active: false };
        this.featuredProducts = res.data.featured_products || [];
        this.specialProduct = res.data.special_product || { name: '', price: 0, originalPrice: 0, imageUrl: '', link: '', badge: '', active: false };
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load promotions', 'error');
    }
    this.isLoading = false;
  },

  addHeroSlide() {
    this.heroEditingIndex = null;
    this.heroForm = { title: '', subtitle: '', imageUrl: '', buttonText: '', buttonLink: '', sortOrder: this.heroSlides.length, active: true };
    this.showHeroModal = true;
  },

  editHeroSlide(index) {
    this.heroEditingIndex = index;
    this.heroForm = Object.assign({}, this.heroSlides[index]);
    this.showHeroModal = true;
  },

  async saveHeroModal() {
    if (!this.heroForm.title) { if (window.showToast) window.showToast('Title is required', 'error'); return; }
    if (!this.heroForm.imageUrl) { if (window.showToast) window.showToast('Image URL is required', 'error'); return; }
    if (this.heroEditingIndex !== null) {
      this.heroSlides[this.heroEditingIndex] = Object.assign({}, this.heroForm);
    } else {
      this.heroSlides.push(Object.assign({}, this.heroForm));
    }
    this.showHeroModal = false;
    await this.saveSection('hero_slides', this.heroSlides);
  },

  async deleteHeroSlide(index) {
    this.heroSlides.splice(index, 1);
    await this.saveSection('hero_slides', this.heroSlides);
  },

  addBanner() {
    this.bannerEditingIndex = null;
    this.bannerForm = { title: '', imageUrl: '', link: '', sortOrder: this.promoBanners.length, active: true };
    this.showBannerModal = true;
  },

  editBanner(index) {
    this.bannerEditingIndex = index;
    this.bannerForm = Object.assign({}, this.promoBanners[index]);
    this.showBannerModal = true;
  },

  async saveBannerModal() {
    if (!this.bannerForm.title) { if (window.showToast) window.showToast('Title is required', 'error'); return; }
    if (!this.bannerForm.imageUrl) { if (window.showToast) window.showToast('Image URL is required', 'error'); return; }
    if (this.bannerEditingIndex !== null) {
      this.promoBanners[this.bannerEditingIndex] = Object.assign({}, this.bannerForm);
    } else {
      this.promoBanners.push(Object.assign({}, this.bannerForm));
    }
    this.showBannerModal = false;
    await this.saveSection('promo_banners', this.promoBanners);
  },

  async deleteBanner(index) {
    this.promoBanners.splice(index, 1);
    await this.saveSection('promo_banners', this.promoBanners);
  },

  async saveDiscountSettings() {
    this.isSaving = true;
    await this.saveSection('discount_settings', this.discountSettings);
    this.isSaving = false;
  },

  async saveFreeShipping() {
    this.isSaving = true;
    await this.saveSection('free_shipping', this.freeShipping);
    this.isSaving = false;
  },

  async addFeaturedProduct() {
    this.featuredSearch = '';
    this.showFeaturedPicker = true;
    try {
      var res = await ecomApi('getProducts', { dbId: this.dbId });
      this.allProducts = (res.data || []).filter(function (p) { return p.Status === 'Published' || p.Status === 'published' || p.Active; });
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load products', 'error');
    }
  },

  selectFeaturedProduct(product) {
    var exists = this.featuredProducts.some(function (fp) { return fp.sku === product.SKU || fp.id === product.ID; });
    if (exists) {
      if (window.showToast) window.showToast('Product already in featured list', 'error');
      return;
    }
    this.featuredProducts.push({
      id: product.ID,
      sku: product.SKU,
      name: product.Name,
      price: product.Price,
      imageUrl: product.ImageURL,
      link: product.Slug
    });
  },

  removeFeaturedProduct(index) {
    this.featuredProducts.splice(index, 1);
  },

  async saveFeaturedProducts() {
    this.isSaving = true;
    await this.saveSection('featured_products', this.featuredProducts);
    this.isSaving = false;
  },

  async saveSpecialProduct() {
    if (!this.specialProduct.name) { if (window.showToast) window.showToast('Product name is required', 'error'); return; }
    this.isSaving = true;
    await this.saveSection('special_product', this.specialProduct);
    this.isSaving = false;
  },

  async saveSection(key, value) {
    try {
      var cleanValue = JSON.parse(JSON.stringify(value));
      var res = await ecomApi('savePromotionSection', { section: key, value: cleanValue, dbId: this.dbId });
      if (res.status === 'success') {
        if (window.showToast) window.showToast(key.replace(/_/g, ' ') + ' saved', 'success');
      } else {
        if (window.showToast) window.showToast(res.message, 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Failed to save', 'error');
    }
  },

  async publishHomeData() {
    this.isPublishing = true;
    try {
      var promos = {
        hero_slides: this.heroSlides,
        promo_banners: this.promoBanners,
        discount_settings: this.discountSettings,
        free_shipping: this.freeShipping,
        featured_products: this.featuredProducts,
        special_product: this.specialProduct
      };
      var defaults = {
        hero_slides: [],
        promo_banners: [],
        discount_settings: { percentage: 0, code: '', minPurchase: 0, active: false },
        free_shipping: { minAmount: 0, label: 'Free Shipping', active: false },
        featured_products: [],
        special_product: { name: '', price: 0, originalPrice: 0, imageUrl: '', link: '', badge: '', active: false }
      };
      var cleanPromos = {};
      Object.keys(promos).forEach(function (k) {
        var v = promos[k];
        var d = defaults[k];
        if (JSON.stringify(v) !== JSON.stringify(d)) {
          cleanPromos[k] = v;
        }
      });
      var payload = JSON.parse(JSON.stringify({
        dbId: this.dbId,
        promotions: cleanPromos
      }));
      var res = await Promise.race([
        ecomApi('publishHomeData', payload),
        new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Server timeout')); }, 55000); })
      ]);
      if (res.status === 'success') {
        if (window.showToast) window.showToast(res.message, 'success');
      } else {
        if (window.showToast) window.showToast(res.message, 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast(e.message === 'Server timeout' ? 'Server tidak merespon, coba lagi' : 'Failed to publish', 'error');
    }
    this.isPublishing = false;
  },

  get filteredProducts() {
    var self = this;
    if (!this.featuredSearch) return this.allProducts;
    var q = this.featuredSearch.toLowerCase();
    return this.allProducts.filter(function (p) { return (p.Name || '').toLowerCase().indexOf(q) !== -1; });
  }
}));

// ================================================================
// ECOMMERCE AFFILIATE
// ================================================================
Alpine.data('ecommerceAffiliate', () => ({
  activeTab: 'browse', // 'browse' | 'deeplink'
  isLoading: false,
  sites: [], 
  campaigns: [], 
  feedProducts: [],
  selectedSite: '', 
  selectedCampaign: '',
  
  deepLinkInput: '', 
  deepLinkResult: '', 
  deepLinkLoading: false,

  async init() {
    await this.loadSites();
  },

  async loadSites() {
    this.isLoading = true;
    try {
      const res = await ecomApi('getAccesstradeSites');
      if (res.status === 'success' && res.data && res.data.data) {
        this.sites = res.data.data || [];
      } else {
        if (window.showToast) window.showToast('Gagal memuat sites: ' + (res.message||''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.isLoading = false;
  },

  async loadCampaigns() {
    if (!this.selectedSite) {
      this.campaigns = [];
      return;
    }
    this.isLoading = true;
    try {
      const res = await ecomApi('getAccesstradeCampaigns', { siteId: this.selectedSite });
      if (res.status === 'success' && res.data && res.data.data) {
        this.campaigns = res.data.data || [];
      } else {
        if (window.showToast) window.showToast('Gagal memuat campaign: ' + (res.message||''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.isLoading = false;
  },

  async loadFeedProducts() {
    if (!this.selectedCampaign) return;
    this.isLoading = true;
    try {
      const res = await ecomApi('getAccesstradeDatafeeds', { campaignId: this.selectedCampaign });
      if (res.status === 'success' && res.data && res.data.data) {
        this.feedProducts = res.data.data || [];
      } else {
        if (window.showToast) window.showToast('Gagal memuat produk: ' + (res.message||''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.isLoading = false;
  },

  async importProduct(product) {
    if (!confirm('Import produk ' + (product.name||'') + '?')) return;
    this.isLoading = true;
    try {
      const res = await ecomApi('importAccesstradeProduct', { product: product });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Produk berhasil diimport', 'success');
      } else {
        if (window.showToast) window.showToast('Gagal import: ' + (res.message||''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi server', 'error');
    }
    this.isLoading = false;
  },

  async generateDeepLink() {
    if (!this.deepLinkInput || !this.selectedCampaign) {
      if (window.showToast) window.showToast('Masukkan URL dan pilih Campaign', 'error');
      return;
    }
    this.deepLinkLoading = true;
    this.deepLinkResult = '';
    try {
      const res = await ecomApi('createAccesstradeDeepLink', { 
        campaignId: this.selectedCampaign,
        siteId: this.selectedSite,
        url: this.deepLinkInput 
      });
      if (res.status === 'success' && res.data && res.data.data) {
        this.deepLinkResult = res.data.data.shortLink || res.data.data.url || res.data.data.link || '';
        if (this.deepLinkResult && window.showToast) window.showToast('Link berhasil dibuat', 'success');
      } else {
        if (window.showToast) window.showToast('Gagal membuat link: ' + (res.message||''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.deepLinkLoading = false;
  }
}));
