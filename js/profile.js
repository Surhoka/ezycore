/**
 * Profile Page Logic - Wrapped in IIFE to prevent Identifier Re-declaration Errors
 */
(function () {
    if (window.profileScriptLoaded) return;

    const registerProfilePage = () => {
        if (window.Alpine && !window.Alpine.data('profilePage')) {
            window.Alpine.data('profilePage', () => ({
                // --- STATE ---
                isLoading: true,
                activeTab: 'general',
                isProfileInfoModal: false,
                isProfileAddressModal: false,

                // Data for display
                profile: {
                    id: null,
                    personalInfo: { fullName: 'Loading...', bio: '-', profilePhoto: 'https://dummyimage.com/100', status: 'Active' },
                    address: { cityState: '-' }
                },

                // Separate data for editing in modals to avoid instant UI changes
                editableProfile: {
                    personalInfo: {},
                    address: {},
                    socialLinks: {}
                },

                // --- LIFECYCLE & ACTIONS ---
                async init() {
                    console.log("Profile Page Initialized with Alpine Component.");
                    const sessionUser = JSON.parse(localStorage.getItem('signedInUser'));
                    const sessionUserId = sessionUser ? (sessionUser.id || sessionUser.uid) : null;
                    await this.fetchProfileData(sessionUserId);
                    this.isLoading = false;
                },

                async fetchProfileData(userId) {
                    this.isLoading = true;
                    const cacheKey = userId ? `cached_profile_data_${userId}` : 'cached_profile_data_default';
                    const cachedData = localStorage.getItem(cacheKey);

                    if (cachedData) {
                        try {
                            this.populateProfileData(JSON.parse(cachedData));
                        } catch (e) {
                            console.error('Error parsing cached profile data', e);
                            localStorage.removeItem(cacheKey);
                        }
                    }

                    if (typeof window.sendDataToGoogle !== 'function') {
                        console.error('sendDataToGoogle is not available.');
                        this.isLoading = false;
                        return;
                    }

                    window.sendDataToGoogle('getProfile', { userId: userId || '' }, (response) => {
                        if (response.status === 'success' && response.data) {
                            this.populateProfileData(response.data);
                            localStorage.setItem(cacheKey, JSON.stringify(response.data));

                            // Sync header photo
                            const sessionUser = JSON.parse(localStorage.getItem('signedInUser'));
                            if (sessionUser && response.data.personalInfo?.profilePhoto) {
                                sessionUser.pictureUrl = response.data.personalInfo.profilePhoto;
                                localStorage.setItem('signedInUser', JSON.stringify(sessionUser));
                                if (window.app) window.app.currentUser = { ...sessionUser };
                            }
                        } else if (!cachedData) {
                            window.showToast('Welcome! Please create your profile.', 'info');
                            this.openInfoModal();
                        }
                        this.isLoading = false;
                    }, (err) => {
                        console.error("API Error fetching profile:", err);
                        window.showToast('Failed to load profile data.', 'error');
                        this.isLoading = false;
                    });
                },

                populateProfileData(data) {
                    this.profile.id = data.id || null;
                    this.profile.personalInfo = {
                        ...data.personalInfo,
                        fullName: `${data.personalInfo?.firstName || ''} ${data.personalInfo?.lastName || ''}`.trim()
                    };
                    this.profile.address = data.address || {};
                    this.profile.socialLinks = data.socialLinks || {};
                },

                // --- MODAL CONTROLS ---
                openInfoModal() {
                    // Deep copy current profile to editable profile to prevent reference issues
                    this.editableProfile.personalInfo = JSON.parse(JSON.stringify(this.profile.personalInfo || {}));
                    this.editableProfile.socialLinks = JSON.parse(JSON.stringify(this.profile.socialLinks || {}));
                    this.isProfileInfoModal = true;
                },

                openAddressModal() {
                    this.editableProfile.address = JSON.parse(JSON.stringify(this.profile.address || {}));
                    this.isProfileAddressModal = true;
                },

                // --- SAVE ACTIONS ---
                async savePersonalInfo(button) {
                    window.setButtonLoading(button, true);
                    const payload = {
                        personalInfo: this.editableProfile.personalInfo,
                        socialLinks: this.editableProfile.socialLinks
                    };
                    await this.updateProfile(payload, button, () => {
                        this.isProfileInfoModal = false;
                    });
                },

                async saveAddress(button) {
                    window.setButtonLoading(button, true);
                    const payload = {
                        address: this.editableProfile.address
                    };
                    await this.updateProfile(payload, button, () => {
                        this.isProfileAddressModal = false;
                    });
                },

                async updateProfile(profileData, button, onSuccess) {
                    const userId = this.profile.id || JSON.parse(localStorage.getItem('signedInUser'))?.id;
                    if (!userId) {
                        window.showToast('User ID not found. Cannot save.', 'error');
                        if (button) window.setButtonLoading(button, false);
                        return;
                    }

                    const action = this.profile.id ? 'updateCoreProfile' : 'createProfile';

                    window.sendDataToGoogle(action, {
                        userId: userId,
                        profileData: JSON.stringify(profileData)
                    }, (res) => {
                        if (res.status === 'success') {
                            window.showToast('Profile updated successfully!', 'success');

                            // 1. Update UI Profile secara instan
                            if (profileData.personalInfo) {
                                this.profile.personalInfo = {
                                    ...this.profile.personalInfo,
                                    ...profileData.personalInfo,
                                    fullName: `${profileData.personalInfo.firstName || this.profile.personalInfo.firstName || ''} ${profileData.personalInfo.lastName || this.profile.personalInfo.lastName || ''}`.trim()
                                };

                                // Update session user (agar nama di header/navbar sinkron secara global)
                                const sessionUser = JSON.parse(localStorage.getItem('signedInUser'));
                                if (sessionUser) {
                                    sessionUser.firstName = profileData.personalInfo.firstName || sessionUser.firstName;
                                    sessionUser.lastName = profileData.personalInfo.lastName || sessionUser.lastName;
                                    localStorage.setItem('signedInUser', JSON.stringify(sessionUser));
                                    if (window.app) window.app.currentUser = { ...sessionUser };
                                }
                            }

                            if (profileData.address) {
                                this.profile.address = { ...this.profile.address, ...profileData.address };
                            }

                            if (profileData.socialLinks) {
                                this.profile.socialLinks = { ...this.profile.socialLinks, ...profileData.socialLinks };
                            }

                            // Pastikan ID tersimpan jika ini adalah profil baru yang baru saja dibuat
                            if (res.id && !this.profile.id) this.profile.id = res.id;

                            // 2. Update localStorage cache agar data tetap persisten saat refresh halaman
                            const cacheKey = userId ? `cached_profile_data_${userId}` : 'cached_profile_data_default';
                            localStorage.setItem(cacheKey, JSON.stringify(this.profile));

                            if (onSuccess) onSuccess();
                            // fetchProfileData(userId) dihapus agar pembaruan terasa instan
                        } else {
                            window.showToast(`Error: ${res.message}`, 'error');
                        }
                        if (button) window.setButtonLoading(button, false);
                    }, (err) => {
                        console.error('Update profile error:', err);
                        window.showToast('API error while saving.', 'error');
                        if (button) window.setButtonLoading(button, false);
                    });
                },

                // --- PHOTO UPLOAD ---
                triggerPhotoUpload() {
                    this.$refs.photoInput.click();
                },

                handlePhotoFileChange(event) {
                    const file = event.target.files[0];
                    if (!file) return;

                    if (!file.type.startsWith('image/')) {
                        window.showToast('Please select an image file.', 'error');
                        return;
                    }
                    if (file.size > 5 * 1024 * 1024) { // 5MB limit
                        window.showToast('Image size must be less than 5MB.', 'error');
                        return;
                    }

                    window.showToast('Uploading profile photo...', 'info');

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64data = e.target.result.split(',')[1];
                        this.uploadProfilePhoto(file.name, base64data, file.type);
                    };
                    reader.readAsDataURL(file);
                },

                uploadProfilePhoto(fileName, base64data, mimeType) {
                    const userId = this.profile.id || JSON.parse(localStorage.getItem('signedInUser'))?.id;
                    if (!userId) {
                        window.showToast('User ID not found. Cannot upload photo.', 'error');
                        return;
                    }
                    // Memisahkan nama file dan ekstensinya
                    const dotIndex = fileName.lastIndexOf('.');
                    const nameOnly = fileName.substring(0, dotIndex);
                    const extension = fileName.substring(dotIndex);
                    // Hasilnya: NamaAsli_UserID_Timestamp.jpg
                    const customFileName = `${nameOnly}_${userId}_${Date.now()}${extension}`;

                    window.sendDataToGoogle('uploadImageAndGetUrl', {
                        fileName: customFileName,
                        fileData: base64data,
                        mimeType: mimeType
                    }, (res) => {
                        if (res.status === 'success' && res.url) {
                            this.saveProfilePhotoUrl(res.url);
                        } else {
                            window.showToast(`Upload failed: ${res.message}`, 'error');
                        }
                    });
                },

                saveProfilePhotoUrl(photoUrl) {
                    const userId = this.profile.id || JSON.parse(localStorage.getItem('signedInUser'))?.id;
                    window.sendDataToGoogle('updateProfilePhoto', {
                        userId: userId,
                        photoUrl: photoUrl
                    }, (res) => {
                        if (res.status === 'success') {
                            window.showToast('Profile photo updated!', 'success');

                            // 1. Update foto di UI profile secara instan
                            this.profile.personalInfo.profilePhoto = photoUrl;

                            // 2. Update data di localStorage agar saat refresh tetap ada
                            const cacheKey = userId ? `cached_profile_data_${userId}` : 'cached_profile_data_default';
                            const cachedData = JSON.parse(localStorage.getItem(cacheKey) || '{}');
                            if (cachedData.personalInfo) {
                                cachedData.personalInfo.profilePhoto = photoUrl;
                                localStorage.setItem(cacheKey, JSON.stringify(cachedData));
                            }

                            // 3. Update session user (untuk foto di header/navbar)
                            const sessionUser = JSON.parse(localStorage.getItem('signedInUser'));
                            if (sessionUser) {
                                sessionUser.pictureUrl = photoUrl;
                                localStorage.setItem('signedInUser', JSON.stringify(sessionUser));
                                // Jika ada objek app global, sinkronkan juga
                                if (window.app) window.app.currentUser = { ...sessionUser };
                            }
                        } else {
                            window.showToast(`Failed to save photo URL: ${res.message}`, 'error');
                        }
                    });
                },

                // --- DELETE ACTIONS ---
                async deleteAccount(button) {
                    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) return;
                    // This is a placeholder. A real delete would need a dedicated, secure backend function.
                    window.showToast('Delete functionality not implemented in this example.', 'warning');
                },

                async clearAddress(button) {
                    if (!confirm('Are you sure you want to clear address information?')) return;
                    window.setButtonLoading(button, true);
                    const payload = { address: { country: '', cityState: '', postalCode: '', taxId: '' } };
                    await this.updateProfile(payload, button, () => {
                        this.isProfileAddressModal = false;
                    });
                },

                // --- HELPERS ---
                getSocialStatus(url) {
                    return url && url.trim() !== '' ? 'Active' : 'Inactive';
                },

                getSocialStatusClass(url) {
                    return url && url.trim() !== '' ? 'text-success-600' : 'text-gray-600 dark:text-gray-400';
                }
            }));
        }
    };

    // Immediate registration or wait for Alpine
    if (window.Alpine) {
        registerProfilePage();
    } else {
        document.addEventListener('alpine:init', registerProfilePage);
    }

    /**
     * Uploads an image to Google Drive via Google Apps Script and returns its public URL.
     * @param {string} fileName - The desired file name for the uploaded image.
     * @param {string} base64Data - The base64 encoded image data (without the data:image/...;base64, prefix).
     * @param {string} mimeType - The MIME type of the image (e.g., 'image/png', 'image/jpeg').
     * @returns {Promise<Object>} A promise that resolves with an object containing `status` and `url` if successful,
     *                            or `status` and `message` if there's an error.
     */
    window.uploadImageAndGetUrl = function (fileName, base64Data, mimeType) {
        return new Promise((resolve, reject) => {
            if (typeof window.sendDataToGoogle !== 'function') {
                const errorMessage = 'sendDataToGoogle function not found. Make sure apps-script.js is loaded.';
                console.error(errorMessage);
                return reject({ status: 'error', message: errorMessage });
            }

            const data = {
                fileName: fileName,
                fileData: base64Data,
                fileType: mimeType
            };

            window.sendDataToGoogle('uploadImageAndGetUrl', data, (response) => {
                if (response.status === 'success' && response.url) {
                    resolve({ status: 'success', url: response.url });
                } else {
                    reject({ status: 'error', message: response.message || 'Unknown error during upload.' });
                }
            }, (error) => {
                console.error('Error in uploadImageAndGetUrl:', error);
                reject({ status: 'error', message: error.message || 'Network error or script execution failed.' });
            });
        });
    };

    window.profileScriptLoaded = true;
})();
