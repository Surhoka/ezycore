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
    isLoading: true,
    albums: [],
    currentAlbum: null,
    images: [],
    editingAlbum: {},
    showForm: false,
    showImageForm: false,
    editingImage: {},

    init() { this.loadAlbums(); },

    async loadAlbums() {
      this.isLoading = true;
      try {
        const res = await ecomApi('getAlbums');
        this.albums = res.data || [];
      } catch (e) {
        if (window.showToast) window.showToast('Failed to load albums', 'error');
      }
      this.isLoading = false;
    },

    async selectAlbum(album) {
      this.currentAlbum = album;
      try {
        const res = await ecomApi('getAlbumImages', { albumId: album.id });
        this.images = res.data || [];
      } catch (e) {
        this.images = [];
      }
    },

    backToAlbums() {
      this.currentAlbum = {};
      this.images = [];
    },

    openAddAlbum() {
      this.editingAlbum = { id: '', name: '', slug: '', description: '', parentId: '', active: true, sortOrder: 0 };
      this.showForm = true;
    },

    openEditAlbum(album) {
      this.editingAlbum = { ...album };
      this.editingAlbum.active = album.active === 'TRUE' || album.active === true;
      this.showForm = true;
    },

    closeForm() {
      this.showForm = false;
      this.editingAlbum = {};
    },

    async saveAlbum() {
      try {
        const res = await ecomApi('saveAlbum', { ...this.editingAlbum });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Album saved', 'success');
          this.closeForm();
          this.loadAlbums();
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to save album', 'error');
      }
    },

    async deleteAlbum(id) {
      if (!confirm('Delete this album and all its images?')) return;
      try {
        const res = await ecomApi('deleteAlbum', { id: id });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Album deleted', 'success');
          if (this.currentAlbum && this.currentAlbum.id === id) this.backToAlbums();
          this.loadAlbums();
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to delete album', 'error');
      }
    },

    openAddImage() {
      this.editingImage = { albumId: this.currentAlbum.id, fileName: '', fileUrl: '', contentType: 'image', thumbnailUrl: '' };
      this.showImageForm = true;
    },

    closeImageForm() {
      this.showImageForm = false;
      this.editingImage = {};
    },

    async saveImage() {
      try {
        const res = await ecomApi('saveAlbumImage', { ...this.editingImage });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Image saved', 'success');
          this.closeImageForm();
          this.selectAlbum(this.currentAlbum);
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to save image', 'error');
      }
    },

    async deleteImage(id) {
      if (!confirm('Remove this image?')) return;
      try {
        const res = await ecomApi('deleteAlbumImage', { id: id });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Image removed', 'success');
          this.selectAlbum(this.currentAlbum);
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to delete image', 'error');
      }
    },

    async syncMetadata() {
      if (!this.currentAlbum) return;
      try {
        const res = await ecomApi('syncAlbumMetadata', { albumId: this.currentAlbum.id });
        if (res.status === 'success') {
          if (window.showToast) window.showToast(res.message, 'success');
          this.selectAlbum(this.currentAlbum);
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to sync album metadata', 'error');
      }
    }
  }));

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
    settings: {
      blogId: '', blogUrl: '', webAppUrl: '', pageIdShop: '', pageIdHomeData: '',
      currency: 'IDR', taxRate: '11', midtransClientKey: ''
    },
    midtransServerKey: '',

    init() { this.loadSettings(); },

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
      try {
        const res = await ecomApi('saveEcommerceSettings', { ecommerce: this.settings });
        if (res.status === 'success') {
          if (window.showToast) window.showToast('Settings saved', 'success');
        } else {
          if (window.showToast) window.showToast(res.message, 'error');
        }
      } catch (e) {
        if (window.showToast) window.showToast('Failed to save settings', 'error');
      }
    }
  }));
