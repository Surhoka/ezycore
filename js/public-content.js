/**
 * js/public-content.js
 * Unified frontend logic for Public Content Manager & Landing Page Admin.
 * Combines Hero Slides, Categories, Featured Products, Landing Config, and Sales Page logic.
 */
(function () {
    // Ensure Toast is always above Modals
    if (!document.getElementById('ezy-toast-zindex-fix')) {
        const style = document.createElement('style');
        style.id = 'ezy-toast-zindex-fix';
        style.textContent = `
            #toast-container, .toast-container, [id^="toast-"] { z-index: 100 !important; }
        `;
        document.head.appendChild(style);
    }

    // Shared Toast Utility
    function showToast(msg, type = 'success') {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            // Retry once if window.showToast is not yet available
            setTimeout(() => {
                if (typeof window.showToast === 'function') {
                    window.showToast(msg, type);
                }
            }, 500);
        }
    }

    // Shared DB ID Utility
    function getDbId() {
        try {
            const config = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
            // Cek apakah ada override database khusus plugin di cache
            return config.pluginContentDbId || config.sheetId || config.dbId || null;
        } catch (e) {
            console.error('Failed to parse EzypartsConfig:', e);
            return null;
        }
    }

    // Shared Blog ID Utility
    function getBlogId() {
        try {
            const config = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
            const blogId = config.blogId;
            // Pastikan tidak mengirim string "null" ke backend
            if (blogId === null || blogId === 'null' || blogId === undefined || blogId === '') {
                return '';
            }
            return String(blogId);
        } catch (e) {
            return '';
        }
    }

    // ================================================================
    // HERO SLIDES MANAGER (from home-admin.js)
    // ================================================================
    const registerHeroManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('heroManager')) {
            window.Alpine.data('heroManager', () => ({
                dbId: null,
                slides: [],
                isLoading: false,
                isSyncing: false,
                showModal: false,
                isEditing: false,
                editingItem: {},

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await this.fetchSlides();
                },

                async fetchSlides() {
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getHeroSlides', { dbId: this.dbId }, resolve, reject);
                        });
                        this.slides = res.status === 'success' ? (res.data || []) : [];
                        if (res.status !== 'success') showToast(res.message || 'Gagal memuat data', 'error');
                    } catch (e) {
                        console.error('fetchSlides:', e);
                        showToast('Gagal memuat hero slides', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                openAddModal() {
                    this.isEditing = false;
                    this.editingItem = { title: '', subtitle: '', imageurl: '', buttontext: '', buttonlink: '', active: true, sortorder: 0 };
                    this.showModal = true;
                },

                editSlide(item) {
                    this.isEditing = true;
                    this.editingItem = { ...item };
                    this.showModal = true;
                },

                async saveSlide() {
                    if (!this.editingItem.title) { showToast('Judul slide harus diisi', 'warning'); return; }
                    const btn = document.getElementById('save-hero-btn');
                    window.setButtonLoading?.(btn, true);
                    try {
                        const payload = {
                            ...this.editingItem,
                            dbId: this.dbId,
                            blogId: getBlogId()
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('saveHeroSlide', payload, resolve, reject);
                        });
                        if (res.status === 'success') {
                            showToast('Slide berhasil disimpan');
                            this.showModal = false;
                            await this.fetchSlides();
                        } else {
                            showToast(res.message || 'Gagal menyimpan', 'error');
                        }
                    } catch (e) {
                        showToast('Terjadi kesalahan: ' + e, 'error');
                    } finally {
                        window.setButtonLoading?.(btn, false);
                    }
                },

                async deleteSlide(id) {
                    if (!confirm('Hapus slide ini?')) return;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            const payload = {
                                id,
                                dbId: this.dbId,
                                blogId: getBlogId()
                            };
                            window.sendDataToGoogle('deleteHeroSlide', payload, resolve, reject);
                        });
                        if (res.status === 'success') { showToast('Slide dihapus'); await this.fetchSlides(); }
                        else showToast(res.message || 'Gagal menghapus', 'error');
                    } catch (e) {
                        showToast('Gagal menghapus: ' + e, 'error');
                    }
                },

                async syncToBlogger() {
                    this.isSyncing = true;
                    showToast('Menyinkronkan data beranda...', 'info');
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncHomeFullToBlogger', { dbId: this.dbId, blogId: getBlogId() }, resolve, reject);
                        });
                        if (res.status === 'success') showToast(res.message);
                        else showToast(res.message, 'error');
                    } catch (e) {
                        showToast('Gagal sinkron: ' + e, 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                }
            }));
        }
    };

    // ================================================================
    // CATEGORIES MANAGER (from home-admin.js)
    // ================================================================
    const registerCategoryManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('categoryManager')) {
            window.Alpine.data('categoryManager', () => ({
                dbId: null,
                categories: [],
                isLoading: false,
                isSyncing: false,
                showModal: false,
                isEditing: false,
                editingItem: {},

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await this.fetchCategories();
                },

                async fetchCategories() {
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getCategories', { dbId: this.dbId }, resolve, reject);
                        });
                        this.categories = res.status === 'success' ? (res.data || []) : [];
                        if (res.status !== 'success') showToast(res.message || 'Gagal memuat data', 'error');
                    } catch (e) {
                        console.error('fetchCategories:', e);
                        showToast('Gagal memuat kategori', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                openAddModal() {
                    this.isEditing = false;
                    this.editingItem = { name: '', slug: '', description: '', imageurl: '', parentid: '', active: true, sortorder: 0 };
                    this.showModal = true;
                },

                editCategory(item) {
                    this.isEditing = true;
                    this.editingItem = { ...item };
                    this.showModal = true;
                },

                async saveCategory() {
                    if (!this.editingItem.name) { showToast('Nama kategori harus diisi', 'warning'); return; }
                    const btn = document.getElementById('save-category-btn');
                    window.setButtonLoading?.(btn, true);
                    try {
                        const payload = {
                            ...this.editingItem,
                            dbId: this.dbId,
                            blogId: getBlogId()
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('saveCategory', payload, resolve, reject);
                        });
                        if (res.status === 'success') {
                            showToast('Kategori berhasil disimpan');
                            this.showModal = false;
                            await this.fetchCategories();
                        } else {
                            showToast(res.message || 'Gagal menyimpan', 'error');
                        }
                    } catch (e) {
                        showToast('Terjadi kesalahan: ' + e, 'error');
                    } finally {
                        window.setButtonLoading?.(btn, false);
                    }
                },

                async deleteCategory(id) {
                    if (!confirm('Hapus kategori ini?')) return;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            const payload = {
                                id,
                                dbId: this.dbId,
                                blogId: getBlogId()
                            };
                            window.sendDataToGoogle('deleteCategory', payload, resolve, reject);
                        });
                        if (res.status === 'success') { showToast('Kategori dihapus'); await this.fetchCategories(); }
                        else showToast(res.message || 'Gagal menghapus', 'error');
                    } catch (e) {
                        showToast('Gagal menghapus: ' + e, 'error');
                    }
                },

                async syncToBlogger() {
                    this.isSyncing = true;
                    showToast('Menyinkronkan kategori...', 'info');
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncHomeFullToBlogger', { dbId: this.dbId, blogId: getBlogId() }, resolve, reject);
                        });
                        if (res.status === 'success') showToast(res.message);
                        else showToast(res.message, 'error');
                    } catch (e) {
                        showToast('Gagal sinkron: ' + e, 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                }
            }));
        }
    };

    // ================================================================
    // FEATURED PRODUCTS MANAGER (from home-admin.js)
    // ================================================================
    const registerFeaturedProductManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('featuredProductManager')) {
            window.Alpine.data('featuredProductManager', () => ({
                dbId: null,
                products: [],
                categories: [],
                isLoading: false,
                isSyncing: false,
                showModal: false,
                isEditing: false,
                editingItem: {},

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await Promise.all([
                        this.fetchProducts(),
                        this.fetchCategories()
                    ]);
                },

                async fetchProducts() {
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getFeaturedProducts', { dbId: this.dbId }, resolve, reject);
                        });
                        this.products = res.status === 'success' ? (res.data || []) : [];
                        if (res.status !== 'success') showToast(res.message || 'Gagal memuat data', 'error');
                    } catch (e) {
                        console.error('fetchProducts:', e);
                        showToast('Gagal memuat produk', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                async fetchCategories() {
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getCategories', { dbId: this.dbId }, resolve, reject);
                        });
                        if (res.status === 'success') {
                            this.categories = res.data || [];
                        }
                    } catch (e) {
                        console.error('fetchCategories in product manager:', e);
                    }
                },

                async syncAllToBlogger() {
                    const activeCount = this.products.filter(p => p.active === true || p.active === 'TRUE').length;
                    if (activeCount === 0) {
                        showToast('Tidak ada produk aktif yang perlu disinkronkan.', 'warning');
                        return;
                    }

                    if (!confirm(`Apakah Anda yakin ingin menyinkronkan ${activeCount} produk ke Blogger?`)) {
                        return;
                    }

                    this.isSyncing = true;
                    showToast('Sedang menyinkronkan seluruh produk...', 'info');

                    try {
                        const payload = {
                            dbId: this.dbId,
                            blogId: getBlogId()
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncAllProductsToBlogger', payload, resolve, reject);
                        });

                        if (res.status === 'success') {
                            showToast(res.message, 'success');
                        } else {
                            showToast(res.message || 'Gagal melakukan sinkronisasi massal', 'error');
                        }
                    } catch (e) {
                        console.error('syncAllProductsToBlogger error:', e);
                        showToast('Terjadi kesalahan koneksi saat sinkronisasi.', 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                },

                openAddModal() {
                    this.isEditing = false;
                    this.editingItem = { name: '', description: '', imageurl: '', price: 0, originalprice: 0, category: '', badge: '', link: '', active: true, sortorder: 0 };
                    this.showModal = true;
                },

                editProduct(item) {
                    this.isEditing = true;
                    this.editingItem = { ...item };
                    this.showModal = true;
                },

                async saveProduct() {
                    if (!this.editingItem.name) { showToast('Nama produk harus diisi', 'warning'); return; }
                    const btn = document.getElementById('save-product-btn');
                    window.setButtonLoading?.(btn, true);
                    try {
                        const payload = {
                            ...this.editingItem,
                            dbId: this.dbId,
                            blogId: getBlogId()
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('saveFeaturedProduct', payload, resolve, reject);
                        });
                        if (res.status === 'success') {
                            showToast('Produk berhasil disimpan');
                            this.showModal = false;
                            await this.fetchProducts();
                        } else {
                            showToast(res.message || 'Gagal menyimpan', 'error');
                        }
                    } catch (e) {
                        showToast('Terjadi kesalahan: ' + e, 'error');
                    } finally {
                        window.setButtonLoading?.(btn, false);
                    }
                },

                async deleteProduct(id) {
                    if (!confirm('Hapus produk ini?')) return;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('deleteFeaturedProduct', { id, dbId: this.dbId }, resolve, reject);
                        });
                        if (res.status === 'success') { showToast('Produk dihapus'); await this.fetchProducts(); }
                        else showToast(res.message || 'Gagal menghapus', 'error');
                    } catch (e) {
                        showToast('Gagal menghapus: ' + e, 'error');
                    }
                },

                formatPrice(price) {
                    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price || 0);
                }
            }));
        }
    };

    // ================================================================
    // YOUTUBE HELPERS (shared utility)
    // ================================================================
    function extractYoutubeId(url) {
        if (!url) return null;
        const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = String(url).match(regex);
        return match ? match[1] : null;
    }

    function isYoutubeUrl(url) {
        return !!extractYoutubeId(url);
    }

    window.slugify_ = function (text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    };

    const registerAlbumManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('albumManager')) {
            window.Alpine.data('albumManager', () => ({
                dbId: null,
                albums: [],
                albumFiles: [],
                fileSearchQuery: '',
                selectedAlbumId: '',
                isLoading: false,
                expandedIds: [], // Menyimpan ID album yang sedang dibuka (expanded)
                isSyncing: false,
                showAlbumModal: false,
                showYoutubeModal: false,
                isEditing: false,
                editingAlbum: {},
                youtubeInput: { url: '', title: '', isSaving: false },
                currentPage: 1,
                itemsPerPage: 10,

                get paginatedAlbumFiles() {
                    const start = (this.currentPage - 1) * this.itemsPerPage;
                    const end = start + this.itemsPerPage;
                    return this.filteredAlbumFiles.slice(start, end);
                },

                get totalPages() {
                    return Math.max(1, Math.ceil(this.filteredAlbumFiles.length / this.itemsPerPage));
                },

                async provisionDatabase() {
                    if (!confirm('Buat Spreadsheet terpisah untuk Public Content? Seluruh data Hero, Kategori, dan Album akan dipindahkan ke file baru.')) return;
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            // [REVISI] Gunakan pluginId agar diintersep oleh Bridge (Admin-Code.gs)
                            // dan diproses menggunakan skema tabel yang dideklarasikan di Gateway.
                            window.sendDataToGoogle('setupPluginDatabase', {
                                pluginId: 'plug_public_content_v1'
                            }, resolve, reject);
                        });

                        if (res && res.status === 'success') {
                            showToast('Database mandiri berhasil dibuat!', 'success');

                            // Sinkronisasi ke Cache Lokal agar getDbId() langsung mendeteksi ID baru
                            const config = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                            config.pluginContentDbId = res.dbId;
                            localStorage.setItem('EzypartsConfig', JSON.stringify(config));

                            // [REVISI] Update data plugin di Script Properties (LOCAL_PLUGINS)
                            // Ini memastikan performa discovery tetap cepat tanpa harus membuka Spreadsheet
                            window.sendDataToGoogle('get_all_plugins', {}, (allPlugins) => {
                                if (allPlugins.status === 'success') {
                                    const pc = allPlugins.plugins.find(p => p.id === 'plug_public_content_v1');
                                    if (pc) {
                                        pc.databaseId = res.dbId;
                                        pc.databaseName = res.dbName;
                                        window.sendDataToGoogle('save_plugin', { data: pc });
                                    }
                                }
                            });

                            showToast('Memuat ulang sistem...', 'info');
                            setTimeout(() => location.reload(), 1500);
                        } else {
                            showToast(res?.message || 'Gagal inisialisasi database', 'error');
                        }
                    } catch (e) {
                        showToast('Gagal memicu setup database plugin', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                async init() {
                    if (this.$watch) {
                        this.$watch('fileSearchQuery', () => { this.currentPage = 1; });
                        this.$watch('selectedAlbumId', () => { this.currentPage = 1; });
                    }
                    const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                    this.dbId = getDbId();

                    // Gunakan ID Halaman dari Property sebagai ID Album utama
                    this.selectedAlbumId = cache.pageId || '';

                    console.log('Album Manager initialized with ID:', this.selectedAlbumId);

                    await this.fetchAlbums(); // Pastikan daftar album di-fetch saat mulai

                    // [FIX] Pastikan webUrl tersedia di cache untuk Sync Metadata
                    if (!cache.webUrl) {
                        window.sendDataToGoogle('get_settings', { dbId: this.dbId }, (res) => {
                            if (res.status === 'success') {
                                const settings = {
                                    blogId: res.blogId || '',
                                    pageId: res.pageId || '',
                                    webUrl: res.webUrl || ''
                                };
                                Object.assign(cache, settings);
                                localStorage.setItem('EzypartsConfig', JSON.stringify(cache));
                            }
                        });
                    }

                    if (this.selectedAlbumId) {
                        await this.fetchAlbumFiles(this.selectedAlbumId);
                    } else {
                        showToast('Page ID belum dikonfigurasi. Harap isi di menu Settings', 'warning');
                    }
                },

                async openBloggerEditor() {
                    const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                    const blogId = cache.blogId || getBlogId();
                    const pageId = cache.pageId;

                    if (!blogId || !this.selectedAlbumId) {
                        showToast('Harap isi Blog ID dan Page ID di sidebar.', 'warning');
                        return;
                    }

                    // 1. Generate & Copy Template
                    const template = `
<div class="ezy-album-entry" data-album-id="${this.selectedAlbumId}" style="background-color: white; border-radius: 20px; border: 2px solid rgb(226, 232, 240); box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px; font-family: Inter, sans-serif; margin-bottom: 30px; padding: 25px;">
  <h3 style="border-bottom: 1px solid rgb(241, 245, 249); color: #0f172a; font-size: 18px; margin-top: 0px; padding-bottom: 10px;"><span style="color: #475569; font-size: 13px;">Area Gambar :</span></h3><div style="text-align: center;"><br /></div>
  
  <div style="align-items: center; border-top: 1px solid rgb(241, 245, 249); display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px;">
    <span style="color: #94a3b8; font-size: 11px;">EzyStore Metadata System v2.0</span>
    <span style="background: rgb(59, 130, 246); border-radius: 4px; color: white; font-size: 10px; font-weight: bold; padding: 2px 8px;">SYNC READY</span>
  </div>
</div><br />`.trim();

                    try {
                        await navigator.clipboard.writeText(template);
                        showToast('✅ Template disalin ke clipboard! Silakan paste di Editor Blogger.', 'success');
                    } catch (err) {
                        console.error('Gagal menyalin template:', err);
                    }

                    const url = `https://draft.blogger.com/blog/page/edit/${blogId}/${pageId}`;
                    const width = 1100;
                    const height = 800;
                    const left = (window.innerWidth / 2) - (width / 2);
                    const top = (window.innerHeight / 2) - (height / 2);
                    window.open(url, 'BloggerEditor', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`);
                },

                async fetchAlbums() {
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getAlbums', { dbId: this.dbId }, resolve, reject);
                        });
                        console.log('Current albums:', res);
                        if (res?.status === 'success') {
                            this.albums = res.data || [];

                            // Tambahkan Halaman Blogger sebagai root virtual album jika ada
                            const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                            if (cache.pageId && !this.albums.find(a => a.id === cache.pageId)) {
                                this.albums.unshift({
                                    id: cache.pageId,
                                    name: 'Blogger Database',
                                    description: 'Main album from Blogger Page',
                                    active: true,
                                    parentid: ''
                                });
                            }

                            console.log('Loaded albums:', this.albums.length, 'albums');
                            if (!this.selectedAlbumId && this.albums.length) {
                                this.selectAlbum(this.albums[0].id);
                            }
                        } else {
                            showToast(res?.message || 'Gagal memuat album', 'error');
                        }
                    } catch (e) {
                        console.error('fetchAlbums:', e);
                        showToast('Gagal memuat album', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                async selectAlbum(albumId) {
                    this.selectedAlbumId = albumId;
                    await this.fetchAlbumFiles(albumId);
                },

                // Getter untuk memfilter file berdasarkan query pencarian
                get filteredAlbumFiles() {
                    if (!this.fileSearchQuery.trim()) return this.albumFiles;
                    const query = this.fileSearchQuery.toLowerCase();
                    return this.albumFiles.filter(f =>
                        (f.filename && f.filename.toLowerCase().includes(query)) ||
                        (f.originalfilename && f.originalfilename.toLowerCase().includes(query))
                    );
                },

                async fetchAlbumFiles(albumId) {
                    if (!albumId) return;
                    this.isLoading = true;
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('getAlbumImages', { dbId: this.dbId, albumId: albumId }, resolve, reject);
                        });
                        if (res?.status === 'success') {
                            this.albumFiles = res.data || [];
                        } else {
                            showToast(res?.message || 'Gagal memuat file album', 'error');
                        }
                    } catch (e) {
                        console.error('fetchAlbumFiles:', e);
                        showToast('Gagal memuat file album', 'error');
                    } finally {
                        this.isLoading = false;
                    }
                },

                openAddAlbum() {
                    this.isEditing = false;
                    this.editingAlbum = { name: '', slug: '', description: '', parent_id: '', active: true, sortOrder: 0 };
                    this.showAlbumModal = true;
                },

                editAlbum(item) {
                    this.isEditing = true;
                    this.editingAlbum = {
                        ...item,
                        parent_id: item.parentid || '' // Map backend 'parentid' to frontend 'parent_id'
                    };
                    this.showAlbumModal = true;
                },

                async saveAlbum() {
                    if (!this.editingAlbum.name) { showToast('Nama album harus diisi', 'warning'); return; }
                    const btn = document.getElementById('save-album-btn');
                    window.setButtonLoading?.(btn, true);
                    try {
                        const payload = {
                            ...this.editingAlbum,
                            dbId: this.dbId,
                            blogId: getBlogId(), // Tambahkan blogId
                            parent_id: this.editingAlbum.parent_id || '', // Pastikan parent_id tetap dikirim
                            slug: this.editingAlbum.slug || window.slugify_(this.editingAlbum.name) // Gunakan slug dari form atau generate dari nama
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('saveAlbum', payload, resolve, reject);
                        });
                        if (res?.status === 'success') {
                            showToast('Album berhasil disimpan');
                            this.showAlbumModal = false;
                            await this.fetchAlbums();
                        } else {
                            showToast(res?.message || 'Gagal menyimpan album', 'error');
                        }
                    } catch (e) {
                        showToast('Terjadi kesalahan: ' + e, 'error');
                    } finally {
                        window.setButtonLoading?.(btn, false);
                    }
                },

                async deleteAlbum(id) {
                    if (!confirm('Hapus album ini?')) return;
                    const res = await new Promise((resolve, reject) => {
                        window.sendDataToGoogle('deleteAlbum', { id, dbId: this.dbId }, resolve, reject);
                    });
                    if (res?.status === 'success') {
                        showToast('Album dihapus');
                        if (this.selectedAlbumId === id) {
                            this.selectedAlbumId = '';
                            this.albumFiles = [];
                        }
                        await this.fetchAlbums();
                    } else {
                        showToast(res?.message || 'Gagal menghapus album', 'error');
                    }
                },

                async editFileCaption(file) {
                    const newName = prompt('Ubah Nama/Caption:', file.filename || '');
                    if (newName !== null && newName !== file.filename) {
                        const originalName = file.filename;
                        file.filename = newName;

                        try {
                            const res = await new Promise((resolve, reject) => {
                                window.sendDataToGoogle('saveAlbumImage', {
                                    ...file,
                                    fileName: file.filename,
                                    originalFileName: file.originalfilename,
                                    fileUrl: file.fileurl,
                                    contentType: file.contenttype || 'image',
                                    thumbnailUrl: file.thumbnailurl || '',
                                    albumId: this.selectedAlbumId,
                                    dbId: this.dbId,
                                    blogId: getBlogId()
                                }, resolve, reject);
                            });

                            if (res?.status === 'success') {
                                showToast('Caption diperbarui');
                            } else {
                                file.filename = originalName;
                                showToast(res?.message || 'Gagal menyimpan caption', 'error');
                            }
                        } catch (e) {
                            file.filename = originalName;
                            showToast('Gagal menyimpan: ' + e, 'error');
                        }
                    }
                },

                async deleteFile(id) {
                    if (!confirm('Hapus file ini?')) return;
                    const res = await new Promise((resolve, reject) => {
                        window.sendDataToGoogle('deleteAlbumImage', { id, dbId: this.dbId }, resolve, reject);
                    });
                    if (res?.status === 'success') {
                        showToast('File album dihapus');
                        this.fetchAlbumFiles(this.selectedAlbumId);
                    } else {
                        showToast(res?.message || 'Gagal menghapus file', 'error');
                    }

                },

                async syncMetadata() {
                    if (!this.selectedAlbumId) {
                        showToast('Pilih album terlebih dahulu!', 'warning');
                        return;
                    }

                    this.isSyncing = true;
                    showToast('🚀 Menarik metadata dari Blogger...', 'info');

                    try {
                        const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                        const webUrl = cache.webUrl || '';

                        if (!webUrl) {
                            throw new Error('Web URL tidak ditemukan. Harap simpan konfigurasi di menu Settings.');
                        }

                        // 1. Panggil backend untuk melakukan fetch (Bypass CORS) dan sinkronisasi sekaligus
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncAlbumMetadataFromBloggerUrl', {
                                dbId: this.dbId,
                                albumId: this.selectedAlbumId,
                                webUrl: webUrl
                            }, resolve, reject);
                        });

                        if (res?.status === 'success') {
                            showToast(res.message, 'success');
                            await this.fetchAlbumFiles(this.selectedAlbumId);
                        } else {
                            showToast(res?.message || 'Gagal sinkron metadata', 'error');
                        }
                    } catch (e) {
                        console.error('syncMetadata:', e);
                        showToast('Gagal sinkron metadata. Pastikan URL web benar dan halaman albumdata.html sudah dipublikasikan.', 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                },

                get selectedAlbumName() {
                    const album = this.albums.find(a => a.id === this.selectedAlbumId);
                    return album ? album.name : 'Pilih album';
                },

                // Mengecek apakah album memiliki anak (sub-folder)
                hasChildren(id) {
                    return this.albums.some(a => a.parentid === id);
                },

                // Toggle buka/tutup folder
                toggleExpand(id) {
                    if (this.expandedIds.includes(id)) {
                        this.expandedIds = this.expandedIds.filter(i => i !== id);
                    } else {
                        this.expandedIds.push(id);
                    }
                },

                // Menentukan apakah baris album harus ditampilkan
                isRowVisible(alb) {
                    if (!alb.parentid) return true; // Folder utama selalu tampil

                    // Cek apakah semua leluhur (parents) folder ini sedang terbuka
                    let currentParentId = alb.parentid;
                    while (currentParentId) {
                        if (!this.expandedIds.includes(currentParentId)) return false;
                        const parent = this.albums.find(a => a.id === currentParentId);
                        currentParentId = parent ? parent.parentid : null;
                    }
                    return true;
                },

                get selectedAlbumPath() {
                    if (!this.selectedAlbumId) return [];
                    const path = [];
                    let currentId = this.selectedAlbumId;
                    let safety = 0; // Mencegah infinite loop
                    while (currentId && safety < 10) {
                        const album = this.albums.find(a => a.id === currentId);
                        if (album) {
                            path.unshift(album);
                            currentId = album.parentid;
                        } else {
                            break;
                        }
                        safety++;
                    }
                    return path;
                },

                // ----------------------------------------------------------------
                // YOUTUBE VIDEO
                // ----------------------------------------------------------------
                openYoutubeModal() {
                    if (!this.selectedAlbumId) {
                        showToast('Pilih album terlebih dahulu!', 'warning');
                        return;
                    }
                    this.youtubeInput = { url: '', title: '', isSaving: false };
                    this.showYoutubeModal = true;
                },

                async addYoutubeVideo() {
                    const url = (this.youtubeInput.url || '').trim();
                    if (!url) { showToast('URL YouTube harus diisi', 'warning'); return; }

                    const videoId = extractYoutubeId(url);
                    if (!videoId) { showToast('URL YouTube tidak valid. Pastikan format URL benar.', 'error'); return; }

                    this.youtubeInput.isSaving = true;
                    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                    const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    const title = (this.youtubeInput.title || '').trim() || `Video ${videoId}`;

                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('saveAlbumImage', {
                                albumId: this.selectedAlbumId,
                                dbId: this.dbId,
                                blogId: getBlogId(),
                                fileName: title,
                                originalFileName: url,  // simpan URL asli sebagai originalfilename
                                fileUrl: embedUrl,       // simpan embed URL sebagai fileurl
                                thumbnailUrl: thumbUrl,
                                contentType: 'youtube',
                                mimeType: 'video/youtube',
                                size: 0
                            }, resolve, reject);
                        });

                        if (res?.status === 'success') {
                            showToast('✅ Video YouTube berhasil ditambahkan!', 'success');
                            this.showYoutubeModal = false;
                            await this.fetchAlbumFiles(this.selectedAlbumId);
                        } else {
                            showToast(res?.message || 'Gagal menyimpan video', 'error');
                        }
                    } catch (e) {
                        showToast('Terjadi kesalahan: ' + e, 'error');
                    } finally {
                        this.youtubeInput.isSaving = false;
                    }
                },

                // Helper: ambil URL thumbnail yang tepat
                getThumbUrl(file) {
                    if (file.thumbnailurl) return file.thumbnailurl;
                    if (file.contenttype === 'youtube') {
                        // Coba ekstrak dari fileurl (embed URL)
                        const embedMatch = String(file.fileurl || '').match(/embed\/([a-zA-Z0-9_-]{11})/);
                        if (embedMatch) return `https://img.youtube.com/vi/${embedMatch[1]}/hqdefault.jpg`;
                    }
                    return file.fileurl || '';
                },

                // Helper: apakah item ini adalah YouTube video
                isYoutube(file) {
                    return file.contenttype === 'youtube' || file.mimetype === 'video/youtube';
                },

                formatDate(value) {
                    if (!value) return '-';
                    try {
                        return new Date(value).toLocaleString('id-ID');
                    } catch (e) {
                        return value;
                    }
                }
            }));
        }
    };

    // ================================================================
    // LANDING CONFIG MANAGER (from home-admin.js)
    // ================================================================
    const registerLandingConfigManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('landingConfigManager')) {
            window.Alpine.data('landingConfigManager', () => ({
                dbId: null,
                formData: {
                    sitename: '', tagline: '', logourl: '',
                    heroenabled: true, categoriesenabled: true, featuredenabled: true,
                    marqueetext: '', marqueeactive: true
                },
                isLoading: false,
                submitting: false,

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await this.fetchConfig();
                },

                async fetchConfig() {
                    // Config ‘LandingPage’ has been removed from backend.
                    // Now managed via template or Branding features.
                    this.isLoading = false;
                },

                async saveConfig() {
                    showToast('Konfigurasi ini sudah tidak digunakan. Gunakan menu Branding.', 'warning');
                }
            }));
        }
    };

    // ================================================================
    // LANDING PAGE ADMIN (from landing-page-admin.js)
    // ================================================================
    const registerLandingPageAdmin = () => {
        if (window.Alpine?.data && !window.Alpine.data('landingPageAdmin')) {
            window.Alpine.data('landingPageAdmin', () => ({
                formData: {
                    id: 'master_sales_page',
                    title: '',
                    subtitle: '',
                    description: '',
                    imageUrl: '',
                    price: 0,
                    originalPrice: 0,
                    category: '',
                    featured: true,
                    active: true,
                    sortOrder: 0,
                    marqueeText: '',
                    marqueeActive: true
                },
                loading: false,
                dbId: null,

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) {
                        console.error('Database ID (sheetId) not found in EzypartsConfig.');
                    }
                    await this.fetchData();
                },

                async fetchData() {
                    this.loading = true;
                    return new Promise((resolve) => {
                        window.sendDataToGoogle('getLandingProducts', { dbId: this.dbId }, (res) => {
                            if (res && res.status === 'success') {
                                const master = (res.data || []).find(p => p.id === 'master_sales_page');
                                if (master) {
                                    this.formData = { ...master };
                                }
                            }
                            this.loading = false;
                            resolve();
                        }, () => {
                            this.loading = false;
                            resolve();
                        });
                    });
                },

                async saveProduct() {
                    if (!this.formData.title) {
                        showToast('Judul produk harus diisi', 'warning');
                        return;
                    }

                    this.submitting = true;
                    return new Promise((resolve) => {
                        const payload = { ...this.formData, dbId: this.dbId };
                        window.sendDataToGoogle('saveLandingProduct', payload, (res) => {
                            if (res && res.status === 'success') {
                                showToast('Konfigurasi Sales Page berhasil disimpan', 'success');
                            } else {
                                const msg = res ? res.message : 'Unknown error';
                                showToast('Gagal menyimpan: ' + msg, 'error');
                            }
                            this.submitting = false;
                            resolve();
                        }, (err) => {
                            console.error('Save product error:', err);
                            showToast('Terjadi kesalahan saat menyimpan.', 'error');
                            this.submitting = false;
                            resolve();
                        });
                    });
                },
            }));
        }
    };

    // ================================================================
    // POST EDITOR MANAGER
    // ================================================================
    const registerPostEditor = () => {
        if (window.Alpine?.data && !window.Alpine.data('postEditor')) {
            window.Alpine.data('postEditor', () => ({
                activeTab: 'list', // 'list' or 'editor'
                savedRange: null,
                accordion: { date: false },
                defaultPost: {
                    id: null,
                    title: '',
                    slug: '',
                    content: '',
                    status: 'Draft',
                    category: [],
                    tags: '',
                    image: '',
                    location: '',
                    commentOption: 'allow',
                    dateMode: 'auto',
                    publishDate: '',
                    dateCreated: '',
                    permalinkMode: 'auto',
                    postMode: 'article'
                },
                post: {},
                posts: [],
                isLoading: false,
                isSyncing: false,
                currentPage: 1,
                isDraggingBubble: false,
                isRotatingBubble: false,
                initialRotation: 0,
                bubbleCenter: { x: 0, y: 0 },
                draggedBubble: null,
                dragOffset: { x: 0, y: 0 },
                itemsPerPage: 10,
                comicPageUrls: [''],
                imageSettingsModal: false,
                masterScriptModal: false, // UI Toggle untuk Modal Master Script
                masterScriptInput: '',    // Input area untuk JSON Master Script
                selectedImageElement: null,
                selectedImageWidth: '',
                selectedImageUrl: '',
                dialogScripts: {}, // Master mapping untuk auto-populate
                showBubbleModal: false,
                bubbleModalData: { panelId: '' },

                get totalPages() {
                    return Math.ceil(this.posts.length / this.itemsPerPage) || 1;
                },

                get paginatedPosts() {
                    const start = (this.currentPage - 1) * this.itemsPerPage;
                    const end = start + this.itemsPerPage;
                    return this.posts.slice(start, end);
                },

                // Fungsi untuk membuka modal naskah dialog
                loadDialogScript() {
                    // Pre-fill dengan data yang sudah ada jika tersedia
                    this.masterScriptInput = Object.keys(this.dialogScripts).length > 0
                        ? JSON.stringify(this.dialogScripts, null, 2)
                        : '';
                    this.masterScriptModal = true;
                },

                // Fungsi untuk memproses JSON dari modal
                applyMasterScript() {
                    if (!this.masterScriptInput.trim()) {
                        showToast('Input naskah kosong.', 'warning');
                        return;
                    }
                    try {
                        this.dialogScripts = JSON.parse(this.masterScriptInput);
                        showToast('Naskah dialog berhasil dimuat!', 'success');
                        this.masterScriptModal = false;
                    } catch (e) {
                        showToast('Format JSON tidak valid. Pastikan formatnya benar.', 'error');
                        console.error('Master Script JSON Error:', e);
                    }
                },

                // Fungsi untuk ganti tampilan bahasa di editor (Preview Only)
                toggleEditorLanguage(lang) {
                    const editor = document.getElementById('classic-editor-body');
                    if (!editor) return;

                    editor.querySelectorAll('.lang-id').forEach(el => el.style.display = lang === 'id' ? 'block' : 'none');
                    editor.querySelectorAll('.lang-en').forEach(el => el.style.display = lang === 'en' ? 'block' : 'none');
                    showToast(`Preview Bahasa: ${lang.toUpperCase()}`, 'info');
                },

                publicBlogUrl: window.app?.publicBlogUrl || '',
                siteKey: window.app?.siteKey || '',
                categories: [],
                formattingTools: [
                    { icon: 'bold', cmd: 'bold', label: 'Bold' },
                    { icon: 'italic', cmd: 'italic', label: 'Italic' },
                    { icon: 'underline', cmd: 'underline', label: 'Underline' },
                    { icon: 'strikethrough', cmd: 'strikethrough', label: 'Strikethrough' },
                    { icon: 'eraser', cmd: 'removeFormat', label: 'Clear Formatting' },
                    { icon: 'list-bullet', cmd: 'insertUnorderedList', label: 'Bullet List' },
                    { icon: 'list-number', cmd: 'insertOrderedList', label: 'Numbered List' },
                    { icon: 'outdent', cmd: 'outdent', label: 'Decrease Indent' },
                    { icon: 'indent', cmd: 'indent', label: 'Increase Indent' },
                    { icon: 'quote', cmd: 'formatBlock:blockquote', label: 'Quote' },
                    { icon: 'code', cmd: 'formatBlock:pre', label: 'Code Block' },
                    { icon: 'minus', cmd: 'insertHorizontalRule', label: 'Horizontal Line' }
                ],

                async init() {
                    console.log('[POST.JS] Komponen postEditor diinisialisasi.');
                    this.post = JSON.parse(JSON.stringify(this.defaultPost));
                    this.$watch('post.title', value => {
                        if (value && this.post.permalinkMode === 'auto') {
                            this.post.slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                        } else if (!value && this.post.permalinkMode === 'auto') {
                            this.post.slug = '';
                        }
                    });
                    this.$nextTick(() => {
                        const editor = document.getElementById('classic-editor-body');
                        if (editor) {
                            // Mengaktifkan handle resize bawaan (terutama untuk Firefox)
                            try { document.execCommand("enableObjectResizers", false, "true"); } catch (e) { }

                            editor.addEventListener('click', (e) => {
                                if (e.target.tagName === 'IMG') {
                                    this.editImageInContent(e.target);
                                }
                            });

                            // Global Drag Handlers for Bubbles
                            editor.addEventListener('mousedown', (e) => this.handleBubbleMouseDown(e));
                            document.addEventListener('mousemove', (e) => this.handleBubbleMouseMove(e));
                            document.addEventListener('mouseup', () => this.handleBubbleMouseUp());

                            // Auto-scale font and padding based on width for comic text boxes
                            this.comicTextObserver = new ResizeObserver(entries => {
                                const editor = document.getElementById('classic-editor-body');
                                if (!editor) return;
                                const editorWidth = editor.getBoundingClientRect().width;
                                if (editorWidth === 0) return;

                                for (let entry of entries) {
                                    if (entry.target.classList.contains('comic-text-box')) {
                                        const box = entry.target;
                                        // Konversi px ke cqi agar responsif terhadap lebar editor
                                        if (box.style.width && box.style.width.endsWith('px')) {
                                            const pxWidth = parseFloat(box.style.width);
                                            box.style.width = ((pxWidth / editorWidth) * 100).toFixed(2) + 'cqi';
                                        }
                                        if (box.style.height && box.style.height.endsWith('px')) {
                                            const pxHeight = parseFloat(box.style.height);
                                            box.style.height = ((pxHeight / editorWidth) * 100).toFixed(2) + 'cqi';
                                        }
                                        // Fit font-size via JS binary search
                                        this.fitComicTextFont(box);
                                    }
                                }
                            });

                            // Watch for newly added comic text boxes + text content changes
                            const mutationObserver = new MutationObserver(mutations => {
                                mutations.forEach(mutation => {
                                    // Newly added nodes → start observing
                                    mutation.addedNodes.forEach(node => {
                                        if (node.nodeType === 1) {
                                            if (node.classList.contains('comic-text-box')) {
                                                this.comicTextObserver.observe(node);
                                                this.fitComicTextFont(node);
                                            }
                                            if (node.querySelectorAll) {
                                                node.querySelectorAll('.comic-text-box').forEach(box => {
                                                    this.comicTextObserver.observe(box);
                                                    this.fitComicTextFont(box);
                                                });
                                            }
                                        }
                                    });
                                    // Text changes inside lang-id / lang-en → refit with debounce
                                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                                        const target = mutation.target;
                                        const langEl = (target.nodeType === 1)
                                            ? target.closest?.('.lang-id, .lang-en')
                                            : target.parentElement?.closest?.('.lang-id, .lang-en');
                                        if (langEl) {
                                            const box = langEl.closest('.comic-text-box');
                                            if (box) {
                                                clearTimeout(box._fitTimer);
                                                box._fitTimer = setTimeout(() => this.fitComicTextFont(box), 120);
                                            }
                                        }
                                    }
                                });
                            });
                            mutationObserver.observe(editor, { childList: true, subtree: true, characterData: true });

                            // Real-time fitting while the user types
                            editor.addEventListener('input', (e) => {
                                const langEl = e.target.closest?.('.lang-id, .lang-en');
                                if (langEl) {
                                    const box = langEl.closest('.comic-text-box');
                                    if (box) {
                                        clearTimeout(box._fitTimer);
                                        box._fitTimer = setTimeout(() => this.fitComicTextFont(box), 120);
                                    }
                                }
                            });

                            // Observe existing ones
                            editor.querySelectorAll('.comic-text-box').forEach(box => {
                                this.comicTextObserver.observe(box);
                                this.fitComicTextFont(box);
                            });
                        }
                    });
                    this.$watch('post.dateMode', (val) => {
                        if (val === 'custom') {
                            this.$nextTick(() => this.initDatePicker());
                        } else {
                            this.destroyDatePicker();
                        }
                    });
                    await this.fetchPosts();
                },

                get selectedPostIds() {
                    return this.posts.filter(p => p.selected).map(p => p.id);
                },

                selectAll(event) {
                    const checked = event.target.checked;
                    this.posts.forEach(p => p.selected = checked);
                },

                formatDate(dateString) {
                    if (!dateString) return '';
                    const date = new Date(dateString);
                    return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
                },

                addCategory(name = null) {
                    if (!name) name = prompt("Nama Label Baru:");
                    if (name && name.trim()) {
                        if (!this.categories.includes(name)) {
                            this.categories.push(name);
                            this.categories.sort();
                        }
                        if (!this.post.category.includes(name)) {
                            this.post.category.push(name);
                        }
                    }
                },

                insertComicText() {
                    this.bubbleModalData = { panelId: '' };
                    this.showBubbleModal = true;
                },

                confirmInsertComicText() {
                    const editor = document.getElementById('classic-editor-body');
                    if (!editor) return;

                    const panelId = this.bubbleModalData.panelId || '';
                    let textId = "Ketik teks\nIndonesia...";
                    let textEn = "Type English\ntext...";

                    if (panelId && this.dialogScripts[panelId]) {
                        // Ubah newline dari JSON mapping menjadi break HTML agar paragraf tersusun otomatis
                        textId = (this.dialogScripts[panelId].id || textId).trim().replace(/\n/g, '<br>');
                        textEn = (this.dialogScripts[panelId].en || textEn).trim().replace(/\n/g, '<br>');
                    } else {
                        textId = textId.replace(/\n/g, '<br>');
                        textEn = textEn.replace(/\n/g, '<br>');
                    }

                    const editorWidth = editor.getBoundingClientRect().width || 800;
                    const id = 'comic-text-' + Date.now();
                    const scrollTop = editor.scrollTop || 0;
                    const topPos = Math.max(100, scrollTop + 100);

                    // Mulai dengan dimensi awal yang pasti agar unit cqmin bekerja
                    const baseWidth = 110;
                    const baseHeight = 60;

                    const topCqi = (topPos / editorWidth * 100).toFixed(2);
                    const widthCqi = (baseWidth / editorWidth * 100).toFixed(2);
                    const heightCqi = (baseHeight / editorWidth * 100).toFixed(2);

                    const html = `
                        <div class="speech-bubble group/text" data-id="${id}" data-panel-id="${panelId}" style="position: absolute; top: ${topCqi}cqi; left: calc(50% - ${widthCqi / 2}cqi); z-index: 20; min-width: 50px; rotate: 0deg;" contenteditable="false">
                            <div class="drag-handle opacity-0 group-hover/text:opacity-100 absolute top-0 left-0 -translate-x-3 -translate-y-1/2 bg-white border border-gray-200 rounded shadow-sm py-0.5 pr-2 cursor-move text-[10px] text-gray-500 font-bold flex items-center z-10 transition-opacity whitespace-nowrap select-none">
                                <span class="w-6 flex justify-center shrink-0">✥</span>
                                <span>${panelId ? '(' + panelId + ')' : ''}</span>
                            </div>
                            <button type="button" onclick="this.closest('.speech-bubble').remove()" class="opacity-0 group-hover/text:opacity-100 absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer shadow-sm z-10 transition-opacity text-xs font-bold leading-none">
                                &times;
                            </button>
                            <!-- Rotation Handle -->
                            <div class="rotate-handle opacity-0 group-hover/text:opacity-100 absolute -bottom-8 left-1/2 -translate-x-1/2 bg-brand-500 text-white rounded-full w-6 h-6 flex items-center justify-center cursor-crosshair shadow-md z-10 transition-opacity select-none hover:bg-brand-600 active:scale-95" title="Putar (Tahan Shift untuk patahan 15°)">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </div>
                            <div class="bubble-content comic-text-box" style="color: black; font-family: 'Outfit', sans-serif; font-weight: 500; line-height: 1.2; text-align: center; cursor: text; resize: both; overflow: hidden; width: ${widthCqi}cqi; height: ${heightCqi}cqi; min-height: 2cqi; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; word-break: break-word; padding: 8px;">
                                <div class="lang-id" contenteditable="true" style="display: block; width: 100%; min-width: 100%; outline: none; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; text-wrap: balance;">${textId}</div>
                                <div class="lang-en" contenteditable="true" style="display: none; width: 100%; min-width: 100%; outline: none; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; text-wrap: balance;">${textEn}</div>
                            </div>
                        </div>
                    `;
                    editor.insertAdjacentHTML('beforeend', html);
                    this.showBubbleModal = false;
                    showToast(panelId ? `Teks ${panelId} berhasil dimuat!` : 'Teks manual ditambahkan.', 'info');
                },

                handleBubbleMouseDown(e) {
                    const rotateHandle = e.target.closest('.rotate-handle');
                    const dragHandle = e.target.closest('.drag-handle');

                    if (!dragHandle && !rotateHandle) return;

                    const bubble = (dragHandle || rotateHandle).closest('.speech-bubble');
                    if (!bubble) return;

                    e.preventDefault();
                    this.draggedBubble = bubble;

                    if (rotateHandle) {
                        this.isRotatingBubble = true;
                        bubble.classList.add('rotating');

                        const rect = bubble.getBoundingClientRect();
                        this.bubbleCenter = {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2
                        };

                        const currentRotation = parseFloat(bubble.style.rotate) || 0;
                        const startAngle = Math.atan2(e.clientY - this.bubbleCenter.y, e.clientX - this.bubbleCenter.x) * (180 / Math.PI);
                        this.initialRotation = currentRotation - startAngle;
                    } else {
                        this.isDraggingBubble = true;
                        bubble.classList.add('dragging');

                        const rect = bubble.getBoundingClientRect();
                        this.dragOffset = {
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                        };
                    }
                },

                handleBubbleMouseMove(e) {
                    if (this.isRotatingBubble && this.draggedBubble) {
                        const angle = Math.atan2(e.clientY - this.bubbleCenter.y, e.clientX - this.bubbleCenter.x) * (180 / Math.PI);
                        let finalAngle = angle + this.initialRotation;

                        // Snap ke setiap 15 derajat jika menahan tombol Shift
                        if (e.shiftKey) {
                            finalAngle = Math.round(finalAngle / 15) * 15;
                        }

                        this.draggedBubble.style.rotate = `${finalAngle}deg`;
                        return;
                    }

                    if (!this.isDraggingBubble || !this.draggedBubble) return;

                    const editor = document.getElementById('classic-editor-body');
                    const editorRect = editor.getBoundingClientRect();

                    // Calculate absolute screen position for the left edge of the bubble
                    let bubbleLeftScreen = e.clientX - this.dragOffset.x;

                    // Calculate the center of the editor on screen
                    const editorCenterScreen = editorRect.left + editorRect.width / 2;

                    // Bound the bubble within the editor horizontally
                    bubbleLeftScreen = Math.max(editorRect.left, Math.min(bubbleLeftScreen, editorRect.right - this.draggedBubble.offsetWidth));

                    // Calculate how far the bubble is from the center of the editor
                    const centerOffset = bubbleLeftScreen - editorCenterScreen;

                    // Calculate top position normally (fixed px from top of editor content)
                    let newTop = e.clientY - editorRect.top - this.dragOffset.y + editor.scrollTop;

                    // Apply the position using calc(50% + offset cqi) so it stays centered and responsive when editor width changes
                    const centerOffsetCqi = (centerOffset / editorRect.width * 100).toFixed(2);
                    const topCqi = (newTop / editorRect.width * 100).toFixed(2);

                    this.draggedBubble.style.left = `calc(50% + ${centerOffsetCqi}cqi)`;
                    this.draggedBubble.style.top = `${topCqi}cqi`;
                },

                handleBubbleMouseUp() {
                    if (this.draggedBubble) {
                        this.draggedBubble.classList.remove('dragging');
                        this.draggedBubble.classList.remove('rotating');
                    }
                    this.isDraggingBubble = false;
                    this.isRotatingBubble = false;
                    this.draggedBubble = null;
                    this.normalizeComicTextSizes();
                },

                normalizeComicTextSizes() {
                    const editor = document.getElementById('classic-editor-body');
                    if (!editor) return;
                    const editorWidth = editor.getBoundingClientRect().width;
                    if (editorWidth === 0) return;

                    // Convert any pixel width/height (from native resize) to cqi so it remains responsive
                    editor.querySelectorAll('.speech-bubble').forEach(bubble => {
                        const box = bubble.querySelector('.comic-text-box');
                        if (box) {
                            if (box.style.width && box.style.width.endsWith('px')) {
                                const px = parseFloat(box.style.width);
                                box.style.width = (px / editorWidth * 100).toFixed(2) + 'cqi';
                            }
                            if (box.style.height && box.style.height.endsWith('px')) {
                                const px = parseFloat(box.style.height);
                                box.style.height = (px / editorWidth * 100).toFixed(2) + 'cqi';
                            }
                            // Re-fit font after normalization
                            this.fitComicTextFont(box);
                        }
                    });
                },

                /**
                 * Menggunakan binary search untuk mencari ukuran font terbesar yang masih muat
                 * di dalam kontainer (.comic-text-box) baik secara lebar maupun tinggi.
                 * Dipanggil saat resize kontainer, penambahan teks, atau pergantian bahasa.
                 */
                fitComicTextFont(box) {
                    if (!box) return;
                    const w = box.offsetWidth;
                    const h = box.offsetHeight;
                    if (w === 0 || h === 0) return;

                    const langId = box.querySelector('.lang-id');
                    const langEn = box.querySelector('.lang-en');
                    const targets = [langId, langEn].filter(Boolean);
                    if (!targets.length) return;

                    // Elemen yang sedang aktif ditampilkan digunakan untuk pengukuran
                    const activeEl = (langId && langId.style.display !== 'none') ? langId : (langEn || langId);
                    if (!activeEl) return;

                    const padding = 16; // 8px tiap sisi
                    const maxW = w - padding;
                    const maxH = h - padding;
                    if (maxW <= 0 || maxH <= 0) return;

                    // Sementara hapus inline font-size agar pengukuran bersih
                    targets.forEach(el => el.style.removeProperty('font-size'));

                    // Binary search: cari font-size terbesar di mana teks masih muat
                    let lo = 8, hi = 120;
                    while (hi - lo > 1) {
                        const mid = Math.floor((lo + hi) / 2);
                        targets.forEach(el => el.style.setProperty('font-size', mid + 'px', 'important'));
                        if (activeEl.scrollHeight <= maxH && activeEl.scrollWidth <= maxW) {
                            lo = mid;
                        } else {
                            hi = mid;
                        }
                    }

                    // Terapkan ukuran final yang ditemukan
                    const finalSize = Math.max(8, lo);
                    targets.forEach(el => el.style.setProperty('font-size', finalSize + 'px', 'important'));
                },

                async fetchPosts() {
                    this.isLoading = true;
                    // Note: Use getDbId() for multi-tenant support if needed, but the original used direct sendDataToGoogle
                    window.sendDataToGoogle('get_posts', { dbId: getDbId() }, (res) => {
                        this.isLoading = false;
                        if (res.status === 'success') {
                            const allCategories = new Set();
                            this.posts = (res.data || []).map(p => {
                                const postData = {
                                    id: p.id,
                                    title: p.title,
                                    slug: p.slug,
                                    content: p.content,
                                    status: p.status,
                                    category: p.category,
                                    tags: p.tags,
                                    image: p.image,
                                    location: p.location,
                                    publishDate: p.publishdate,
                                    dateCreated: p.datecreated,
                                    commentOption: p.commentoption,
                                    postMode: p.postmode || 'article',
                                    permalinkMode: p.permalinkmode,
                                    date: this.formatDate(p.datecreated),
                                    lastModified: p.lastmodified,
                                    selected: false
                                };
                                if (Array.isArray(postData.category)) {
                                    postData.category.forEach(cat => allCategories.add(cat));
                                } else if (typeof postData.category === 'string') {
                                    postData.category.split(',').forEach(cat => allCategories.add(cat.trim()));
                                }
                                return postData;
                            });
                            this.posts = this.posts.sort((a, b) => {
                                const aDate = new Date(a.lastModified || a.dateCreated).getTime() || 0;
                                const bDate = new Date(b.lastModified || b.dateCreated).getTime() || 0;
                                return bDate - aDate;
                            });
                            this.categories = Array.from(allCategories).sort();
                            this.currentPage = 1;
                        } else {
                            showToast('Gagal memuat post: ' + res.message, 'error');
                        }
                    }, (err) => {
                        showToast('Error API saat memuat post.', 'error');
                        this.isLoading = false;
                    });
                },

                async syncAllToBlogger() {
                    const publishedCount = this.posts.filter(p => p.status === 'Published').length;
                    if (publishedCount === 0) {
                        showToast('Tidak ada postingan Published yang perlu disinkronkan.', 'warning');
                        return;
                    }

                    if (!confirm(`Apakah Anda yakin ingin menyinkronkan ${publishedCount} postingan ke Blogger? Ini akan memperbarui seluruh metadata artikel Anda.`)) {
                        return;
                    }

                    this.isSyncing = true;
                    showToast('Sedang menyinkronkan seluruh postingan...', 'info');

                    try {
                        const payload = {
                            dbId: getDbId(),
                            blogId: getBlogId()
                        };
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncAllToBlogger', payload, resolve, reject);
                        });

                        if (res.status === 'success') {
                            showToast(res.message, 'success');
                        } else {
                            showToast(res.message || 'Gagal melakukan sinkronisasi massal', 'error');
                        }
                    } catch (e) {
                        console.error('syncAllToBlogger error:', e);
                        showToast('Terjadi kesalahan koneksi saat sinkronisasi.', 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                },

                execCommand(command, value = null) {
                    const sel = window.getSelection();
                    let contentBox = null;
                    if (sel.rangeCount > 0) {
                        const node = sel.getRangeAt(0).commonAncestorContainer;
                        const bubble = node.nodeType === 1 ? node.closest('.speech-bubble') : node.parentElement.closest('.speech-bubble');
                        if (bubble) contentBox = bubble.querySelector('.comic-text-box');
                    }

                    // SINKRONISASI: Jika di dalam balon, angkat gaya ke parent agar ID & EN seragam
                    const hoistMap = {
                        'bold': 'fontWeight',
                        'italic': 'fontStyle',
                        'underline': 'textDecoration',
                        'justifyLeft': 'textAlign',
                        'justifyCenter': 'textAlign',
                        'justifyRight': 'textAlign',
                        'foreColor': 'color'
                    };

                    if (contentBox && hoistMap[command]) {
                        const prop = hoistMap[command];
                        if (command === 'bold') contentBox.style[prop] = contentBox.style[prop] === 'bold' ? '500' : 'bold';
                        else if (command === 'italic') contentBox.style[prop] = contentBox.style[prop] === 'italic' ? 'normal' : 'italic';
                        else if (command === 'underline') contentBox.style[prop] = contentBox.style[prop] === 'underline' ? 'none' : 'underline';
                        else if (command.startsWith('justify')) contentBox.style[prop] = command.replace('justify', '').toLowerCase();
                        else if (command === 'foreColor') contentBox.style[prop] = value;
                    } else {
                        if (command.startsWith('formatBlock:')) {
                            const tag = command.split(':')[1];
                            document.execCommand('formatBlock', false, tag);
                        } else {
                            document.execCommand(command, false, value);
                        }
                    }
                    document.getElementById('classic-editor-body').focus();
                },

                insertLink() {
                    this.saveSelection();
                    const url = prompt("Enter URL:");
                    if (url) {
                        this.restoreSelection();
                        document.execCommand('createLink', false, url);
                    }
                },
                saveSelection() {
                    const sel = window.getSelection();
                    if (sel.getRangeAt && sel.rangeCount) {
                        this.savedRange = sel.getRangeAt(0);
                    }
                },

                restoreSelection() {
                    const editor = document.getElementById('classic-editor-body');
                    if (editor) {
                        editor.focus();
                        const sel = window.getSelection();
                        if (this.savedRange && editor.contains(this.savedRange.commonAncestorContainer)) {
                            sel.removeAllRanges();
                            sel.addRange(this.savedRange);
                        } else {
                            // Fallback: Jika kursor belum pernah diletakkan, taruh di paling bawah
                            const range = document.createRange();
                            range.selectNodeContents(editor);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                },
                insertImageAtCursor(url) {
                    this.restoreSelection();
                    // Menambahkan atribut draggable dan cursor pointer agar user tahu ini bisa berinteraksi
                    const imgHtml = `<img src="${url}" draggable="true" class="w-full h-auto block m-0 p-0 cursor-pointer" style="width:100%; height:auto; margin:0;" alt="Image" />`;
                    document.execCommand('insertHTML', false, imgHtml);
                },

                addComicPageField() {
                    this.comicPageUrls.push('');
                },
                removeComicPageField(index) {
                    this.comicPageUrls.splice(index, 1);
                    if (this.comicPageUrls.length === 0) this.comicPageUrls.push('');
                },
                insertComicPages() {
                    const validUrls = this.comicPageUrls.filter(u => u && u.trim() !== '');
                    if (validUrls.length === 0) {
                        showToast('Silakan masukkan minimal satu URL gambar', 'warning');
                        return;
                    }
                    this.restoreSelection();
                    let html = '';
                    validUrls.forEach(url => {
                        html += `<img src="${url.trim()}" draggable="true" class="w-full h-auto block m-0 p-0 cursor-pointer" style="width:100%; height:auto; margin:0; display:block;" alt="Comic Page" />`;
                    });
                    document.execCommand('insertHTML', false, html);
                    showToast(`${validUrls.length} halaman ditambahkan`, 'success');
                    this.comicPageUrls = ['']; // Reset daftar
                },

                insertBulkImages(urlText) {
                    if (!urlText || !urlText.trim()) {
                        showToast('Silakan masukkan daftar URL gambar', 'warning');
                        return;
                    }
                    const urls = urlText.split('\n').map(u => u.trim()).filter(Boolean);
                    if (urls.length === 0) return;

                    this.restoreSelection();
                    let html = '';
                    urls.forEach(url => {
                        html += `<img src="${url}" draggable="true" class="w-full h-auto block m-0 p-0 cursor-pointer" style="width:100%; height:auto; margin:0; display:block;" alt="Comic Page" />`;
                    });

                    document.execCommand('insertHTML', false, html);
                    showToast(`${urls.length} gambar ditambahkan`, 'success');
                },

                editImageInContent(imgElement) {
                    // Memberi tanda visual gambar sedang dipilih
                    imgElement.classList.add('selected-img');

                    this.selectedImageElement = imgElement;
                    this.selectedImageUrl = imgElement.src;
                    this.selectedImageWidth = imgElement.style.width || "auto";
                    this.imageSettingsModal = true;
                },
                closeImageSettings() {
                    if (this.selectedImageElement) {
                        this.selectedImageElement.classList.remove('selected-img');
                    }
                    this.imageSettingsModal = false;
                    setTimeout(() => {
                        this.selectedImageElement = null;
                    }, 300);
                },
                applyImageSettings() {
                    if (this.selectedImageElement) {
                        if (this.selectedImageUrl && this.selectedImageUrl.trim()) {
                            this.selectedImageElement.src = this.selectedImageUrl.trim();
                        }
                        this.selectedImageElement.style.width = this.selectedImageWidth || "auto";
                        this.selectedImageElement.style.height = "auto";
                        showToast("Pengaturan gambar diperbarui", "success");
                    }
                    this.closeImageSettings();
                },
                removeSelectedImage() {
                    if (this.selectedImageElement) {
                        if (confirm("Hapus gambar ini dari artikel?")) {
                            this.selectedImageElement.remove();
                            showToast("Gambar dihapus", "info");
                            this.closeImageSettings();
                        }
                    }
                },

                async saveDraft() {
                    this.post.status = 'Draft';
                    await this.savePost();
                },

                async publishPost() {
                    if (!this.post.title) { showToast("Please enter a title before publishing", "warning"); return; }
                    this.post.status = 'Published';
                    await this.savePost('btn-publish-post');
                },

                async savePost(btnId = 'btn-save-draft') {
                    const btn = document.getElementById(btnId);
                    if (btn) window.setButtonLoading?.(btn, true);

                    const editorBody = document.getElementById('classic-editor-body');
                    if (editorBody) {
                        let contentHtml = editorBody.innerHTML;

                        // Jika Mode Comic, bersihkan JSON-LD lama, naskah lama, dan buat yang baru secara otomatis
                        if (this.post.postMode === 'comic') {
                            // Hapus script lama agar tidak terjadi duplikasi data di konten
                            contentHtml = contentHtml.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').trim();
                            contentHtml = contentHtml.replace(/<script type="application\/json" id="ezy-dialog-script">[\s\S]*?<\/script>/gi, '').trim();

                            // Ekstrak URL gambar terbaru dari apa yang ada di dalam editor saat ini
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(contentHtml, 'text/html');
                            const images = Array.from(doc.querySelectorAll('img')).map(img => img.src).filter(src => src && !src.startsWith('data:'));

                            if (images.length > 0) {
                                contentHtml += `<script type="application/ld+json">${JSON.stringify(this._generateComicJsonLd(images))}</script>`;
                            }

                            // Masukkan Master Script (JSON Mapping) langsung ke dalam HTML konten tanpa newline
                            if (Object.keys(this.dialogScripts).length > 0) {
                                contentHtml += `<script type="application/json" id="ezy-dialog-script">${JSON.stringify(this.dialogScripts)}</script>`;
                            }
                        }
                        // Hilangkan newline (\r, \n) agar baris di spreadsheet tetap rapat (horizontal/single-line)
                        this.post.content = contentHtml.replace(/[\r\n]+/g, ' ').trim();
                    }

                    if (!this.post.id) this.post.dateCreated = new Date().toISOString();

                    const payload = { ...this.post, dbId: getDbId(), blogId: getBlogId() };

                    if (Array.isArray(payload.category)) payload.category = payload.category.join(',');

                    return new Promise((resolve) => {
                        window.sendDataToGoogle('save_post', payload, (res) => {
                            if (res.status === 'success') {
                                showToast("Postingan berhasil disimpan", "success");
                                if (res.id && !this.post.id) this.post.id = res.id;
                                this.fetchPosts();
                                this.cancelEditor();
                            } else {
                                showToast("Gagal menyimpan: " + res.message, "error");
                            }
                            if (btn) window.setButtonLoading?.(btn, false);
                            resolve();
                        }, () => { if (btn) window.setButtonLoading?.(btn, false); resolve(); });
                    });
                },

                // Helper untuk membuat struktur JSON-LD yang valid untuk SEO & Parser Blogger
                _generateComicJsonLd(imageUrls) {
                    return {
                        "@context": "https://schema.org",
                        "@type": "BlogPosting",
                        "headline": this.post.title,
                        "image": imageUrls,
                        "description": `Baca komik ${this.post.title} terbaru secara online dengan kualitas HD.`,
                        "datePublished": this.post.publishDate || new Date().toISOString(),
                        "author": {
                            "@type": "Person",
                            "name": "Admin"
                        }
                    };
                },

                async deletePost(id) {
                    if (!confirm("Are you sure you want to delete this post?")) return;
                    showToast("Deleting...", "info");
                    window.sendDataToGoogle('delete_post', { id: id, dbId: getDbId() }, (res) => {
                        if (res.status === 'success') { showToast("Post removed", "success"); this.fetchPosts(); }
                        else showToast("Delete failed", "error");
                    });
                },

                async bulkDelete() {
                    const ids = this.selectedPostIds;
                    if (ids.length === 0) return;
                    if (!confirm(`Are you sure you want to delete ${ids.length} selected posts?`)) return;
                    showToast(`Deleting ${ids.length} posts...`, "info");
                    const promises = ids.map(id => {
                        return new Promise(resolve => window.sendDataToGoogle('delete_post', { id, dbId: getDbId() }, resolve, resolve));
                    });
                    await Promise.all(promises);
                    showToast(`${ids.length} post(s) deleted!`, "success");
                    this.fetchPosts();
                },

                extractImageUrls(html) {
                    if (!html) return [];
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    // Prioritas 1: Ambil dari JSON-LD (Data paling akurat & terstruktur)
                    const jsonLdScript = doc.querySelector('script[type="application/ld+json"]');
                    if (jsonLdScript) {
                        try {
                            const data = JSON.parse(jsonLdScript.textContent);
                            const images = data.image || data.Image;
                            if (Array.isArray(images)) {
                                return images.filter(src => src && !src.startsWith('data:'));
                            } else if (typeof images === 'string') {
                                return [images];
                            }
                        } catch (e) {
                            console.warn("Gagal memproses JSON-LD untuk halaman komik:", e);
                        }
                    }

                    // Prioritas 2: Fallback ke tag <img> standar (Jika JSON-LD tidak ditemukan)
                    return Array.from(doc.querySelectorAll('img'))
                        .map(img => img.src)
                        .filter(src => src && !src.startsWith('data:'));
                },

                _switchToEditor(postData) {
                    this.post = postData;
                    this.activeTab = 'editor';
                    this.savedRange = null; // Reset selection state agar fallback ke posisi akhir bekerja
                    this.$nextTick(() => {
                        if (this.post.dateMode === 'custom') this.initDatePicker();
                        else this.destroyDatePicker();
                    });
                    setTimeout(() => {
                        const editorBody = document.getElementById('classic-editor-body');
                        if (editorBody) {
                            editorBody.innerHTML = this.post.content || '';
                            editorBody.focus();
                        }
                        window.scrollTo({ top: 0, behavior: 'instant' });
                    }, 50);
                },

                editPost(item) {
                    const categories = item.category || item.Category || [];
                    const normalizedPost = {
                        id: item.id || item.ID,
                        title: item.title || item.Title || '',
                        slug: item.slug || item.Slug || '',
                        content: item.content || item.Content || '',
                        status: item.status || item.Status || 'Draft',
                        category: Array.isArray(categories) ? [...categories] : String(categories).split(',').map(c => c.trim()).filter(Boolean),
                        tags: item.tags || item.Tags || '',
                        image: item.image || item.Image || '',
                        dateCreated: item.dateCreated || item.DateCreated,
                        location: item.location || item.Location || '',
                        commentOption: item.commentOption || item.CommentOption || 'allow',
                        dateMode: (item.publishDate || item.PublishDate) ? 'custom' : 'auto',
                        publishDate: item.publishDate || item.PublishDate || '',
                        permalinkMode: item.permalinkMode || item.PermalinkMode || 'auto',
                        postMode: item.postMode || item.PostMode || 'article'
                    };

                    // Kembalikan URL gambar ke sidebar jika dalam mode komik
                    if (normalizedPost.postMode === 'comic') {
                        const extractedUrls = this.extractImageUrls(normalizedPost.content);
                        this.comicPageUrls = extractedUrls.length > 0 ? extractedUrls : [''];

                        // Ekstrak Master Script (JSON Mapping) dari tag script di HTML
                        this.dialogScripts = {};
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(normalizedPost.content, 'text/html');
                        const scriptEl = doc.getElementById('ezy-dialog-script');
                        if (scriptEl) {
                            try {
                                this.dialogScripts = JSON.parse(scriptEl.textContent);
                            } catch (e) {
                                console.error("Gagal parse ezy-dialog-script:", e);
                            }
                        }
                    } else {
                        this.comicPageUrls = [''];
                        this.dialogScripts = {};
                    }

                    this._switchToEditor(normalizedPost);
                },

                cancelEditor() {
                    this.activeTab = 'list';
                    this.post = JSON.parse(JSON.stringify(this.defaultPost));
                    this.comicPageUrls = [''];
                    this.dialogScripts = {};
                    setTimeout(() => {
                        const editorBody = document.getElementById('classic-editor-body');
                        if (editorBody) editorBody.innerHTML = '';
                    }, 50);
                },

                newPost() {
                    this.comicPageUrls = [''];
                    this.dialogScripts = {};
                    this._switchToEditor(JSON.parse(JSON.stringify(this.defaultPost)));
                },

                fpDate: null, fpTime: null,
                initDatePicker() {
                    if (this.fpDate) return;
                    this.$nextTick(() => {
                        const container = document.querySelector('[x-ref="calendarMount"]');
                        const timeInput = document.querySelector('[x-ref="timeInput"]');
                        if (!container || !timeInput) return;
                        const dateVal = this.post.publishDate ? new Date(this.post.publishDate) : new Date();
                        this.updateCompactHeader(dateVal);
                        try {
                            this.fpDate = flatpickr(container, {
                                inline: true, className: 'flatpickr-compact', dateFormat: 'Y-m-d', defaultDate: dateVal,
                                locale: {
                                    firstDayOfWeek: 1,
                                    months: {
                                        shorthand: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                                        longhand: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
                                    }
                                },
                                onChange: (selectedDates) => {
                                    this.updateTime(selectedDates[0], null);
                                    if (selectedDates[0]) this.updateCompactHeader(selectedDates[0]);
                                }
                            });
                            this.fpTime = flatpickr(timeInput, {
                                enableTime: true, noCalendar: true, dateFormat: 'H.i', time_24hr: true, defaultDate: dateVal,
                                onChange: (selectedDates) => this.updateTime(null, selectedDates[0])
                            });
                        } catch (e) { console.error(e); }
                    });
                },
                destroyDatePicker() {
                    if (this.fpDate) { this.fpDate.destroy(); this.fpDate = null; }
                    if (this.fpTime) { this.fpTime.destroy(); this.fpTime = null; }
                },
                updateTime(datePart, timePart) {
                    let current = this.post.publishDate ? new Date(this.post.publishDate) : new Date();
                    if (datePart) { current.setFullYear(datePart.getFullYear()); current.setMonth(datePart.getMonth()); current.setDate(datePart.getDate()); }
                    if (timePart) { current.setHours(timePart.getHours()); current.setMinutes(timePart.getMinutes()); }
                    this.post.publishDate = current.toISOString();
                },
                updateCompactHeader(date) {
                    const cy = document.querySelector('[x-ref="compactYear"]');
                    const csd = document.querySelector('[x-ref="compactSelectedDate"]');
                    if (cy && csd && date) {
                        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                        cy.textContent = date.getFullYear();
                        csd.textContent = `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]}`;
                    }
                    this.updateMonthLabel(date);
                },
                updateMonthLabel(date) {
                    const cml = document.querySelector('[x-ref="compactMonthLabel"]');
                    if (cml && date) {
                        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                        cml.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                    }
                },
                prevMonth() { if (this.fpDate) this.fpDate.changeMonth(-1); },
                nextMonth() { if (this.fpDate) this.fpDate.changeMonth(1); }
            }));
        }
    };

    // ================================================================
    // ABOUT ADMIN (Static Pages)
    // ================================================================
    const registerAboutAdmin = () => {
        if (window.Alpine?.data && !window.Alpine.data('aboutAdmin')) {
            window.Alpine.data('aboutAdmin', () => ({
                formData: {
                    id: 'about',
                    title: 'about',
                    slug: 'about',
                    payload: {
                        content: '',
                        hero_image: '',
                        vision_image: '',
                        subtitle: '',
                        stats: [],
                        values: [],
                        cta_title: '',
                        cta_desc: ''
                    }
                },
                loading: false,
                submitting: false,
                dbId: null,
                isSyncing: false, // Keep this for syncToBlogger

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) {
                        console.error('Database ID (sheetId) not found in EzypartsConfig.');
                    }
                    await this.fetchData();
                },

                async fetchData() {
                    this.loading = true;
                    return new Promise((resolve) => {
                        window.sendDataToGoogle('getAboutPage', { dbId: this.dbId }, (res) => {
                            if (res && res.status === 'success' && res.data) {
                                // Gunakan struktur dari backend secara aman
                                const raw = res.data;
                                const p = (typeof raw.payload === 'object' && raw.payload !== null) ? raw.payload : {};

                                this.formData.id = raw.id || 'about';
                                this.formData.title = raw.title || 'About Us';
                                this.formData.payload = {
                                    ...this.formData.payload,
                                    ...p,
                                    content: p.content || raw.content || '',
                                    hero_image: p.hero_image || raw.hero_image || '',
                                    vision_image: p.vision_image || raw.vision_image || '',
                                    subtitle: p.subtitle || raw.subtitle || '',
                                    stats: Array.isArray(p.stats) ? p.stats : [],
                                    values: Array.isArray(p.values) ? p.values : [],
                                    cta_title: p.cta_title || raw.cta_title || '',
                                    cta_desc: p.cta_desc || raw.cta_desc || ''
                                };
                            }
                            this.loading = false;
                            resolve();
                        }, (err) => {
                            console.error('Fetch about data error:', err);
                            this.loading = false;
                            resolve();
                        });
                    });
                },

                async savePage() {
                    this.submitting = true;
                    return new Promise((resolve) => {
                        const payload = {
                            dbId: this.dbId,
                            blogId: getBlogId(),
                            ...this.formData
                        };
                        window.sendDataToGoogle('saveAboutPage', payload, (res) => {
                            if (res && res.status === 'success') {
                                showToast('Laman Tentang Kami berhasil disimpan', 'success');
                            } else {
                                const msg = res ? res.message : 'Unknown error';
                                showToast('Gagal menyimpan: ' + msg, 'error');
                            }
                            this.submitting = false;
                            resolve();
                        }, (err) => {
                            console.error('Save about page error:', err);
                            showToast('Terjadi kesalahan saat menyimpan.', 'error');
                            this.submitting = false;
                            resolve();
                        });
                    });
                },

                async syncToBlogger() {
                    this.isSyncing = true;
                    showToast('Menyinkronkan laman ke Blogger...', 'info');
                    try {
                        const res = await new Promise((resolve, reject) => {
                            window.sendDataToGoogle('syncStaticPage', {
                                dbId: this.dbId,
                                blogId: getBlogId(),
                                slug: 'about'
                            }, resolve, reject);
                        });
                        if (res.status === 'success') showToast(res.message);
                        else showToast(res.message, 'error');
                    } catch (e) {
                        showToast('Gagal sinkron: ' + e, 'error');
                    } finally {
                        this.isSyncing = false;
                    }
                },

                addStat() {
                    if (!this.formData.payload.stats) this.formData.payload.stats = [];
                    this.formData.payload.stats.push({ label: '', value: '' });
                },

                removeStat(index) {
                    this.formData.payload.stats.splice(index, 1);
                },

                addValue() {
                    if (!this.formData.payload.values) this.formData.payload.values = [];
                    this.formData.payload.values.push({ title: '', desc: '', icon: 'zap' });
                },

                removeValue(index) {
                    this.formData.payload.values.splice(index, 1);
                }
            }));
        }
    };

    // ================================================================
    // CONTACT ADMIN (Static Pages)
    // ================================================================
    const registerContactAdmin = () => {
        if (window.Alpine?.data && !window.Alpine.data('contactAdmin')) {
            window.Alpine.data('contactAdmin', () => ({
                formData: {
                    id: 'contact',
                    title: 'contact',
                    slug: 'contact',
                    payload: {
                        address: '', phone: '', email: '', mapsUrl: '',
                        instagram: '', facebook: '', marketplace: ''
                    }
                },
                loading: false,
                submitting: false,
                dbId: null,

                async init() {
                    this.dbId = getDbId();
                    await this.fetchData();
                },

                async fetchData() {
                    this.loading = true;
                    return new Promise((resolve) => {
                        window.sendDataToGoogle('getContactPage', { dbId: this.dbId }, (res) => {
                            if (res && res.status === 'success' && res.data) {
                                this.formData = { ...res.data };

                                // Pastikan payload adalah objek (parsing jika string)
                                if (this.formData.payload && typeof this.formData.payload === 'string') {
                                    try { this.formData.payload = JSON.parse(this.formData.payload); } catch (e) { this.formData.payload = {}; }
                                }

                                if (!this.formData.payload) this.formData.payload = {};
                                // Inisialisasi default agar tidak undefined saat binding di UI
                                this.formData.payload.address = this.formData.payload.address || '';
                                this.formData.payload.phone = this.formData.payload.phone || '';
                                this.formData.payload.email = this.formData.payload.email || '';
                                this.formData.payload.mapsUrl = this.formData.payload.mapsUrl || '';
                                this.formData.payload.instagram = this.formData.payload.instagram || '';
                                this.formData.payload.facebook = this.formData.payload.facebook || '';
                                this.formData.payload.marketplace = this.formData.payload.marketplace || '';
                            }
                            this.loading = false;
                            resolve();
                        }, () => {
                            this.loading = false;
                            resolve();
                        });
                    });
                },

                async savePage() {
                    this.submitting = true;
                    window.sendDataToGoogle('saveContactPage', {
                        dbId: this.dbId,
                        blogId: getBlogId(),
                        ...this.formData
                    }, (res) => {
                        this.submitting = false;
                        if (res.status === 'success') {
                            showToast('Laman Kontak berhasil disimpan');
                        } else {
                            showToast('Gagal menyimpan: ' + res.message, 'error');
                        }
                    }, () => {
                        this.submitting = false;
                        showToast('Error saat menyimpan laman', 'error');
                    });
                }
            }));
        }
    };

    // ================================================================
    // PUBLIC BRANDING MANAGER (moved from profile.js)
    // ================================================================
    const registerPublicBrandingManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('publicBrandingManager')) {
            window.Alpine.data('publicBrandingManager', () => ({
                dbId: null,
                isLoading: false,
                showModal: false,
                editingData: {
                    companyName: '',
                    supportEmail: '',
                    supportPhone: '',
                    storeAddress: '',
                    operatingHours: '',
                    operatingDays: '',
                    facebook: '',
                    twitter: '',
                    instagram: '',
                    linkedin: ''
                },
                displayData: {},

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await this.fetchBrandingData();
                },

                async fetchBrandingData() {
                    this.isLoading = true;
                    window.sendDataToGoogle('getBranding', { dbId: this.dbId }, (res) => {
                        this.isLoading = false;
                        if (res.status === 'success' && res.data) {
                            // Map source keys to internal camelCase keys
                            const d = res.data;
                            this.displayData = {
                                companyName: d.companyname || '',
                                supportEmail: d.supportemail || '',
                                supportPhone: d.supportphone || '',
                                storeAddress: d.storeaddress || '',
                                operatingHours: d.operatinghours || '',
                                operatingDays: d.operatingdays || '',
                                facebook: d.facebook || '',
                                twitter: d.twitter || '',
                                instagram: d.instagram || '',
                                linkedin: d.linkedin || ''
                            };
                            console.log('Loaded branding data:', this.displayData);
                        } else {
                            console.log('No branding data found, using defaults');
                            this.displayData = {};
                        }
                    }, (err) => {
                        console.error('Fetch branding error:', err);
                        showToast('Gagal memuat data branding', 'error');
                        this.isLoading = false;
                    });
                },

                openEditModal() {
                    this.editingData = JSON.parse(JSON.stringify(this.displayData || {}));
                    this.showModal = true;
                },

                async savePublicInfo(button) {
                    window.setButtonLoading?.(button, true);

                    const payload = {
                        dbId: this.dbId,
                        blogId: getBlogId(),
                        ...this.editingData
                    };

                    window.sendDataToGoogle('saveBranding', payload, (res) => {
                        window.setButtonLoading?.(button, false);
                        if (res.status === 'success') {
                            showToast('Informasi publik berhasil diperbarui', 'success');
                            this.showModal = false;
                            this.fetchBrandingData();
                        } else {
                            showToast(`Gagal menyimpan: ${res.message}`, 'error');
                        }
                    }, (err) => {
                        window.setButtonLoading?.(button, false);
                        console.error('Save branding error:', err);
                        showToast('Terjadi kesalahan saat menyimpan', 'error');
                    });
                },

                getSocialStatus(url) {
                    return url && url.trim() !== '' ? 'Active' : 'Inactive';
                },

                getSocialStatusClass(url) {
                    return url && url.trim() !== '' ? 'text-success-600' : 'text-gray-600 dark:text-gray-400';
                }
            }));
        }
    };

    // ================================================================
    // BLOGGER SETTINGS MANAGER
    // ================================================================
    const registerBloggerSettingsManager = () => {
        if (window.Alpine?.data && !window.Alpine.data('bloggerSettingsManager')) {
            window.Alpine.data('bloggerSettingsManager', () => ({
                dbId: null,
                loading: false,
                config: {
                    blogId: '',
                    pageId: '',
                    pageIdJsonLd: '',
                    webUrl: ''
                },

                async init() {
                    this.dbId = getDbId();
                    if (!this.dbId) showToast('Database ID tidak ditemukan.', 'error');
                    await this.loadSettings();
                },

                async loadSettings() {
                    if (!this.dbId) return;

                    // Try to get settings from window (passed from server)
                    if (window.bloggerSettings) {
                        this.config = {
                            blogId: window.bloggerSettings.blogId || '',
                            pageId: window.bloggerSettings.pageId || '',
                            pageIdJsonLd: window.bloggerSettings.pageIdJsonLd || '',
                            webUrl: window.bloggerSettings.webUrl || ''
                        };
                        return;
                    }

                    // Fallback: Get from Apps Script
                    this.loading = true;
                    window.sendDataToGoogle('get_settings', { dbId: this.dbId }, (res) => {
                        this.loading = false;
                        if (res.status === 'success') {
                            this.config = {
                                blogId: res.blogId || '',
                                pageId: res.pageId || '',
                                pageIdJsonLd: res.pageIdJsonLd || '',
                                webUrl: res.webUrl || ''
                            };

                            // [FIX] Perbarui cache lokal agar komponen lain (Album Manager) langsung sinkron
                            const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                            Object.assign(cache, this.config);
                            localStorage.setItem('EzypartsConfig', JSON.stringify(cache));
                        }
                    }, () => {
                        this.loading = false;
                    });
                },

                async saveSettings(button) {
                    window.setButtonLoading?.(button, true);
                    const payload = {
                        dbId: this.dbId,
                        blogger: this.config
                    };
                    window.sendDataToGoogle('savePublicContentSettings', payload, (res) => {
                        window.setButtonLoading?.(button, false);
                        if (res.status === 'success') {
                            showToast('Pengaturan Blogger berhasil disimpan');

                            // Perbarui cache lokal agar komponen lain (Album Manager) langsung sinkron
                            const cache = JSON.parse(localStorage.getItem('EzypartsConfig') || '{}');
                            Object.assign(cache, this.config);
                            localStorage.setItem('EzypartsConfig', JSON.stringify(cache));

                            // Update window variable
                            window.bloggerSettings = this.config;
                        } else {
                            showToast('Gagal menyimpan: ' + res.message, 'error');
                        }
                    }, () => {
                        window.setButtonLoading?.(button, false);
                        showToast('Error saat menyimpan', 'error');
                    });
                }
            }));
        }
    };

    // ================================================================
    // INITIALIZATION
    // ================================================================
    const registerAll = () => {
        registerHeroManager();
        registerCategoryManager();
        registerFeaturedProductManager();
        registerAlbumManager();
        registerLandingConfigManager();
        registerLandingPageAdmin();
        registerPostEditor();
        registerAboutAdmin();
        registerContactAdmin();
        registerPublicBrandingManager();
        registerBloggerSettingsManager();
    };

    if (window.Alpine) {
        registerAll();
    } else {
        document.addEventListener('alpine:init', registerAll);
    }
})();