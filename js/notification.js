/**
 * Notification Page Logic - Wrapped in IIFE to prevent Identifier Re-declaration Errors
 */
(function () {
  if (window.notificationScriptLoaded) return; // Guard Clause

  const registerNotificationPage = () => {
    if (window.Alpine && !window.Alpine.data('notificationPage')) {
      window.Alpine.data('notificationPage', () => ({
        notifications: [],
        isLoading: true,
        notificationError: '',
        params: {},

        async init() {
          console.log("Notification Page Initialized with Alpine Component.");
          this.params = window.app?.params || {};
          await this.loadDependenciesAndFetch();
        },

        broadcastUpdate() {
          // Hitung jumlah yang belum dibaca (isread: false/0/null)
          const unreadCount = this.notifications.filter(n => !n.isread || n.isread === 'false' || n.isread === 0).length;
          // Kirim event global agar didengar oleh komponen Navigasi/Header
          window.dispatchEvent(new CustomEvent('ezy:notifications-updated', {
            detail: { count: unreadCount, notifications: this.notifications }
          }));
        },

        async loadScript(url) {
          return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
          });
        },

        async loadDependenciesAndFetch() {
          try {
            await this.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
            await this.fetchNotifications();
          } catch (error) {
            console.error("Error loading dependencies:", error);
            this.notificationError = "Gagal memuat komponen notifikasi.";
            this.isLoading = false;
          }
        },

        async fetchNotifications() {
          this.isLoading = true;
          const user = JSON.parse(localStorage.getItem('signedInUser'));
          const userEmail = user ? user.email : null;
          const today = new Date().toISOString().split('T')[0];
          const cachedData = JSON.parse(localStorage.getItem('notificationsCache') || '{}');

          if (cachedData.date === today && Array.isArray(cachedData.notifications)) {
            this.notifications = this.processMarkdown(cachedData.notifications);
            this.broadcastUpdate();
          }

          window.sendDataToGoogle('getExistingNotifications', { email: userEmail }, (data) => {
            if (data.status === "success" && Array.isArray(data.data)) {
              this.notifications = this.processMarkdown(data.data);
              const cacheData = { date: today, notifications: data.data };
              localStorage.setItem('notificationsCache', JSON.stringify(cacheData));
              this.broadcastUpdate();
            } else {
              this.notificationError = data.message || "Tidak ada notifikasi tersedia.";
            }
            this.isLoading = false;
          }, (error) => {
            console.error("Error fetching notifications:", error);
            this.notificationError = "Gagal memuat notifikasi.";
            this.isLoading = false;
          });
        },

        processMarkdown(notifications) {
          if (typeof window.marked !== 'function') return notifications;
          return notifications.map(notif => {
            if (notif.message) {
              if (typeof notif.message !== 'string') {
                notif.message = String(notif.message);
              }
              notif.message = window.marked.parse(notif.message);
            }
            return notif;
          });
        },

        async deleteNotification(id) {
          if (!confirm('Are you sure you want to delete this notification?')) return;

          // --- OPTIMISTIC UI: Hapus lokal dulu ---
          const originalNotifications = [...this.notifications]; // Backup
          const indexToDelete = this.notifications.findIndex(n => (n.id || n.createdAt) === id);
          let deletedNotification = null;

          if (indexToDelete !== -1) {
            deletedNotification = this.notifications.splice(indexToDelete, 1)[0];
            window.showToast('Notification deleted!', 'info');
          }

          window.sendDataToGoogle('deleteNotification', { id: id }, (res) => {
            if (res.status === 'success') {
              // UI sudah terupdate secara optimis, tidak perlu fetch ulang
              window.showToast('Notification deleted!', 'success');
              this.broadcastUpdate();
            } else {
              window.showToast(`Error: ${res.message}`, 'error');
              // --- ROLLBACK JIKA GAGAL ---
              if (deletedNotification) {
                this.notifications.splice(indexToDelete, 0, deletedNotification); // Reinsert
                window.showToast('Failed to delete notification, rolling back.', 'error');
                this.broadcastUpdate();
              }
            }
          }, (err) => {
            window.showToast('API Error while deleting notification.', 'error');
            // Rollback sederhana
            if (deletedNotification) {
              this.notifications.splice(indexToDelete, 0, deletedNotification); // Reinsert
              window.showToast('Failed to delete notification, rolling back.', 'error');
              this.broadcastUpdate();
            }
          });
        }
      }));
    }
  };

  // Immediate registration or wait for Alpine
  if (window.Alpine) {
    registerNotificationPage();
  } else {
    document.addEventListener('alpine:init', registerNotificationPage);
  }

  window.notificationScriptLoaded = true; // Set flag
})();
