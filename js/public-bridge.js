/**
 * EZYCORE PUBLIC BRIDGE - v1.1.0
 */
(function () {
    window.EzyApi = {
        url: '',
        role: 'Public',
        isReady: false
    };

    function initPublicDiscovery() {
        const bin = document.getElementById('ezy-jsonld-bin');
        let siteKey = localStorage.getItem('Ezyparts_SiteKey');
        let webAppUrl = window.appsScriptUrl || '';

        if (bin && bin.textContent.trim()) {
            try {
                const metadata = JSON.parse(atob(bin.textContent.trim()));
                if (metadata.siteKey) siteKey = metadata.siteKey;
                if (metadata.webAppUrl) webAppUrl = metadata.webAppUrl;

                localStorage.setItem('Ezyparts_SiteKey', siteKey);
                console.log('[Bridge] Discovery Success:', siteKey);
            } catch (e) {
                console.warn('[Bridge] Metadata extraction failed from Bin');
            }
        }

        window.appsScriptUrl = webAppUrl;
        window.EzyApi.url = webAppUrl;
        window.EzyApi.isReady = !!webAppUrl;

        window.dispatchEvent(new CustomEvent('ezy-api-ready', { detail: window.EzyApi }));
    }

    window.sendDataToGoogle = function (action, data, callback, errorHandler) {
        if (!window.EzyApi.isReady) {
            setTimeout(() => window.sendDataToGoogle(action, data, callback, errorHandler), 300);
            return;
        }

        const postActions = ['placeOrder', 'askAi', 'submitContact'];

        const payload = {
            action,
            siteKey: localStorage.getItem('Ezyparts_SiteKey'),
            ...data
        };

        if (postActions.includes(action)) {
            fetch(window.EzyApi.url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(callback)
                .catch(err => errorHandler?.(err));
        } else {
            const cbName = 'ezy_pub_cb_' + Date.now();
            window[cbName] = (res) => { delete window[cbName]; callback?.(res); };
            const query = new URLSearchParams({ ...payload, callback: cbName }).toString();
            const script = document.createElement('script');
            script.src = `${window.EzyApi.url}${window.EzyApi.url.includes('?') ? '&' : '?'}${query}`;
            document.head.appendChild(script);
        }
    };

    window.AdminAPI = {
        checkConnection: async () => {
            return new Promise(resolve => {
                window.sendDataToGoogle('ping', {},
                    (res) => resolve({ connected: res.status === 'success', error: null }),
                    (err) => resolve({ connected: false, error: err.message }));
            });
        }
    };

    initPublicDiscovery();
})();
