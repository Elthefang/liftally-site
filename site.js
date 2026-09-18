(function () {
  if (document.querySelector('.app-faq-group')) document.body.classList.add('faq-page');

  document.querySelectorAll('[data-site-auth]').forEach((auth) => {
    const signIn = auth.querySelector('[data-site-sign-in]');
    const signOut = auth.querySelector('[data-site-sign-out]');
    const isNamedUser = (user) => Boolean(user && !user.isAnonymous && user.uid);
    const update = (user) => {
      const signedIn = isNamedUser(user);
      if (signIn) signIn.hidden = signedIn;
      if (signOut) signOut.hidden = !signedIn;
    };
    signIn?.addEventListener('click', () => { window.location.href = '/account'; });
    signOut?.addEventListener('click', async () => {
      if (!window.liftallyBackend?.signOut) return;
      signOut.disabled = true;
      try { await window.liftallyBackend.signOut(); } finally { signOut.disabled = false; }
    });
    update(window.liftallyBackend?.getCurrentUser?.() || null);
    window.addEventListener('liftally-backend-ready', () => update(window.liftallyBackend?.getCurrentUser?.() || null));
    window.addEventListener('liftally-auth-change', (event) => update(event.detail?.user || null));
  });

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  const helpItems = [
    { href: '/website-faq', title: 'Website FAQ' },
    { href: '/app-faq', title: 'App FAQ' },
    { href: '/request-access', title: 'Contact' }
  ];

  document.querySelectorAll('.site-nav .nav-links').forEach((links, navIndex) => {
    if (links.querySelector('.nav-help')) return;
    const contactLink = links.querySelector('a[href="/request-access"]');
    if (contactLink) contactLink.closest('li')?.remove();

    const helpItem = document.createElement('li');
    helpItem.className = 'nav-help';
    const menuId = `help-menu-${navIndex + 1}`;
    const toggle = document.createElement('button');
    toggle.className = 'nav-link nav-help-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-haspopup', 'menu');
    toggle.setAttribute('aria-label', 'Support menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menuId);
    toggle.textContent = 'Support';
    const menu = document.createElement('div');
    menu.className = 'help-menu';
    menu.id = menuId;
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    helpItems.forEach(({ href, title }) => {
      const link = document.createElement('a');
      link.href = href;
      link.className = 'help-menu__link';
      link.setAttribute('role', 'menuitem');
      if (window.location.pathname === href || (href === '/website-faq' && window.location.pathname === '/website-faq.html')) {
        link.setAttribute('aria-current', 'page');
      }
      link.innerHTML = `<strong>${title}</strong>`;
      menu.appendChild(link);
    });
    helpItem.append(toggle, menu);
    // Explorer keeps a mobile-only Download link inside the primary list.
    // Insert Support before that optional item so every route has the same
    // HOME → WEIGHT CLASS EXPLORER → SUPPORT order at every breakpoint.
    const mobileDownloadItem = links.querySelector('.nav-download-link')?.closest('li');
    if (mobileDownloadItem) links.insertBefore(helpItem, mobileDownloadItem);
    else links.appendChild(helpItem);

    const closeHelp = () => {
      helpItem.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    };
    const openHelp = () => {
      helpItem.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
    };
    toggle.addEventListener('click', () => {
      if (helpItem.classList.contains('is-open')) closeHelp();
      else openHelp();
    });
    toggle.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openHelp();
      menu.querySelector('a')?.focus();
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('a')];
      const index = items.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); closeHelp(); toggle.focus(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        items[next]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && helpItem.classList.contains('is-open')) {
        event.preventDefault();
        closeHelp();
        toggle.focus();
      }
    });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      closeHelp();
      navLinks?.classList.remove('open');
      navToggle?.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('click', (event) => {
      if (!helpItem.contains(event.target)) closeHelp();
    });
  });

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

  // FAQ pages share one accessible, single-column accordion implementation.
  document.querySelectorAll('.faq-page .faq-grid, .faq-page .app-faq-grid').forEach((grid, gridIndex) => {
    grid.classList.add('faq-accordion');
    [...grid.children].forEach((item, itemIndex) => {
      const heading = item.querySelector('h2, h3');
      const answer = item.querySelector('p');
      if (!heading || !answer || heading.querySelector('.faq-accordion__trigger')) return;
      const trigger = document.createElement('button');
      const answerId = `faq-answer-${gridIndex + 1}-${itemIndex + 1}`;
      trigger.type = 'button';
      trigger.className = 'faq-accordion__trigger';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', answerId);
      trigger.innerHTML = `<span>${heading.textContent.trim()}</span><span class="faq-accordion__icon" aria-hidden="true">+</span>`;
      heading.replaceChildren(trigger);
      heading.className = 'faq-accordion__heading';
      const answerWrap = document.createElement('div');
      answerWrap.className = 'faq-accordion__answer';
      answerWrap.id = answerId;
      answerWrap.setAttribute('role', 'region');
      answerWrap.setAttribute('aria-hidden', 'true');
      answerWrap.appendChild(answer);
      item.className = 'faq-accordion__item';
      item.appendChild(answerWrap);

      trigger.addEventListener('click', () => {
        const opening = trigger.getAttribute('aria-expanded') !== 'true';
        grid.querySelectorAll('.faq-accordion__trigger').forEach((other) => {
          const otherAnswer = document.getElementById(other.getAttribute('aria-controls'));
          other.setAttribute('aria-expanded', 'false');
          otherAnswer?.setAttribute('aria-hidden', 'true');
          otherAnswer?.style.setProperty('max-height', '0px');
          otherAnswer?.closest('.faq-accordion__item')?.classList.remove('is-open');
          const icon = other.querySelector('.faq-accordion__icon');
          if (icon) icon.textContent = '+';
        });
        if (!opening) return;
        trigger.setAttribute('aria-expanded', 'true');
        answerWrap.setAttribute('aria-hidden', 'false');
        answerWrap.style.setProperty('max-height', `${answerWrap.scrollHeight}px`);
        item.classList.add('is-open');
        trigger.querySelector('.faq-accordion__icon').textContent = '−';
      });
    });
  });

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
