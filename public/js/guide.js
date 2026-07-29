if (!window.guideData) {
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
      currentStep: 0, showTour: false, tourCompleted: false,

      init: function () {
        try { this.tourCompleted = localStorage.getItem('EzycoreGuide') === 'true'; } catch (_) { }
        window._guide = this;
      },

      progress() { return ((this.currentStep + 1) / this.steps.length) * 100; },
      currentStepData() { return this.steps[this.currentStep] || this.steps[0]; },
      isFirstStep() { return this.currentStep === 0; },
      isLastStep() { return this.currentStep === this.steps.length - 1; },

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

        var oldTip = el.querySelector('.guide-tip-card');
        if (oldTip) oldTip.remove();

        var titleRow = el.querySelector('.flex.items-center.gap-3.mb-4');
        if (!titleRow) {
          titleRow = el.querySelector(':scope > div');
        }
        if (!titleRow) return;

        titleRow.style.position = 'relative';
        titleRow.style.zIndex = '1000';
        titleRow.style.boxShadow = '0 0 0 200vmax rgba(0,0,0,0.55)';
        titleRow.style.outline = '3px solid #F7941D';
        titleRow.style.outlineOffset = '3px';
        titleRow.style.borderRadius = '12px';
        titleRow.style.transition = 'box-shadow 0.4s ease, outline 0.4s ease';

        var step = this.steps[index];
        var dotsHtml = '';
        var self = this;
        for (var i = 0; i < self.steps.length; i++) {
          dotsHtml += '<span class="inline-block w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ' +
            (i === index ? 'bg-orange-400 w-4' : 'bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500') +
            '" onclick="window._guide.goToStep(' + i + ')"></span>';
        }

        var tip = document.createElement('div');
        tip.className = 'guide-tip-card';
        tip.innerHTML = '<div class="guide-tip-arrow"></div>' +
          '<div class="p-4">' +
          '<div class="flex items-start gap-3">' +
          '<span class="w-6 h-6 shrink-0 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-500 text-xs font-bold">' + (index + 1) + '</span>' +
          '<p class="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">' + step.description + '</p>' +
          '</div>' +
          '<div class="flex items-center justify-between mt-3 pt-3 border-t border-orange-200 dark:border-orange-800/50">' +
          '<button onclick="window._guide.prevStep()" class="w-7 h-7 rounded-lg border border-neutral-300 dark:border-neutral-600 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"' + (index === 0 ? ' style="visibility:hidden"' : '') + '>' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>' +
          '</button>' +
          '<div class="flex items-center gap-1.5">' +
          '<span class="text-xs text-orange-500 dark:text-orange-400 font-medium shrink-0">Step ' + (index + 1) + '/' + self.steps.length + '</span>' +
          '<div class="flex gap-1">' + dotsHtml + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-1">' +
          '<button onclick="window._guide.nextStep()" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-400 hover:bg-orange-500 text-white text-xs font-semibold transition-colors">' +
          (index === self.steps.length - 1 ? 'Done' : 'Next') +
          '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>' +
          '</button>' +
          '<button onclick="window._guide.skipTour()" class="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" title="Skip">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
          '</div>' +
          '</div>' +
          '</div>';
        titleRow.parentNode.insertBefore(tip, titleRow.nextSibling);
      },
      tourActiveCleanup: function () {
        var old = document.getElementById('guide-step-' + this.currentStep);
        if (!old) return;
        var titleRow = old.querySelector('.flex.items-center.gap-3.mb-4');
        if (!titleRow) {
          titleRow = old.querySelector(':scope > div');
        }
        if (titleRow) {
          titleRow.style.position = '';
          titleRow.style.zIndex = '';
          titleRow.style.boxShadow = '';
          titleRow.style.outline = '';
          titleRow.style.outlineOffset = '';
          titleRow.style.borderRadius = '';
          titleRow.style.transition = '';
        }
        var tip = old.querySelector('.guide-tip-card');
        if (tip) tip.remove();
      },
      tourScrollTo: function (index) {
        var el = document.getElementById('guide-step-' + index);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },

      completeTour: function () {
        this.tourActiveCleanup();
        this.tourCompleted = true; this.showTour = false;
        try { localStorage.setItem('EzycoreGuide', 'true'); } catch (_) { }
        if (window.showToast) window.showToast('Selamat! Anda telah menyelesaikan tur panduan.', 'success');
      },
      resetTour: function () {
        this.tourCompleted = false; try { localStorage.removeItem('EzycoreGuide'); } catch (_) { } this.startTour();
      }
    };
  };
}
