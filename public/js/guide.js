window.guideData = function () {
  return {
    steps: [
      { id: 1, title: 'Welcome to ScrewFast', description: 'Your one-stop solution for top-quality hardware tools, spare parts, and construction services.', icon: 'star' },
      { id: 2, title: 'Browse Products', description: 'Explore our extensive catalog of tools and spare parts. Use category filters and search to find what you need.', icon: 'shopping-bag' },
      { id: 3, title: 'Interactive Diagrams', description: 'View spare parts with hotspot technology. Hover diagram points to see part details and pricing.', icon: 'grid' },
      { id: 4, title: 'Easy Checkout', description: 'Add items to cart, review, and pay in just a few clicks. Supports bank transfer, cards, e-wallets, and COD.', icon: 'credit-card' },
      { id: 5, title: 'Track Orders', description: 'Monitor orders in real-time from placement to delivery. Get notified at every step.', icon: 'truck' },
      { id: 6, title: 'Get Support', description: 'Our expert team is available 24/7 via live chat, email, or phone.', icon: 'headset' }
    ],
    features: [
      { title: 'Fast Delivery', description: 'Same-day delivery for local orders.', icon: 'truck', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
      { title: 'Quality Guaranteed', description: '100% authentic with manufacturer warranty.', icon: 'shield-check', color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
      { title: 'Expert Support', description: 'Certified professionals via phone, email, and live chat.', icon: 'headset', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
      { title: 'Best Price Guarantee', description: 'We match competitor pricing on identical items.', icon: 'currency-dollar', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' }
    ],
    faqs: [
      { q: 'How do I create an account?', a: 'Click profile icon and select Sign Up. Fill details and verify your email.' },
      { q: 'What payment methods do you accept?', a: 'Bank transfer, credit/debit cards, e-wallets (GoPay, OVO, Dana), and COD.' },
      { q: 'How long does shipping take?', a: 'Local: 24 hours. National: 2-4 business days.' },
      { q: 'Can I return a product?', a: '14-day return policy for unused items in original packaging.' }
    ],
    currentStep: 0, showTour: false, faqOpen: null,
    isTourDone: false,

    init: function () {
      try { this.isTourDone = localStorage.getItem('EzycoreGuide') === 'true'; } catch (_) {}
    },

    get progress() { return ((this.currentStep + 1) / this.steps.length) * 100; },
    get currentStepData() { return this.steps[this.currentStep] || this.steps[0]; },
    get isFirstStep() { return this.currentStep === 0; },
    get isLastStep() { return this.currentStep === this.steps.length - 1; },
    get tourCompleted() { return this.isTourDone; },
    set tourCompleted(v) { this.isTourDone = v; },

    startTour: function () {
      this.currentStep = 0; this.showTour = true;
      var self = this;
      setTimeout(function () { self.goToStep(0); }, 100);
    },
    nextStep: function () {
      var next = this.currentStep + 1;
      next < this.steps.length ? this.goToStep(next) : this.completeTour();
    },
    prevStep: function () { if (this.currentStep > 0) this.goToStep(this.currentStep - 1); },
    skipTour: function () { this.tourActiveCleanup(); this.showTour = false; },

    goToStep: function (index) {
      if (index < 0 || index >= this.steps.length) return;
      this.tourActiveCleanup();
      this.currentStep = index;
      var self = this;
      setTimeout(function () { self.tourScrollTo(index); self.tourHighlight(index); }, 100);
    },

    tourHighlight: function (index) {
      var el = document.getElementById('guide-step-' + index);
      if (!el) return;
      el.style.position = 'relative'; el.style.zIndex = '1000';
      el.style.boxShadow = '0 0 0 200vmax rgba(0,0,0,0.55)';
      el.style.outline = '3px solid #F7941D'; el.style.outlineOffset = '3px';
      el.style.borderRadius = '16px'; el.style.transition = 'box-shadow 0.4s ease, outline 0.4s ease';
    },
    tourActiveCleanup: function () {
      var old = document.getElementById('guide-step-' + this.currentStep);
      if (!old) return;
      old.style.position = ''; old.style.zIndex = ''; old.style.boxShadow = '';
      old.style.outline = ''; old.style.outlineOffset = ''; old.style.borderRadius = ''; old.style.transition = '';
    },
    tourScrollTo: function (index) {
      var el = document.getElementById('guide-step-' + index);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    completeTour: function () {
      this.tourActiveCleanup();
      this.isTourDone = true; this.showTour = false;
      try { localStorage.setItem('EzycoreGuide', 'true'); } catch (_) {}
      if (window.showToast) window.showToast('Selamat! Anda telah menyelesaikan tur panduan.', 'success');
    },
    resetTour: function () {
      this.isTourDone = false; try { localStorage.removeItem('EzycoreGuide'); } catch (_) {} this.startTour();
    },
    toggleFaq: function (index) { this.faqOpen = this.faqOpen === index ? null : index; }
  };
};
