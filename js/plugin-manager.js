/**
 * Plugin Manager Page Logic
 */

(function () {
    // Ensure Toast is always above Modals
    if (!document.getElementById('ezy-toast-zindex-fix')) {
        const style = document.createElement('style');
        style.id = 'ezy-toast-zindex-fix';
        style.textContent = `
            #toast-container, .toast-container, [id^="toast-"] { z-index: 1000 !important; }
        `;
        document.head.appendChild(style);
    }

    window.initPluginManagerPage = function () {
        console.log("Plugin Manager Page Initialized");

        // Initialize Alpine component if not already done by fetchPage
        // (In our SPA, fetchPage usually calls this after setting pageContent)
        setupPluginManagerComponent();
    };

    function setupPluginManagerComponent() {
        // We add the component data to the specific element if needed, 
        // but usually in this SPA, it's already bound via x-data in the HTML
        // and we just need to provide the global function.
    }

    // Define the registration function
    const registerPluginManager = () => {
        if (window.Alpine) {
            window.Alpine.data('pluginManager', () => ({
                plugins: [],
                modalOpen: false,
                editMode: false,
                submitting: false,
                availablePlugins: [],
                draggingId: null,
                dragOverId: null,
                formData: {
                    showInMenu: false, menuLabel: '', menuIcon: 'zap', menuGroup: 'TOOLS', template: '', scripts: '',
                    children: null
                },

                async init() {
                    console.log("Plugin Manager Component Init");
                    await this.fetchAvailablePlugins();
                    await this.fetchPlugins();
                },

async fetchAvailablePlugins() {
                     // Wait for API to be ready
                     if (!window.EzyApi || !window.EzyApi.isReady) {
                         await new Promise(resolve => {
                             window.addEventListener('ezy-api-ready', resolve, { once: true });
                         });
                     }
                      if (!this.apiUrl) {
                          console.warn("API URL not found - cannot load available plugins. Check Apps Script deployment URL.");
                          this.availablePlugins = [];
                          return;
                      }
                    try {
                        const res = await window.app.fetchJsonp(this.apiUrl, { action: 'get_available_plugins' });
                        if (res && res.status === 'success') {
                            this.availablePlugins = res.plugins || [];
                            console.log(`Loaded ${this.availablePlugins.length} available plugins`);
                        } else {
                            console.warn("Failed to load available plugins:", res?.message);
                            this.availablePlugins = [];
                        }
                    } catch (e) {
                        console.error("Fetch available plugins error:", e);
                        this.availablePlugins = [];
                    }
                },

                onPluginSelect() {
                    const template = this.availablePlugins.find(p => p.name === this.formData.name);
                    if (template) {
                        this.formData.id = template.id;
                        this.formData.description = template.description;
                        this.formData.url = template.url || '';
                        this.formData.actions = template.actions || '';
                        this.formData.template = template.template || '';
                        this.formData.menuLabel = template.menuLabel || template.name;
                        this.formData.menuIcon = template.menuIcon || 'zap';
                        this.formData.menuGroup = template.menuGroup || 'TOOLS';
                        this.formData.showInMenu = template.showInMenu !== false;
                        this.formData.scripts = template.scripts || '';
                        this.formData.children = template.children || null;
                        this.formData.databaseSchema = template.databaseSchema || null;
                        this.formData.databaseName = template.databaseName || '';
                    }
                },

 get apiUrl() {
                    const candidates = [
                      window.appsScriptUrl,
                      window.EzyApi?.url,
                      window.app?.appsScriptUrl
                    ];
                    return candidates.find(u => u && typeof u === 'string' && u.length > 10) || '';
                },

                async fetchPlugins() {
                     if (!window.EzyApi || !window.EzyApi.isReady) {
                         await new Promise(resolve => {
                             window.addEventListener('ezy-api-ready', resolve, { once: true });
                         });
                     }
                     const url = this.apiUrl;
                     if (!url) {
                         console.warn("[PluginManager] apiUrl empty — cannot load plugins.");
                         this.plugins = [];
                         return;
                     }
                     console.log("[PluginManager] Fetching installed plugins from:", url);
                    try {
                        const res = await window.app.fetchJsonp(url, { action: 'get_all_plugins' });
                        if (res && res.status === 'success') {
                            this.plugins = (res.plugins || []).map(p => ({
                                ...p,
                                pinging: false,
                                pingResult: null
                            }));
                            console.log(`[PluginManager] Loaded ${this.plugins.length} installed plugins`);
                        } else {
                            console.warn("[PluginManager] get_all_plugins failed:", res);
                            this.plugins = [];
                        }
                    } catch (e) {
                        console.error("[PluginManager] get_all_plugins error:", e);
                        this.plugins = [];
                    }
                    this.restorePluginOrder();
                },

                // --- DRAG & DROP ---

                startDrag(event, pluginId) {
                    this.draggingId = pluginId;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', pluginId);
                },

                dropPlugin(event, targetId) {
                    event.preventDefault();
                    const fromId = this.draggingId || event.dataTransfer.getData('text/plain');
                    this.draggingId = null;
                    this.dragOverId = null;

                    if (!fromId || fromId === targetId) return;

                    const fromIndex = this.plugins.findIndex(p => p.id === fromId);
                    const toIndex = this.plugins.findIndex(p => p.id === targetId);

                    if (fromIndex === -1 || toIndex === -1) return;

                    // Reorder array
                    const moved = this.plugins.splice(fromIndex, 1)[0];
                    this.plugins.splice(toIndex, 0, moved);

                    // Persist order
                    this.savePluginOrder();
                    window.dispatchEvent(new CustomEvent('ezy:menu-update'));
                    window.showToast && window.showToast('Plugin order updated', 'success');
                },

                savePluginOrder() {
                    const order = this.plugins.map(p => p.id);
                    localStorage.setItem('plugin_manager_order', JSON.stringify(order));

                    // Save Menu Label Order for Sidebar Sorting
                    const menuOrder = this.plugins.map(p => p.menuLabel || p.name);
                    localStorage.setItem('plugin_menu_order', JSON.stringify(menuOrder));
                },

                restorePluginOrder() {
                    try {
                        const saved = localStorage.getItem('plugin_manager_order');
                        if (!saved) return;
                        const order = JSON.parse(saved);

                        const sorted = [];
                        order.forEach(id => {
                            const p = this.plugins.find(x => x.id === id);
                            if (p) sorted.push(p);
                        });
                        // Append any new plugins not in saved order
                        this.plugins.forEach(p => {
                            if (!sorted.find(s => s.id === p.id)) sorted.push(p);
                        });
                        this.plugins = sorted;
                    } catch (e) {
                        console.warn('Failed to restore plugin order:', e);
                    }
                },

                openAddModal() {
                    this.editMode = false;
                    this.formData = {
                        id: '', name: '', url: '', actions: '', description: '', active: true,
                        showInMenu: false, menuLabel: '', menuIcon: 'zap', menuGroup: 'TOOLS', template: '',
                        children: null
                    };
                    this.modalOpen = true;
                },

                editPlugin(plugin) {
                    this.editMode = true;
                    // Deep clone or ensure publicConfig exists
                    this.formData = JSON.parse(JSON.stringify(plugin));
                    this.modalOpen = true;
                },

                closeModal() {
                    this.modalOpen = false;
                },

                async savePlugin() {
                    this.submitting = true;
                    try {
                        const res = await window.app.fetchJsonp(this.apiUrl, {
                            action: 'save_plugin',
                            data: JSON.stringify(this.formData)
                        });
                        this.submitting = false;
                        if (res.status === 'success') {
                            window.showToast(res.message, "success");

                            const savedPlugin = res.plugin || this.formData;
                            this.closeModal();
                            await this.fetchPlugins();

// [CERDAS] Cek apakah plugin ini sebenarnya sudah punya DB di cache sistem (Discovery)
                             const config = JSON.parse(localStorage.getItem('EzycoreConfig') || '{}');
                             const cachedDbId = config[`PLUGIN_DB_${savedPlugin.id}`];

                             // Sinkronkan ID dari backend (mungkin sudah dihapus jika file fisik hilang)
                             if (!savedPlugin.databaseId && (this.formData.databaseId || cachedDbId)) {
                                 console.log(`[PluginManager] Backend reports missing DB for ${savedPlugin.id}. Syncing UI...`);
                                 this.formData.databaseId = null;
                                 if (config[`PLUGIN_DB_${savedPlugin.id}`]) delete config[`PLUGIN_DB_${savedPlugin.id}`];
                                 localStorage.setItem('EzycoreConfig', JSON.stringify(config));
                             }

                            // Jalankan inisialisasi jika tidak ada databaseId (baik baru maupun karena self-healing)
                            if (savedPlugin.actions.includes('setupPluginDatabase')) {
                                if (savedPlugin.databaseId) {
                                    console.log(`[PluginManager] DB verified for ${savedPlugin.id}, skipping provision.`);
                                    if (!cachedDbId) {
                                        window.showToast && window.showToast(`Database lama ditemukan di Meta dan dihubungkan otomatis!`, "info");
                                    }
                                } else {
                                    await this.provisionPluginDatabase(savedPlugin);
                                }
                            }

                            // Sync Sidebar Menu
                            window.dispatchEvent(new CustomEvent('ezy:menu-update'));
                        } else {
                            window.showToast(res.message, "error");
                        }
                    } catch (e) {
                        this.submitting = false;
                        window.showToast("Error saving plugin", "error");
                    }
                },

                async provisionPluginDatabase(plugin) {
                    // Guard: Jika plugin objek sudah memiliki databaseId, jangan teruskan ke backend
                    if (plugin.databaseId) {
                        console.log(`[PluginManager] Database untuk ${plugin.name} sudah terdaftar: ${plugin.databaseId}`);
                        return;
                    }

                    window.showToast(`Memulai inisialisasi database untuk ${plugin.name}...`, 'info');
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('setupPluginDatabase', { fileName: `DB_${plugin.name}`, pluginId: plugin.id }, resolve, reject);
                        });
                        if (res.status === 'success') {
                            // [REVISI] Simpan ID dan Nama Database ke Properti Plugin secara mandiri
                            plugin.databaseId = res.dbId;
                            plugin.databaseName = res.dbName || `DB_${plugin.name}`;
                            await new Promise((resolve) => {
                                window.sendDataToGoogle('save_plugin', { data: plugin }, resolve);
                            });

                            window.showToast(`Database ${plugin.name} berhasil diinisialisasi!`, 'success');

                            // [REVISI] Sinkronisasi Cache Config tanpa reload halaman
                            const config = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                            config[`PLUGIN_DB_${plugin.id}`] = res.dbId;
                            localStorage.setItem('EzypartsConfig', JSON.stringify(config));

                            // Perbarui daftar plugin di UI secara reaktif
                            await this.fetchPlugins();
                        } else {
                            window.showToast(res.message || 'Gagal inisialisasi', 'error');
                        }
                    } catch (e) {
                        window.showToast('Gagal memicu setup plugin', 'error');
                    }
                },

                async togglePlugin(plugin) {
                    try {
                        const res = await window.app.fetchJsonp(this.apiUrl, {
                            action: 'save_plugin',
                            data: JSON.stringify(plugin)
                        });
                        if (res.status === 'success') {
                            window.showToast(`Plugin ${plugin.active ? 'enabled' : 'disabled'}`);
                            // Sync Sidebar Menu
                            window.dispatchEvent(new CustomEvent('ezy:menu-update'));
                        }
                    } catch (e) {
                        window.showToast("Failed to toggle plugin", "error");
                    }
                },

                async deletePlugin(id) {
                    if (!confirm('Are you sure you want to remove this plugin?')) return;
                    try {
                        const res = await window.app.fetchJsonp(this.apiUrl, {
                            action: 'remove_plugin',
                            id: id
                        });
                        if (res.status === 'success') {
                            window.showToast('Plugin removed', "success");
                            await this.fetchPlugins();
                            // Sync Sidebar Menu
                            window.dispatchEvent(new CustomEvent('ezy:menu-update'));
                        }
                    } catch (e) {
                        window.showToast("Failed to remove plugin", "error");
                    }
                },

                async pingPlugin(plugin) {
                    if (!plugin.url) {
                        window.showToast("Cannot ping: plugin URL is missing", "warning");
                        return;
                    }
                    plugin.pinging = true;
                    try {
                        const res = await window.app.fetchJsonp(this.apiUrl, {
                            action: 'ping_plugin',
                            url: plugin.url
                        });
                        plugin.pinging = false;
                        plugin.pingResult = res;
                        if (res.status === 'success') {
                            window.showToast(`Ping successful: ${res.latency}`, "success");
                        } else {
                            window.showToast('Ping failed: ' + res.message, 'error');
                        }
                    } catch (e) {
                        plugin.pinging = false;
                        window.showToast("Ping connection error", "error");
                    }
                },

                async refreshStats() {
                    console.log('Refreshing stats...');
                    try {
                        await this.fetchPlugins();
                        window.showToast('Stats refreshed successfully', 'success');
                    } catch (e) {
                        console.error('Error refreshing stats:', e);
                        window.showToast('Failed to refresh stats', 'error');
                    }
                },

                // Computed properties for stats
                get totalPlugins() {
                    return this.plugins.length;
                },

                get activePlugins() {
                    return this.plugins.filter(p => p.active).length;
                },

                get registryStatus() {
                    return this.apiUrl ? 'Cloud Synced' : 'Disconnected';
                },

                get registryHealthy() {
                    return !!this.apiUrl;
                }
            }));
        }
    };

    // Immediate registration or wait for Alpine
    if (window.Alpine) {
        registerPluginManager();
    } else {
        document.addEventListener('alpine:init', registerPluginManager);
    }
})();
