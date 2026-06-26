(function () {
    const registerSettings = () => {
        Alpine.data('settingsPage', () => ({
            isLoading: false,
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

                // Load live sensitive settings from server cache
                const configCache = localStorage.getItem('EzyCoreConfig_Cache');
                if (configCache) {
                    const config = JSON.parse(configCache);
                    if (config.gatewayToken) {
                        this.settings.gatewayToken = config.gatewayToken;
                    }
                    if (config.siteKey) {
                        this.settings.siteKey = config.siteKey;
                    }
                    if (config.adminUrl || config.webappUrl) {
                        this.settings.adminUrl = config.adminUrl || config.webappUrl;
                    }
                    if (config.dbName) {
                        this.settings.dbName = config.dbName;
                    }
                    if (config.blogId) {
                        this.settings.blogId = config.blogId;
                    }
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
                window.sendDataToGoogle('get_settings', {}, (res) => {
                    if (res && res.status === 'success') {
                        if (res.blogId) this.settings.blogId = res.blogId;
                        if (res.siteKey) this.settings.siteKey = res.siteKey;
                        if (res.adminUrl) this.settings.adminUrl = res.adminUrl;
                        if (res.dbName) this.settings.dbName = res.dbName;
                    }
                }, () => {});
            },

            saveSettings(btn) {
                if (btn && window.setButtonLoading) window.setButtonLoading(btn, true);

                // Simulate API delay for better UX
                setTimeout(() => {
                    localStorage.setItem('userSettings', JSON.stringify(this.settings));

                    if (window.sendDataToGoogle) {
                        // Simpan General & Security Settings ke backend (PropertiesService)
                        const blogId = this.settings.blogId || (window.EzyApi && window.EzyApi.config && window.EzyApi.config.blogId) || '';
                        const settingsPayload = {
                            blogId: blogId,
                            gatewayToken: this.settings.gatewayToken,
                            dbName: this.settings.dbName
                        };

                        window.sendDataToGoogle('save_settings', settingsPayload, (res) => {
                            if (res && res.status === 'success') {
                                window.showToast('Semua pengaturan berhasil disinkronkan ke Cloud!', 'success');

                                // Update runtime config & cache untuk konsistensi langsung tanpa reload
                                if (window.EzyApi && window.EzyApi.config) {
                                    window.EzyApi.config.blogId = blogId;
                                    window.EzyApi.config.pageId = this.settings.pageId;
                                    window.EzyApi.config.pageIdJsonLd = this.settings.pageIdJsonLd;
                                    window.EzyApi.config.webUrl = this.settings.webUrl;
                                    window.EzyApi.config.gatewayToken = this.settings.gatewayToken;
                                    window.EzyApi.config.dbName = this.settings.dbName;
                                    window.EzyApi.config.adminUrl = this.settings.adminUrl;
                                    window.EzyApi.config.siteKey = this.settings.siteKey;
                                }

                                // Update Local Cache untuk konsistensi antar halaman
                                const currentCache = JSON.parse(localStorage.getItem('EzyCoreConfig_Cache') || '{}');
                                localStorage.setItem('EzyCoreConfig_Cache', JSON.stringify({ ...currentCache, blogId: blogId, ...settingsPayload }));

                                if (btn && window.setButtonSuccess) window.setButtonSuccess(btn, { closeModal: false });
                            } else {
                                window.showToast('Gagal sinkronisasi: ' + (res?.message || 'Server Error'), 'error');
                                if (btn && window.setButtonLoading) window.setButtonLoading(btn, false);
                            }
                        });
                    } else {
                        window.showToast('Mode Offline: Tersimpan di browser saja.', 'warning');
                        if (btn && window.setButtonSuccess) window.setButtonSuccess(btn, { closeModal: false });
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