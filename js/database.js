
/**
 * database.js
 */

window.database = function () {
    return {
        // State
        isLoading: true,
        error: null,
        hierarchy: [], // List of { name, type, url, children: [] }
        expandedNodes: {}, // ID atau tipe yang otomatis terbuka (menggunakan objek untuk reaktivitas)

        // Init
        init() {
            this.isLoading = true;
            this.refreshStructure();
        },

        refreshStructure() {
            this.isLoading = true;
            this.error = null;

            window.sendDataToGoogle('get_db_hierarchy', {}, (response) => {
                this.isLoading = false;
                if (response.data) {
                    this.hierarchy = response.data;
                    // Auto expand root
                    if (this.hierarchy.length > 0) {
                        this.expandedNodes[this.hierarchy[0].id] = true;
                    }
                } else {
                    this.hierarchy = [];
                }
            }, (err) => {
                this.isLoading = false;
                this.error = err.message || "Failed to fetch database structure.";
            });
        },

        toggleNode(id) {
            this.expandedNodes = { ...this.expandedNodes, [id]: !this.expandedNodes[id] };
        },

        openInDrive(url) {
            if (url) {
                window.open(url, '_blank');
            } else {
                if (window.showAlert) window.showAlert('error', 'URL tidak tersedia untuk item ini.');
                else alert('URL tidak tersedia untuk item ini.');
            }
        },

        openRootInDrive() {
            const root = (this.hierarchy && this.hierarchy.length > 0) ? this.hierarchy[0] : null;
            if (root) {
                const targetUrl = root.url || ("https://drive.google.com/drive/folders/" + root.id);
                window.open(targetUrl, '_blank');
            } else {
                window.open('https://drive.google.com/drive/my-drive', '_blank');
            }
        }
    }
}
