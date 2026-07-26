// ================================================================
// AFFILIATE PLUGIN — Client-side JavaScript
// Standalone multi-platform affiliate: Accesstrade + Shopee (stub)
// ================================================================

// Helper: Promise-based sendDataToGoogle untuk affiliate
function affiliateApi(action, data) {
  return new Promise(function (resolve, reject) {
    if (typeof window.sendDataToGoogle !== 'function') {
      reject(new Error('sendDataToGoogle is not available'));
      return;
    }
    window.sendDataToGoogle(action, data || {}, resolve, reject);
  });
}

// Parse Accesstrade API response array from various envelope formats
function parseAtList_(resData) {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;
  if (typeof resData === 'object') {
    if (resData.data && Array.isArray(resData.data)) return resData.data;
    if (resData.items && Array.isArray(resData.items)) return resData.items;
    if (resData.results && Array.isArray(resData.results)) return resData.results;
  }
  return [];
}

// ================================================================
// AFFILIATE MAIN — Browse Products + DeepLink Generator
// ================================================================
Alpine.data('affiliateMain', () => ({
  activeTab: 'browse', // 'browse' | 'deeplink'
  isLoading: false,

  sites: [],
  campaigns: [],
  feedProducts: [],
  dataSource: '',
  dataSourceLabel: '',
  sourceAttempts: [],
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
    this.sites = [];
    try {
      const res = await affiliateApi('getAccesstradeSites');
      console.log('[Affiliate] loadSites response:', JSON.stringify(res).substring(0, 500));
      if (res.status === 'success') {
        this.sites = parseAtList_(res.data);
        console.log('[Affiliate] Parsed sites count: ' + this.sites.length);
        if (this.sites.length === 0) {
          if (window.showToast) window.showToast('Tidak ada site terdaftar. Daftarkan site di dashboard Accesstrade.', 'warning');
        }
      } else {
        var errMsg = res.message || 'Unknown error';
        console.error('[Affiliate] loadSites failed:', errMsg);
        if (window.showToast) window.showToast('Gagal memuat sites: ' + errMsg, 'error');
      }
    } catch (e) {
      console.error('[Affiliate] loadSites exception:', e.message);
      if (window.showToast) window.showToast('Error: ' + e.message, 'error');
    }
    this.isLoading = false;
  },

  async loadCampaigns() {
    if (!this.selectedSite) {
      this.campaigns = [];
      return;
    }
    this.isLoading = true;
    this.feedProducts = [];
    this.dataSource = '';
    this.dataSourceLabel = '';
    this.sourceAttempts = [];
    try {
      const res = await affiliateApi('getAccesstradeCampaigns', { siteId: this.selectedSite });
      if (res.status === 'success') {
        this.campaigns = parseAtList_(res.data);
        if (this.campaigns.length === 0) {
          if (window.showToast) window.showToast('Tidak ada campaign aktif untuk site ini.', 'warning');
        }
      } else {
        if (window.showToast) window.showToast('Gagal memuat campaign: ' + (res.message || ''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.isLoading = false;
  },

  async loadFeedProducts() {
    if (!this.selectedCampaign) return;
    this.isLoading = true;
    this.feedProducts = [];
    this.dataSource = '';
    this.dataSourceLabel = '';
    this.sourceAttempts = [];

    try {
      // Cascading fallback: datafeeds → offers → quicklink
      const res = await affiliateApi('getAccesstradeProductsWithFallback', {
        campaignId: this.selectedCampaign,
        siteId: this.selectedSite
      });

      if (res.status === 'success') {
        this.feedProducts = res.data || [];
        this.dataSource = res.source || 'none';
        this.dataSourceLabel = res.sourceLabel || '';
        this.sourceAttempts = res.attempts || [];

        console.log('[Affiliate] loadFeedProducts source:', this.dataSource, 'count:', this.feedProducts.length);

        if (res.message && this.feedProducts.length === 0) {
          if (window.showToast) window.showToast(res.message, 'warning');
        }
      } else {
        if (window.showToast) window.showToast('Gagal memuat data: ' + (res.message || ''), 'error');
      }
    } catch (e) {
      console.error('[Affiliate] loadFeedProducts error:', e);
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.isLoading = false;
  },

  async importProduct(product) {
    if (!confirm('Import produk ' + (product.name || '') + '?')) return;
    this.isLoading = true;
    try {
      const res = await affiliateApi('importAccesstradeProduct', { product: product });
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Produk berhasil diimport', 'success');
      } else {
        if (window.showToast) window.showToast('Gagal import: ' + (res.message || ''), 'error');
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
      const res = await affiliateApi('createAccesstradeDeepLink', {
        campaignId: this.selectedCampaign,
        siteId: this.selectedSite,
        url: this.deepLinkInput
      });
      if (res.status === 'success' && res.data && res.data.data) {
        this.deepLinkResult = res.data.data.shortLink || res.data.data.url || res.data.data.link || '';
        if (this.deepLinkResult && window.showToast) window.showToast('Link berhasil dibuat', 'success');
      } else {
        if (window.showToast) window.showToast('Gagal membuat link: ' + (res.message || ''), 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi API Accesstrade', 'error');
    }
    this.deepLinkLoading = false;
  },

  getSourceBadgeClass() {
    switch (this.dataSource) {
      case 'datafeeds': return 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
      case 'offers': return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
      case 'quicklink': return 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    }
  },

  getSourceIcon() {
    switch (this.dataSource) {
      case 'datafeeds': return 'package';
      case 'offers': return 'tag';
      case 'quicklink': return 'link';
      default: return 'alert-circle';
    }
  }
}));

// ================================================================
// AFFILIATE SETTINGS — Accesstrade + Shopee Credentials
// ================================================================
Alpine.data('affiliateSettings', () => ({
  activeTab: 'accesstrade',
  isLoading: true,
  isSaving: false,
  isTestingAt: false,
  isTestingShopee: false,
  isGeneratingAuth: false,
  showPassword: false,
  showShopeeSecret: false,
  accesstradePass: '',
  settings: {
    accesstradeApiKey: '',
    accesstradeSiteId: '',
    accesstradeEmail: '',
    accesstradeCountryCode: 'ID',
    accesstradeApiUrl: '',
    shopeeAppId: '',
    shopeeAppSecret: '',
    shopeeAccessToken: '',
    shopeeSubId: '',
    shopeeApiUrl: ''
  },

  init() {
    this.loadSettings();
  },

  async loadSettings() {
    this.isLoading = true;
    try {
      const res = await affiliateApi('getAffiliateSettings');
      if (res.status === 'success' && res.data) {
        this.settings = { ...this.settings, ...res.data };
      }
    } catch (e) {
      if (window.showToast) window.showToast('Gagal memuat pengaturan affiliate', 'error');
    }
    this.isLoading = false;
  },

  async saveSettings() {
    this.isSaving = true;
    try {
      const res = await affiliateApi('saveAffiliateSettings', this.settings);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Pengaturan affiliate tersimpan', 'success');
      } else {
        if (window.showToast) window.showToast(res.message || 'Gagal menyimpan', 'error');
      }
    } catch (e) {
      if (window.showToast) window.showToast('Error koneksi server', 'error');
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
        await new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      var email = this.settings.accesstradeEmail.trim();
      var passwordMd5 = CryptoJS.MD5(this.accesstradePass).toString();
      var stringToHash = email + ':' + passwordMd5;
      var finalHash = CryptoJS.SHA256(stringToHash).toString();

      console.log('[Affiliate Gen] email:', email);
      console.log('[Affiliate Gen] MD5(password):', passwordMd5);
      console.log('[Affiliate Gen] SHA256:', finalHash);

      this.settings.accesstradeApiKey = finalHash;
      if (window.showToast) window.showToast('Header berhasil di-generate! (SHA256: ' + finalHash.substring(0, 8) + '...) Silakan Save.', 'success');
    } catch (e) {
      console.error('[Affiliate Gen] Error:', e);
      if (window.showToast) window.showToast('Gagal memuat crypto-js', 'error');
    }
    this.isGeneratingAuth = false;
  },

  async testAtProvisioning() {
    this.isTestingAt = true;
    try {
      const res = await affiliateApi('testAccesstradeConnection', {
        apiKey: this.settings.accesstradeApiKey,
        email: this.settings.accesstradeEmail,
        countryCode: this.settings.accesstradeCountryCode
      });
      console.log('[Affiliate Test] Result:', res);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Connection OK! Sites: ' + JSON.stringify(res.data).substring(0, 100), 'success');
      } else {
        if (window.showToast) window.showToast(res.message || 'Test failed', 'error');
      }
    } catch (e) {
      console.error('[Affiliate Test] Error:', e);
      if (window.showToast) window.showToast('Test error: ' + e.message, 'error');
    }
    this.isTestingAt = false;
  },

  async testShopeeConnection() {
    if (!this.settings.shopeeAppId || !this.settings.shopeeAppSecret) {
      if (window.showToast) window.showToast('Mohon isi App ID dan App Secret!', 'error');
      return;
    }
    this.isTestingShopee = true;
    try {
      const res = await affiliateApi('testShopeeConnection', {
        appId: this.settings.shopeeAppId,
        appSecret: this.settings.shopeeAppSecret,
        accessToken: this.settings.shopeeAccessToken,
        apiUrl: this.settings.shopeeApiUrl
      });
      console.log('[Affiliate Shopee] Test result:', res);
      if (res.status === 'success') {
        if (window.showToast) window.showToast('Shopee Connection OK!', 'success');
      } else {
        if (window.showToast) window.showToast(res.message || 'Test failed', 'error');
      }
    } catch (e) {
      console.error('[Affiliate Shopee] Test error:', e);
      if (window.showToast) window.showToast('Test error: ' + e.message, 'error');
    }
    this.isTestingShopee = false;
  }
}));
