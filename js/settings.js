(function () {
    const registerSettings = () => {
        Alpine.data('settingsPage', () => ({
            isLoading: false,
            activeTab: 'general',
            showToken: false,
            settings: {
                theme: 'light',
                language: 'en',
                notifications: {
                    orders: true,
                    stock: true,
                    marketing: false
                },
                publicTheme: 'blue',
                templateName: 'public-1',
                customColor: '#3b82f6',
                headerColor: '#ffffff',
                sidebarColor: '#ffffff',
                footerColor: '#1e3a8a',
                gatewayToken: '',
                siteKey: '',
                adminUrl: '',
                dbName: ''
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

                // Sync theme state with global app state
                const isDark = document.documentElement.classList.contains('dark');
                if (!saved) {
                    this.settings.theme = isDark ? 'dark' : 'light';
                }

                // [NEW] Load live sensitive settings from server cache
                const configCache = localStorage.getItem('Ezyparts_Config_Cache');
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
                }

            },

            applyDefaultTheme() {
                this.settings.publicTheme = 'blue';
                this.settings.customColor = '#3b82f6';
                this.settings.headerColor = '#ffffff';
                this.settings.footerColor = '#1e3a8a';

                // Adjust sidebar color based on layout to ensure text contrast
                if (this.settings.templateName === 'public-2') {
                    this.settings.sidebarColor = '#ffffff'; // Modern: White Sidebar
                } else {
                    this.settings.sidebarColor = '#1e3a8a'; // Standard: Dark Nav Bar
                }
            },

            saveSettings(btn) {
                if (btn && window.setButtonLoading) window.setButtonLoading(btn, true);

                // Simulate API delay for better UX
                setTimeout(() => {
                    localStorage.setItem('userSettings', JSON.stringify(this.settings));

                    // Apply Theme Immediately
                    if (this.settings.theme === 'dark' || (this.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                        if (window.app) window.app.darkMode = true;
                        document.documentElement.classList.add('dark');
                    } else {
                        if (window.app) window.app.darkMode = false;
                        document.documentElement.classList.remove('dark');
                    }

                    // [NEW] Save Theme Settings to Cloud (for Public Template Live Update)
                    if (window.sendDataToGoogle) {
                        const themePayload = {
                            publicTheme: this.settings.publicTheme,
                            customColor: this.settings.customColor,
                            templateName: this.settings.templateName,
                            headerColor: this.settings.headerColor,
                            sidebarColor: this.settings.sidebarColor,
                            footerColor: this.settings.footerColor
                        };

                        // 1. Simpan Theme Settings
                        window.sendDataToGoogle('saveThemeSettings', themePayload);

                        // 2. Simpan General & Security Settings ke backend (PropertiesService)
                        const settingsPayload = {
                            gatewayToken: this.settings.gatewayToken,
                            dbName: this.settings.dbName
                        };

                        window.sendDataToGoogle('save_settings', settingsPayload, (res) => {
                            if (res && res.status === 'success') {
                                window.showToast('Semua pengaturan berhasil disinkronkan ke Cloud!', 'success');

                                // Update runtime config & cache untuk konsistensi langsung tanpa reload
                                if (window.EzyApi && window.EzyApi.config) {
                                    window.EzyApi.config.blogId = this.settings.blogId;
                                    window.EzyApi.config.pageId = this.settings.pageId;
                                    window.EzyApi.config.pageIdJsonLd = this.settings.pageIdJsonLd;
                                    window.EzyApi.config.webUrl = this.settings.webUrl;
                                    window.EzyApi.config.gatewayToken = this.settings.gatewayToken;
                                    window.EzyApi.config.dbName = this.settings.dbName;
                                    window.EzyApi.config.adminUrl = this.settings.adminUrl;
                                    window.EzyApi.config.siteKey = this.settings.siteKey;
                                }

                                // Update Local Cache untuk konsistensi antar halaman
                                const currentCache = JSON.parse(localStorage.getItem('Ezyparts_Config_Cache') || '{}');
                                localStorage.setItem('Ezyparts_Config_Cache', JSON.stringify({ ...currentCache, ...settingsPayload }));

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

            downloadPublicTemplate(raw = false) {
                try {
                    const config = JSON.parse(localStorage.getItem('Ezyparts_Config_Cache') || '{}');

                    // Determine Gateway URL
                    // Prioritize CONFIG.WEBAPP_URL_DEV (Gateway) over EzyApi.gatewayUrl (which might be Project URL)
                    let gatewayUrl = (typeof CONFIG !== 'undefined' && CONFIG.WEBAPP_URL_DEV)
                        ? CONFIG.WEBAPP_URL_DEV
                        : window.EzyApi?.gatewayUrl;

                    if (!gatewayUrl) {
                        window.showToast('Gateway URL not found.', 'error');
                        return;
                    }

                    // [FIX] Gunakan data dari state Alpine (this.settings) agar sinkron dengan yang tampil di UI
                    const adminUrl = this.settings.adminUrl || config.adminUrl || config.webappUrl || window.EzyApi?.url;
                    const siteKey = this.settings.siteKey || config.siteKey;
                    const dbName = this.settings.dbName || config.dbName || 'Database';

                    if (!adminUrl || !siteKey) {
                        window.showToast('Configuration incomplete (Missing Site Key or URL).', 'error');
                        return;
                    }

                    const params = new URLSearchParams({
                        action: 'download_public_template',
                        adminUrl: adminUrl,
                        siteKey: siteKey,
                        dbName: dbName,
                        theme: this.settings.publicTheme === 'custom' ? this.settings.customColor : (this.settings.publicTheme || 'blue'),
                        templateName: this.settings.templateName || 'public-1',
                        headerColor: this.settings.headerColor,
                        sidebarColor: this.settings.sidebarColor,
                        footerColor: this.settings.footerColor,
                        mode: raw ? 'raw' : 'injected'
                    });
                    window.open(`${gatewayUrl}${gatewayUrl.includes('?') ? '&' : '?'}${params.toString()}`, '_blank');
                } catch (e) {
                    console.error('Download error:', e);
                    window.showToast('Failed to prepare download.', 'error');
                }
            }
        }));
    };

    if (window.Alpine) {
        registerSettings();
    } else {
        document.addEventListener('alpine:init', registerSettings);
    }
})();
console.log("settings.js loaded");