window.guideData = function () {
  var blogId = (function () {
    try {
      var c = JSON.parse(localStorage.getItem('EzycoreConfig') || '{}');
      return c.blogId || 'default';
    } catch (_) { return 'default'; }
  })();
  var STORAGE_KEY = 'EzycoreGuide_' + blogId;

  return {
    steps: [
      { id: 1, title: 'Welcome to ScrewFast', description: 'Your one-stop solution for top-quality hardware tools, spare parts, and construction services. Let us walk you through everything you need to get started.', icon: 'star' },
      { id: 2, title: 'Browse Products', description: 'Explore our extensive catalog of tools and spare parts. Use category filters and search to find exactly what you need for your project.', icon: 'shopping-bag' },
      { id: 3, title: 'Interactive Diagrams', description: 'View spare parts with our interactive hotspot technology. Hover or click on diagram points to see part details, pricing, and availability.', icon: 'grid' },
      { id: 4, title: 'Easy Checkout', description: 'Add items to your cart, review your order, and complete payment in just a few clicks. We support multiple payment methods for your convenience.', icon: 'credit-card' },
      { id: 5, title: 'Track Orders', description: 'Monitor your orders in real-time from placement to delivery. Get notified at every step so you always know where your shipment is.', icon: 'truck' },
      { id: 6, title: 'Get Support', description: 'Our expert support team is available 24/7 to help with technical questions, order issues, or product recommendations.', icon: 'headset' }
    ],
    features: [
      { title: 'Fast Delivery', description: 'Same-day delivery for local orders. Nationwide delivery in 2-4 business days.', icon: 'truck', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
      { title: 'Quality Guaranteed', description: 'All products are 100% authentic with manufacturer warranty.', icon: 'shield-check', color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
      { title: 'Expert Support', description: 'Technical assistance from certified professionals. Phone, email, and live chat.', icon: 'headset', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
      { title: 'Best Price Guarantee', description: 'We match competitor pricing on identical items. Find a lower price and we will beat it.', icon: 'currency-dollar', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' }
    ],
    faqs: [
      { q: 'How do I create an account?', a: 'Click the profile icon in the top menu and select Sign Up. Fill in your details and verify your email address to get started.' },
      { q: 'What payment methods do you accept?', a: 'We accept bank transfers, credit/debit cards (Visa, Mastercard), e-wallets (GoPay, OVO, Dana), and COD for select areas.' },
      { q: 'How long does shipping take?', a: 'Local deliveries typically arrive within 24 hours. National shipping takes 2-4 business days depending on your location.' },
      { q: 'Can I return a product?', a: 'Yes, we offer a 14-day return policy for unused items in original packaging. Contact support to initiate a return.' }
    ],
    currentStep: 0,
    showTour: false,
    tourCompleted: false,
    faqOpen: null,

    init: function () {
      try { this.tourCompleted = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) {}
    },

    get progress() {
      return ((this.currentStep + 1) / this.steps.length) * 100;
    },

    get currentStepData() {
      return this.steps[this.currentStep] || this.steps[0];
    },

    get isFirstStep() { return this.currentStep === 0; },
    get isLastStep() { return this.currentStep === this.steps.length - 1; },

    startTour: function () {
      this.currentStep = 0;
      this.showTour = true;
      var self = this;
      this.$nextTick(function () { self.goToStep(0); });
    },

    nextStep: function () {
      var next = this.currentStep + 1;
      if (next < this.steps.length) {
        this.goToStep(next);
      } else {
        this.completeTour();
      }
    },

    prevStep: function () {
      if (this.currentStep > 0) {
        this.goToStep(this.currentStep - 1);
      }
    },

    goToStep: function (index) {
      if (index < 0 || index >= this.steps.length) return;
      this._removeSpotlight(this.currentStep);
      this.currentStep = index;
      var self = this;
      this.$nextTick(function () {
        self._scrollToStep(index);
        self._applySpotlight(index);
      });
    },

    _applySpotlight: function (index) {
      var el = document.getElementById('guide-step-' + index);
      if (!el) return;
      el.style.position = 'relative';
      el.style.zIndex = '1000';
      el.style.boxShadow = '0 0 0 200vmax rgba(0,0,0,0.55)';
      el.style.outline = '3px solid #F7941D';
      el.style.outlineOffset = '3px';
      el.style.borderRadius = '16px';
      el.style.transition = 'box-shadow 0.4s ease, outline 0.4s ease';
    },

    _removeSpotlight: function (index) {
      var el = document.getElementById('guide-step-' + index);
      if (!el) return;
      el.style.position = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.borderRadius = '';
      el.style.transition = '';
    },

    _scrollToStep: function (index) {
      var el = document.getElementById('guide-step-' + index);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    skipTour: function () {
      this._removeSpotlight(this.currentStep);
      this.showTour = false;
    },

    completeTour: function () {
      this._removeSpotlight(this.currentStep);
      this.tourCompleted = true;
      this.showTour = false;
      try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (_) {}
      if (window.showToast) {
        window.showToast('Selamat! Anda telah menyelesaikan tur panduan.', 'success');
      }
    },

    resetTour: function () {
      this.tourCompleted = false;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      this.startTour();
    },

    toggleFaq: function (index) {
      this.faqOpen = this.faqOpen === index ? null : index;
    }
  };
};
