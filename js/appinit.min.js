/**
 * app-init.js
 * Mixin untuk inisialisasi aplikasi dan pengecekan setup.
 * Digabungkan ke dalam appData()
 */
window.appInitMixin = function () {
    return {
        async fetchJsonp(url, params = {}) {
            const cbName = 'setup_cb_' + Date.now();
            const query = new URLSearchParams(params);
            query.set('callback', cbName);
            const script = document.createElement('script');
            script.src = `${url}${url.includes('?') ? '&' : '?'}${query.toString()}`;
            return new Promise((resolve, reject) => {
                window[cbName] = (res) => {
                    delete window[cbName];
                    script.remove();
                    resolve(res);
                };
                script.onerror = () => {
                    script.remove();
                    reject(new Error('Network Error: Verify WebApp URL is correct and script is deployed as "Anyone".'));
                };
                (document.head || document.documentElement).appendChild(script);
                // Increase timeout to 90s for DB creation
                setTimeout(() => {
                    if (window[cbName]) {
                        delete window[cbName];
                        script.remove();
                        reject(new Error('Connection Timeout: The server took too long to respond.'));
                    }
                }, 90000);
            });
        },

        async checkInitialSetup() {
            // 1. Resolve URL Priority: Blogger Layout > LocalStorage > config.js Gateway
            const hasBloggerUrl = (window.BLOGGER_WEBAPP_URL && window.BLOGGER_WEBAPP_URL.startsWith('http'));
            let webappUrl = hasBloggerUrl ? window.BLOGGER_WEBAPP_URL : getWebAppUrl();

            const GATEWAY_URL = (typeof CONFIG !== 'undefined') ? CONFIG.WEBAPP_URL_DEV : null;

            // Step 1: Discovery hanya jika URL benar-benar kosong DAN tidak ada di Layout Blogger.
            // Jika ada di Layout tapi gagal, kita biarkan sistem melaporkan error dari URL tersebut
            // daripada "melompat" kembali ke Gateway yang bisa membingungkan user.
            if (!hasBloggerUrl && (!webappUrl || !webappUrl.startsWith('http'))) {
                try {
                    console.log('Attempting Auto-Discovery from Gateway:', GATEWAY_URL);
                    const discovery = await this.fetchJsonp(GATEWAY_URL, { action: 'get_admin_url' });
                    if (discovery && discovery.status === 'success' && discovery.adminUrl) {
                        webappUrl = discovery.adminUrl;
                        localStorage.setItem('EzypartsConfig', JSON.stringify({ webappUrl }));
                        if (window.EzypartsConfig) window.EzypartsConfig.webappUrl = webappUrl;

                        // HOTFIX: Update runtime API URL immediately
                        if (window.EzyApi) {
                            window.EzyApi.url = webappUrl;
                            window.appsScriptUrl = webappUrl;
                        }
                        console.log('Auto-discovered Admin URL:', webappUrl);
                    }
                } catch (e) {
                    console.warn('Auto-discovery failed:', e);
                }
            }

            // Step 2: Guard jika URL tetap tidak valid
            if (!webappUrl || !webappUrl.startsWith('http')) {
                console.error('CRITICAL: No valid WebApp URL found.');
                this.dbHealthy = false;
                this.dbStatusChecked = true;
                return;
            }

            // Step 3: Ping ke Admin WebApp
            try {
                // console.log('Pinging server at:', webappUrl);
                const data = await this.fetchJsonp(webappUrl, {
                    action: 'get_config',
                    userWebAppUrl: webappUrl, // Laporkan URL terbaru dari widget Blogger
                    gatewayUrl: GATEWAY_URL,  // Pastikan Admin tahu Gateway-nya (dari config.js)
                    email: this.currentUser?.email, // Sertakan konteks user jika ada
                    siteKey: localStorage.getItem('EzypartsConfig') ? JSON.parse(localStorage.getItem('EzypartsConfig')).siteKey : ''
                });
                // console.log('CLIENT RECEIVED CONFIG:', data);

                // Step 4: Validasi respons
                if ((data.statusNote === 'new_fallback' && !data.dbId) || data.statusNote === 'setup_in_progress') {
                    console.warn('Gateway fallback or setup in progress, skipping forced redirect.');
                    this.dbHealthy = true; // Anggap sehat sementara, tunggu Admin URL valid
                } else {
                    this.dbHealthy = data.isSetup === true;
                }

                // Step 5: Simpan konfigurasi jika setup selesai
                if (this.dbHealthy) {
                    const finalUrl = (data.adminUrl && data.adminUrl.startsWith('http')) ? data.adminUrl : webappUrl;
                    localStorage.setItem('EzypartsConfig', JSON.stringify({
                        webappUrl: finalUrl,
                        email: data.email || '',
                        role: 'Admin',
                        dbName: data.dbName || '',
                        sheetId: data.dbId || '',
                        siteKey: data.siteKey || '',
                        pluginContentDbId: data.pluginContentDbId || '',
                        blogId: data.blogId || '',
                        pageId: data.pageId || ''
                    }));
                    console.log('Browser synchronized with server configuration.');
                } else {
                    console.warn('Server reports setup incomplete.');
                }
            } catch (error) {
                console.error('Error fetching setup status:', error);
                this.dbHealthy = false;
            } finally {
                this.dbStatusChecked = true;
            }
        }
    };
};
