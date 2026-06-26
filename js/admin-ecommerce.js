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
    isLoading: true,
    products: [],
    categories: [],
    editingProduct: {},
    showForm: false,

    init() { this.loadData(); },

    async loadData() {
      this.isLoading = true;
      try {
        const pRes = await ecomApi('getProducts');
        const cRes = await ecomApi('getCategories');
        this.products = pRes.data || [];
        this.categories = cRes.data || [];
      } catch (e) {
        if (window.showToast) window.showToast('Failed to load products', 'error');
      }
      this.isLoading = false;
    },

    openAddForm() {
      this.editingProduct = {
        id: '', name: '', slug: '', category: '', price: 0, compareAtPrice: 0,
        costPrice: 0, stock: 0, weight: 0, weightUnit: 'gram', description: '',
        images: [], variants: [], status: 'draft'
      };
      this.showForm = true;
    },

    openEditForm(product) {
      this.editingProduct = { ...product };
      try { this.editingProduct.images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || []); } catch (e) { this.editingProduct.images = []; }
      try { this.editingProduct.variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : (product.variants || []); } catch (e) { this.editingProduct.variants = []; }
      this.editingProduct.price = Number(product.price || 0);
      this.editingProduct.compareAtPrice = Number(product.compareAtPrice || 0);
      this.editingProduct.costPrice = Number(product.costPrice || 0);
      this.editingProduct.stock = Number(product.stock || 0);
      this.editingProduct.weight = Number(product.weight || 0);
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingProduct = {};
    },

    async saveProduct() {
      try {
        var payload = { ...this.editingProduct };
        payload.images = JSON.stringify(payload.images);
        payload.variants = JSON.stringify(payload.variants);
        const res = await ecomApi('saveProduct', payload);
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Product saved', 'success');
          this.closeForm();
          this.loadData();
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to save product', 'error');
      }
    },

    async deleteProduct(id) {
      if (!confirm('Delete this product?')) return;
      try {
        const res = await ecomApi('deleteProduct', { id: id });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Product deleted', 'success');
          this.loadData();
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to delete product', 'error');
      }
    },

    async publishProduct(id) {
      try {
        const res = await ecomApi('publishProductToBlogger', { productId: id });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Product published to Blogger', 'success');
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to publish product', 'error');
      }
    },

    async republishShop() {
      try {
        const res = await ecomApi('republishShopListing');
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Shop listing republished', 'success');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to republish shop', 'error');
      }
    },

    addImageUrl() {
      if (!this.editingProduct) return;
      const url = prompt('Enter image URL:');
      if (url) this.editingProduct.images.push(url);
    },

    removeImage(index) {
      if (this.editingProduct) this.editingProduct.images.splice(index, 1);
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

    init() {
      if (this.$watch) {
        this.$watch('fileSearchQuery', () => { this.currentPage = 1; });
        this.$watch('selectedAlbumId', () => { this.currentPage = 1; });
      }
      const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
      this.dbId = cache.pluginContentDbId || cache.sheetId || cache.dbId || null;
      this.selectedAlbumId = cache.pageId || '';
      this.fetchAlbums();
      if (this.selectedAlbumId) {
        this.fetchAlbumFiles(this.selectedAlbumId);
      }
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
          const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
          if (cache.pageId && !this.albums.find(a => a.id === cache.pageId)) {
            this.albums.unshift({ id: cache.pageId, name: 'Blogger Database', description: 'Main album from Blogger Page', active: true, parentid: '' });
          }
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
      const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
      const blogId = cache.blogId || '';
      const pageId = cache.pageId;
      if (!blogId || !this.selectedAlbumId) {
        if (window.showToast) window.showToast('Harap isi Blog ID dan Page ID di menu Settings.', 'warning');
        return;
      }
      const template = `<div class="ezy-album-entry" data-album-id="${this.selectedAlbumId}" style="background-color: white; border-radius: 20px; border: 2px solid rgb(226, 232, 240); box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px; font-family: Inter, sans-serif; margin-bottom: 30px; padding: 25px;">\n  <h3 style="border-bottom: 1px solid rgb(241, 245, 249); color: #0f172a; font-size: 18px; margin-top: 0px; padding-bottom: 10px;"><span style="color: #475569; font-size: 13px;">Area Gambar :</span></h3><div style="text-align: center;"><br /></div>\n  \n  <div style="align-items: center; border-top: 1px solid rgb(241, 245, 249); display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px;">\n    <span style="color: #94a3b8; font-size: 11px;">EzyStore Metadata System v2.0</span>\n    <span style="background: rgb(59, 130, 246); border-radius: 4px; color: white; font-size: 10px; font-weight: bold; padding: 2px 8px;">SYNC READY</span>\n  </div>\n</div><br />`;
      try {
        await navigator.clipboard.writeText(template);
        if (window.showToast) window.showToast('Template disalin! Silakan paste di Editor Blogger.', 'success');
      } catch (err) {
        console.error('Gagal menyalin template:', err);
      }
      const url = `https://draft.blogger.com/blog/page/edit/${blogId}/${pageId}`;
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
        const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
        const webUrl = cache.webUrl || '';
        if (!webUrl) { throw new Error('Web URL tidak ditemukan. Harap simpan konfigurasi di menu Settings.'); }
        const res = await ecomApi('syncAlbumMetadataFromBloggerUrl', { dbId: this.dbId, albumId: this.selectedAlbumId, webUrl: webUrl });
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
    window.extractYoutubeId = function(url) {
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
    activeTab: 'general',
    settings: {
      blogId: '', blogUrl: '', webAppUrl: '', pageIdShop: '', pageIdHomeData: '',
      currency: 'IDR', taxRate: '11', midtransClientKey: '', siteKey: ''
    },

    init() {
      this.loadSettings();
    },

    async loadSettings() {
      this.isLoading = true;
      try {
        const res = await ecomApi('getEcommerceSettings');
        if (res.status === 'success' && res.data) {
          this.settings = { ...this.settings, ...res.data };
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
        pageIdHomeData: this.settings.pageIdHomeData,
        currency: this.settings.currency,
        taxRate: this.settings.taxRate,
        midtransClientKey: this.settings.midtransClientKey,
        siteKey: this.settings.siteKey
      };
      try {
        const res = await Promise.race([
          ecomApi('saveEcommerceSettings', { ecommerce: payload }),
          new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Timeout')); }, 25000); })
        ]);
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Settings saved', 'success');
          await this.loadSettings();
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast(e.message === 'Timeout' ? 'Server tidak merespon, coba lagi' : 'Failed to save settings', 'error');
      }
      this.isSaving = false;
    }
  }));
