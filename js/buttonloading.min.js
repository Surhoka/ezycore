/**
 * Global Button Loading State Utility
 * 
 * Usage:
 * 1. Set loading: window.setButtonLoading(button, true)
 * 2. Remove loading: window.setButtonLoading(button, false)
 * 
 * Features:
 * - Animated spinner
 * - Disabled state
 * - Pressed appearance maintained
 * - Auto-restore original content
 */

// Track buttons that are currently in a loading state
window.activeLoadingButtons = new Set();

window.setButtonLoading = function (button, isLoading) {
    if (!button) {
        console.warn('setButtonLoading: button element is null or undefined');
        return;
    }

    if (isLoading) {
        // Track this button
        window.activeLoadingButtons.add(button);

        // Store original text and state
        button.dataset.originalText = button.innerHTML;
        button.dataset.originalDisabled = button.disabled;

        // Disable button and add loading class
        button.disabled = true;
        button.classList.add('btn-loading');

        // Reset success/hide styles if any
        button.classList.remove('btn-success');
        button.style.display = '';
        button.style.opacity = '';
        button.style.transform = '';
        if (button.dataset.oldBg) {
            button.style.backgroundColor = button.dataset.oldBg;
            delete button.dataset.oldBg;
        }

        // Add spinner and loading text
        button.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            ${typeof isLoading === 'string' ? isLoading : 'Processing...'}
        `;
    } else {
        // Stop tracking
        window.activeLoadingButtons.delete(button);

        // Restore original state
        button.disabled = button.dataset.originalDisabled === 'true';
        button.classList.remove('btn-loading');
        button.classList.remove('btn-success');

        // Reset styles
        button.style.display = '';
        button.style.opacity = '';
        button.style.transform = '';
        if (button.dataset.oldBg) {
            button.style.backgroundColor = button.dataset.oldBg;
            delete button.dataset.oldBg;
        }

        // Restore original text
        if (button.dataset.originalText) {
            button.innerHTML = button.dataset.originalText;
            delete button.dataset.originalText;
            delete button.dataset.originalDisabled;
        }
    }
};

/**
 * Global Success Handler
 * Automatically finds buttons that were loading and marks them as success.
 * If the button is inside a modal, it will attempt to close the modal.
 */
window.markActiveButtonsAsSuccess = function (options = {}) {
    window.activeLoadingButtons.forEach(button => {
        window.setButtonSuccess(button, options);
    });
    window.activeLoadingButtons.clear();
};

/**
 * Alias for setButtonLoading(button, false) for backward compatibility
 */
window.resetButtonState = function (button, originalHTML) {
    if (button) {
        if (originalHTML) button.innerHTML = originalHTML;
        window.setButtonLoading(button, false);
    }
};

/**
 * Global Button Success Utility
 * Sets button to success state and automatically closes parent modal if exists
 * 
 * @param {HTMLElement} button - The button element
 * @param {Object} options - { closeModal: true, delay: 500, message: 'Berhasil' }
 */
window.setButtonSuccess = function (button, options = {}) {
    if (!button) return;

    const settings = {
        closeModal: true,
        delay: 500,
        message: 'Berhasil',
        ...options
    };

    // Remove loading state if present
    button.classList.remove('btn-loading');
    window.activeLoadingButtons.delete(button);
    button.disabled = true;
    button.classList.add('btn-success');

    // Display success message
    button.innerHTML = `
        <svg class="h-4 w-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        ${settings.message}
    `;

    // Apply success styles directly
    button.dataset.oldBg = button.style.backgroundColor;
    button.style.backgroundColor = '#10B981'; // green-500
    button.style.borderColor = '#10B981';
    button.style.color = '#FFFFFF';

    // Logic to close modal
    if (settings.closeModal) {
        setTimeout(() => {
            console.log('Searching for modal to close for button:', button);
            // Find modal container
            const modal = button.closest('.modal, [id*="modal"], [class*="modal"]');
            console.log('Found modal container:', modal);

            if (modal) {
                // B. Better approach: Try to find and click an actual Close button first
                // This is the most reliable way as it triggers all native/Alpine/transition listeners
                let closedByButton = false;
                const closeBtn = modal.querySelector('.modal-close-btn, .close-modal, [x-on\\:click*="false"], [x-on\\:click*="Modal = false"]');
                if (closeBtn && typeof closeBtn.click === 'function') {
                    console.log('Clicking found close button:', closeBtn);
                    closeBtn.click();
                    closedByButton = true;
                }

                // C. Fallback: Alpine.js Component Search
                let handledByAlpine = closedByButton;
                if (!closedByButton) {
                    const alpineEl = modal.closest('[x-data]');
                    if (alpineEl && window.Alpine) {
                        try {
                            const data = window.Alpine.$data(alpineEl);
                            Object.keys(data).forEach(key => {
                                if (key.toLowerCase().includes('modal') && typeof data[key] === 'boolean') {
                                    data[key] = false;
                                    handledByAlpine = true;
                                }
                            });
                        } catch (e) {
                            console.warn('Alpine close failed:', e);
                        }
                    }
                }

                // D. Extra Safety: Clear Global app modal states
                if (window.app) {
                    Object.keys(window.app).forEach(key => {
                        if (key.toLowerCase().includes('modal') && typeof window.app[key] === 'boolean') {
                            window.app[key] = false;
                        }
                    });
                }

                // E. Final Forced Fallback (Only use if not handled above)
                if (!handledByAlpine && !closedByButton) {
                    modal.classList.add('hidden');
                    modal.classList.remove('show', 'flex');
                    modal.style.display = 'none';
                } else {
                    // Cleanup forced styles just in case
                    modal.classList.remove('hidden');
                    modal.style.display = '';
                }

                // Blur focus to prevent keyboard "stuck" states
                if (document.activeElement) document.activeElement.blur();
            }

            // Restore button text and state - MUST ALWAYS RUN
            setTimeout(() => {
                window.setButtonLoading(button, false);
            }, 100);
        }, settings.delay);
    } else {
        // If not closing modal, just restore after a bit so user sees the success
        setTimeout(() => {
            window.setButtonLoading(button, false);
        }, 1500);
    }
};

/**
 * Helper functions for success state
 */
window.setButtonSuccessById = function (buttonId, options) {
    const button = document.getElementById(buttonId);
    if (button) window.setButtonSuccess(button, options);
};

window.setButtonSuccessBySelector = function (selector, options) {
    const button = document.querySelector(selector);
    if (button) window.setButtonSuccess(button, options);
};

/**
 * Helper function to set loading by button ID
 * @param {String} buttonId - Button element ID
 * @param {Boolean} isLoading - Loading state
 */
window.setButtonLoadingById = function (buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
        window.setButtonLoading(button, isLoading);
    } else {
        console.warn(`setButtonLoadingById: button with id "${buttonId}" not found`);
    }
};

/**
 * Helper function to set loading by selector
 * @param {String} selector - CSS selector
 * @param {Boolean} isLoading - Loading state
 */
window.setButtonLoadingBySelector = function (selector, isLoading) {
    const button = document.querySelector(selector);
    if (button) {
        window.setButtonLoading(button, isLoading);
    } else {
        console.warn(`setButtonLoadingBySelector: button with selector "${selector}" not found`);
    }
};
