(function () {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        // Cross-page navigation should always begin at the page top. Same-page
        // hash links retain their intended anchor behavior.
        const target = new URL(link.href, window.location.href);
        if (target.origin === window.location.origin
          && target.pathname !== window.location.pathname
          && !target.hash) {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
      });
    });
  }

  // Keep normal navigations deterministic while allowing browser back/forward
  // history to restore its prior position.
  window.addEventListener('pageshow', (event) => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const isHistoryRestore = event.persisted || navigation?.type === 'back_forward';
    if (!isHistoryRestore && !window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  });
}());
