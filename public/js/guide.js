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
      {
        id: 1,
        title: 'Welcome to ScrewFast',
        description: 'Your one-stop solution for top-quality hardware tools, spare parts, and construction services. Let us walk you through everything you need to get started.',
        icon: 'star',
        illustration: 'wave'
      },
      {
        id: 2,
        title: 'Browse Products',
        description: 'Explore our extensive catalog of tools and spare parts. Use category filters and search to find exactly what you need for your project.',
        icon: 'shopping-bag',
        illustration: 'box'
      },
      {
        id: 3,
        title: 'Interactive Diagrams',
        description: 'View spare parts with our interactive hotspot technology. Hover or click on diagram points to see part details, pricing, and availability.',
        icon: 'grid',
        illustration: 'chart'
      },
      {
        id: 4,
        title: 'Easy Checkout',
        description: 'Add items to your cart, review your order, and complete payment in just a few clicks. We support multiple payment methods for your convenience.',
        icon: 'credit-card',
        illustration: 'document'
      },
      {
        id: 5,
        title: 'Track Orders',
        description: 'Monitor your orders in real-time from placement to delivery. Get notified at every step so you always know where your shipment is.',
        icon: 'truck',
        illustration: 'map'
      },
      {
        id: 6,
        title: 'Get Support',
        description: 'Our expert support team is available 24/7 to help with technical questions, order issues, or product recommendations. We are here for you.',
        icon: 'headset',
        illustration: 'chat'
      }
    ],
    features: [
      {
        title: 'Fast Delivery',
        description: 'Same-day delivery for local orders within city limits. Nationwide delivery in 2-4 business days.',
        icon: 'truck',
        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
      },
      {
        title: 'Quality Guaranteed',
        description: 'All products are 100% authentic with manufacturer warranty. We stand behind every item we sell.',
        icon: 'shield-check',
        color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
      },
      {
        title: 'Expert Support',
        description: 'Technical assistance from our team of certified professionals. Phone, email, and live chat available.',
        icon: 'headset',
        color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
      },
      {
        title: 'Best Price Guarantee',
        description: 'We match competitor pricing on identical items. Find a lower price and we will beat it.',
        icon: 'currency-dollar',
        color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
      }
    ],
    faqs: [
      {
        q: 'How do I create an account?',
        a: 'Click the profile icon in the top menu and select "Sign Up". Fill in your details and verify your email address to get started.'
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept bank transfers, credit/debit cards (Visa, Mastercard), e-wallets (GoPay, OVO, Dana), and COD for select areas.'
      },
      {
        q: 'How long does shipping take?',
        a: 'Local deliveries typically arrive within 24 hours. National shipping takes 2-4 business days depending on your location.'
      },
      {
        q: 'Can I return a product?',
        a: 'Yes, we offer a 14-day return policy for unused items in original packaging. Contact support to initiate a return.'
      }
    ],
    currentStep: 0,
    showTour: false,
    tourCompleted: false,
    faqOpen: null,

    init: function () {
      var saved = localStorage.getItem(STORAGE_KEY);
      this.tourCompleted = saved === 'true';
    },

    get progress() {
      return ((this.currentStep + 1) / this.steps.length) * 100;
    },

    get currentStepData() {
      return this.steps[this.currentStep] || this.steps[0];
    },

    get isFirstStep() {
      return this.currentStep === 0;
    },

    get isLastStep() {
      return this.currentStep === this.steps.length - 1;
    },

    startTour: function () {
      this.currentStep = 0;
      this.showTour = true;
      document.body.style.overflow = 'hidden';
    },

    nextStep: function () {
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++;
      } else {
        this.completeTour();
      }
    },

    prevStep: function () {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },

    skipTour: function () {
      this.showTour = false;
      document.body.style.overflow = '';
    },

    completeTour: function () {
      this.tourCompleted = true;
      this.showTour = false;
      document.body.style.overflow = '';
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

    goToStep: function (index) {
      if (index >= 0 && index < this.steps.length) {
        this.currentStep = index;
      }
    },

    toggleFaq: function (index) {
      this.faqOpen = this.faqOpen === index ? null : index;
    }
  };
};
