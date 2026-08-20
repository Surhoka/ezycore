(function () {
    const registerSettings = () => {
        Alpine.data('settingsPage', () => ({
            isLoading: false,
            isSaving: false,
            activeTab: 'general',
            showToken: false,
            settings: {
                language: 'en',
                notifications: {
                    orders: true,
                    stock: true,
                    marketing: false
                },
                gatewayToken: '',
                siteKey: '',
                adminUrl: '',
                dbName: '',
                blogId: ''
            },

            init() {
                this.loadSettings();

                // Jika discovery sudah selesai, ambil config langsung
                if (window.EzyApi && window.EzyApi.isReady) {
                    this.applyServerConfig(window.EzyApi.config || {});
                }

                // Jika discovery menyusul, update saat event tiba
                window.addEventListener('ezy-api-ready', (event) => {
                    const config = event.detail?.config || {};
                    this.applyServerConfig(config);
                });
            },

            applyServerConfig(config) {
                if (config.blogId) this.settings.blogId = config.blogId;
                if (config.siteKey) this.settings.siteKey = config.siteKey;
                if (config.adminUrl || config.webappUrl) this.settings.adminUrl = config.adminUrl || config.webappUrl;
                if (config.dbName) this.settings.dbName = config.dbName;
                if (config.gatewayToken) this.settings.gatewayToken = config.gatewayToken;
            },

            loadSettings() {
                // Load from localStorage or use defaults
                const saved = localStorage.getItem('userSettings');
                if (saved) {
                    try {
                        this.settings = { ...this.settings, ...JSON.parse(saved) };
                    } catch (e) { console.error('Error parsing settings', e); }
                }

                // Load live settings from backend (async — akan update saat response tiba)
                this.loadLiveSettings();

                // Load live sensitive settings from server cache (EzyCoreConfig_Cache)
                const configCache = localStorage.getItem('EzyCoreConfig_Cache');
                if (configCache) {
                    try {
                        const config = JSON.parse(configCache);
                        if (config.gatewayToken) this.settings.gatewayToken = config.gatewayToken;
                        if (config.siteKey) this.settings.siteKey = config.siteKey;
                        if (config.adminUrl || config.webappUrl) this.settings.adminUrl = config.adminUrl || config.webappUrl;
                        if (config.dbName) this.settings.dbName = config.dbName;
                        if (config.blogId) this.settings.blogId = config.blogId;
                    } catch (e) { console.error('Error parsing EzyCoreConfig_Cache', e); }
                }

                // Load dari EzycoreConfig_<blogId> (discovery appinit — lebih lengkap)
                const blogConfigKey = 'EzycoreConfig_' + (window.EZY_BLOG_ID || '');
                const blogConfigCache = localStorage.getItem(blogConfigKey);
                if (blogConfigCache) {
                    try {
                        const config = JSON.parse(blogConfigCache);
                        if (config.siteKey && !this.settings.siteKey) this.settings.siteKey = config.siteKey;
                        if (config.dbName && !this.settings.dbName) this.settings.dbName = config.dbName;
                        if (config.webappUrl && !this.settings.adminUrl) this.settings.adminUrl = config.webappUrl;
                        if (config.blogId && !this.settings.blogId) this.settings.blogId = config.blogId;
                    } catch (e) { console.error('Error parsing blogConfigCache', e); }
                }

                // Fallback synchronous dari EzyApi.config dan EZY_BLOG_ID template
                if (window.EzyApi && window.EzyApi.config) {
                    if (!this.settings.blogId) {
                        if (window.EzyApi.config.blogId) {
                            this.settings.blogId = window.EzyApi.config.blogId;
                        } else if (window.EZY_BLOG_ID) {
                            this.settings.blogId = window.EZY_BLOG_ID;
                        }
                    }
                    if (!this.settings.siteKey && window.EzyApi.config.siteKey) this.settings.siteKey = window.EzyApi.config.siteKey;
                    if (!this.settings.adminUrl) this.settings.adminUrl = window.EzyApi.config.adminUrl || window.EzyApi.config.webappUrl || window.EzyApi.url || '';
                    if (!this.settings.dbName && window.EzyApi.config.dbName) this.settings.dbName = window.EzyApi.config.dbName;
                    if (!this.settings.gatewayToken && window.EzyApi.config.gatewayToken) this.settings.gatewayToken = window.EzyApi.config.gatewayToken;
                }

            },

            loadLiveSettings() {
                if (!window.sendDataToGoogle) return;
                window.sendDataToGoogle('get_settings', { blogId: window.EZY_BLOG_ID || '' }, (res) => {
                    if (res && res.status === 'success') {
                        this.applyServerConfig(res);
                    }
                }, () => {});
            },

            saveSettings() {
                this.isSaving = true;

                setTimeout(() => {
                    localStorage.setItem('userSettings', JSON.stringify(this.settings));

                    if (window.sendDataToGoogle) {
                        const blogId = this.settings.blogId || (window.EzyApi && window.EzyApi.config && window.EzyApi.config.blogId) || '';
                        const settingsPayload = {
                            blogId: blogId,
                            gatewayToken: this.settings.gatewayToken,
                            dbName: this.settings.dbName
                        };

                        window.sendDataToGoogle('save_settings', settingsPayload, (res) => {
                            this.isSaving = false;
                            if (res && res.status === 'success') {
                                window.showToast('Semua pengaturan berhasil disinkronkan ke Cloud!', 'success');

                                if (window.EzyApi && window.EzyApi.config) {
                                    window.EzyApi.config.blogId = blogId;
                                    window.EzyApi.config.gatewayToken = this.settings.gatewayToken;
                                    window.EzyApi.config.dbName = this.settings.dbName;
                                    window.EzyApi.config.adminUrl = this.settings.adminUrl;
                                    window.EzyApi.config.siteKey = this.settings.siteKey;
                                }

                                const currentCache = JSON.parse(localStorage.getItem('EzyCoreConfig_Cache') || '{}');
                                localStorage.setItem('EzyCoreConfig_Cache', JSON.stringify({ ...currentCache, blogId: blogId, ...settingsPayload }));
                            } else {
                                window.showToast('Gagal sinkronisasi: ' + (res?.message || 'Server Error'), 'error');
                            }
                        });
                    } else {
                        this.isSaving = false;
                        window.showToast('Mode Offline: Tersimpan di browser saja.', 'warning');
                    }
                }, 600);
            },

        }));
    };

    if (window.Alpine) {
        registerSettings();
    } else {
        document.addEventListener('alpine:init', registerSettings);
    }
})();
console.log("settings.js loaded");