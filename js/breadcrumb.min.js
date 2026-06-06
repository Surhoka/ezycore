window.renderBreadcrumb = function (pageNameOrItems, containerId = 'breadcrumb-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  let items = [];
  let title = '';

  if (Array.isArray(pageNameOrItems)) {
    items = pageNameOrItems;
    // Last item is usually the current page title
    const lastItem = items[items.length - 1];
    title = typeof lastItem === 'string' ? lastItem : lastItem.label;
  } else {
    title = pageNameOrItems;
    items = [
      { label: 'Home', link: '/' },
      { label: pageNameOrItems } // Current page
    ];
  }

  const breadcrumbItemsHtml = items.map((item, index) => {
    const isLast = index === items.length - 1;
    const label = typeof item === 'string' ? item : item.label;

    if (isLast) {
      return `<li class="text-sm text-gray-800 dark:text-white/90">${label}</li>`;
    }

    const linkAttr = item.action ? `href="javascript:void(0)" onclick="${item.action}"` : `href="${item.link || '#'}"`;

    return `
            <li>
              <a class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary" ${linkAttr}>
                ${label}
                <svg class="stroke-current" width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            </li>
        `;
  }).join('');

  container.innerHTML = `
      <div class="mb-2 flex items-center">
        <nav aria-label="Breadcrumb">
          <ol class="flex items-center gap-1.5">
            ${breadcrumbItemsHtml}
          </ol>
        </nav>
      </div>
    `;
};
