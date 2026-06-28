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
  isLoading: true,
  stats: { totalProducts: 0, totalOrders: 0, totalRevenue: 0, totalCustomers: 0 },
  recentOrders: [],

  init() { this.loadDashboard(); },

  async loadDashboard() {
    this.isLoading = true;
    try {
      const products = await ecomApi('getProducts');
      const orders = await ecomApi('getOrders');
      const customers = await ecomApi('getCustomers');
      this.stats.totalProducts = (products.data || []).length;
      this.stats.totalOrders = (orders.data || []).length;
      this.stats.totalCustomers = (customers.data || []).length;

      const paid = (orders.data || []).filter(o => o.paymentstatus === 'paid');
      this.stats.totalRevenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);

      this.recentOrders = (orders.data || []).slice(0, 5);
    } catch (e) {
      if (window.showToast) window.showToast('Failed to load dashboard: ' + e.message, 'error');
    }
    this.isLoading = false;
  }
}));

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
    try { item.images = typeof item.images === 'string' ? JSON.parse(item.images) : (item.images || []); } catch(e) { item.images = []; }
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
        payload.slug = (payload.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      }
      payload.status = payload.active ? 'published' : 'draft';
      var res = await ecomApi('saveProduct', payload);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Produk berhasil disimpan', 'success');
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
    var activeCount = this.products.filter(function(p) { return p.status === 'published' || p.status === 'active'; }).length;
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

  copyImageUrl(url) {
    if (!navigator.clipboard) { if (window.showToast) window.showToast('Clipboard tidak tersedia', 'error'); return; }
    navigator.clipboard.writeText(url).then(function() {
      if (window.showToast) window.showToast('URL disalin', 'success');
    }).catch(function() {
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
    if (!dateStr) return '—';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch(e) { return '—'; }
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
          thumbnailUrl: file.thumbnailurl || ''
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
    var template = '<div class="ezy-album-entry" data-album-id="' + this.selectedAlbumId + '" style="background-color: white; border-radius: 20px; border: 2px solid rgb(226, 232, 240); box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px; font-family: Inter, sans-serif; margin-bottom: 30px; padding: 25px;">\n  <h3 style="border-bottom: 1px solid rgb(241, 245, 249); color: #0f172a; font-size: 18px; margin-top: 0px; padding-bottom: 10px;"><span style="color: #475569; font-size: 13px;">Area Gambar :</span></h3><div style="text-align: center;"><br /></div>\n  \n  <div style="align-items: center; border-top: 1px solid rgb(241, 245, 249); display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px;">\n    <span style="color: #94a3b8; font-size: 11px;">EzyStore Metadata System v2.0</span>\n    <span style="background: rgb(59, 130, 246); border-radius: 4px; color: white; font-size: 10px; font-weight: bold; padding: 2px 8px;">SYNC READY</span>\n  </div>\n</div><br />';

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
        thumbnailUrl: thumbUrl, contentType: 'youtube', mimeType: 'video/youtube', size: 0
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
        thumbnailUrl: '', contentType: 'drive', mimeType: 'video/mp4', size: 0
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
  activeTab: 'general',
  settings: {
    blogId: '', blogUrl: '', webAppUrl: '', pageIdShop: '', pageIdAlbum: '', pageIdHomeData: '',
    currency: 'IDR', taxRate: '11', midtransClientKey: '', siteKey: ''
  },
  homeData: {
    companyName: '', supportPhone: '', supportEmail: '', storeAddress: '',
    operatingHours: '', operatingDays: '',
    socialFacebook: '', socialTwitter: '', socialInstagram: '', socialLinkedin: ''
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
      siteKey: this.settings.siteKey
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
    config.blogId = blogId;
    config.blogUrl = this.settings.blogUrl;
    config.webUrl = this.settings.blogUrl;
    config.siteKey = this.settings.siteKey;
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
