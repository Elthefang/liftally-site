(function () {
  const voteEndpoint = document.body.dataset.voteEndpoint;
  const voteTopic = document.body.dataset.voteTopic || 'default';
  const voteTopicLabel = document.body.dataset.voteTopicLabel || voteTopic;
  const voteStatus = document.getElementById('voteStatus');
  const voteSuggestion = document.getElementById('voteSuggestion');
  const voteBoard = document.getElementById('voteBoard');
  const voteSection = document.getElementById('vote');
  const voteButtons = Array.from(document.querySelectorAll('[data-vote], [data-veto]'));
  const voteSlidein = document.getElementById('voteSlidein');
  const voteDismiss = document.getElementById('voteDismiss');
  const nameFlip = document.getElementById('nameFlip');

  if (!voteEndpoint || !voteBoard) return;

  const VOTE_CLIENT_ID_KEY = 'liftally_vote_client_id';
  const VOTE_SUBMITTED_KEY = `liftally_vote_submitted_${voteTopic}`;
  const VOTE_DISMISSED_KEY = `liftally_vote_dismissed_${voteTopic}`;
  const VOTE_RESULTS_CACHE_KEY = `liftally_vote_results_${voteTopic}`;
  let voteSubmitting = false;
  let slideinShown = false;
  let voteSectionVisible = false;

  function getAlreadyVotedMessage() {
    return `You already voted on ${voteTopicLabel} from this device.`;
  }

  function getDuplicateVoteMessage() {
    return `This vote was already recorded for ${voteTopicLabel}.`;
  }

  function trackEvent(name, category, label) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, {
      event_category: category,
      event_label: label
    });
  }

  function getVoteClientId() {
    let clientId = localStorage.getItem(VOTE_CLIENT_ID_KEY);
    if (clientId) return clientId;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      clientId = window.crypto.randomUUID();
    } else {
      clientId = `vote_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    localStorage.setItem(VOTE_CLIENT_ID_KEY, clientId);
    return clientId;
  }

  function hasSubmittedVote() {
    return localStorage.getItem(VOTE_SUBMITTED_KEY) === '1';
  }

  function setVoteStatus(message, isError) {
    if (!voteStatus) return;
    voteStatus.textContent = message;
    voteStatus.style.color = isError ? 'var(--error)' : 'var(--muted)';
  }

  function setVoteLocked(locked, message) {
    voteButtons.forEach((btn) => {
      btn.disabled = locked;
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    });
    if (voteSuggestion) {
      voteSuggestion.disabled = locked;
    }
    if (locked) {
      localStorage.setItem(VOTE_SUBMITTED_KEY, '1');
      setVoteStatus(message || getAlreadyVotedMessage());
    }
  }

  function setVoteBoardLoading(isLoading) {
    voteBoard.style.opacity = isLoading ? '0.72' : '1';
    voteBoard.style.transition = 'opacity 0.18s ease';
  }

  function readCachedResults() {
    try {
      const raw = localStorage.getItem(VOTE_RESULTS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeCachedResults(results) {
    try {
      localStorage.setItem(VOTE_RESULTS_CACHE_KEY, JSON.stringify(results));
    } catch (_) {
      // Ignore cache write failures.
    }
  }

  function createVoteRow(name, voteCount, vetoCount) {
    const row = document.createElement('div');
    row.className = 'vote-row';
    row.dataset.name = name;
    row.dataset.count = String(voteCount || 0);
    row.dataset.vetoCount = String(vetoCount || 0);

    row.innerHTML = `
      <div class="vote-veto">
        <button class="btn vote-btn veto" type="button" data-veto=""></button>
        <span class="vote-count veto-count">0</span>
      </div>
      <div class="vote-bar">
        <span class="vote-bar-fill left"></span>
        <span class="vote-bar-fill right"></span>
        <span class="vote-label"></span>
      </div>
      <div class="vote-actions">
        <span class="vote-count vote-main">0</span>
        <button class="btn btn-primary vote-btn" type="button" data-vote=""></button>
      </div>
    `;

    const voteBtn = row.querySelector('[data-vote]');
    const vetoBtn = row.querySelector('[data-veto]');
    const label = row.querySelector('.vote-label');

    if (voteBtn) {
      voteBtn.setAttribute('data-vote', name);
      voteBtn.textContent = 'Vote';
      voteBtn.disabled = hasSubmittedVote();
      voteBtn.setAttribute('aria-disabled', hasSubmittedVote() ? 'true' : 'false');
      voteBtn.addEventListener('click', () => sendVote(name, ''));
    }

    if (vetoBtn) {
      vetoBtn.setAttribute('data-veto', name);
      vetoBtn.textContent = 'Veto';
      vetoBtn.disabled = hasSubmittedVote();
      vetoBtn.setAttribute('aria-disabled', hasSubmittedVote() ? 'true' : 'false');
      vetoBtn.addEventListener('click', () => sendVote(`VETO:${name}`, ''));
    }

    if (label) {
      label.textContent = name;
    }

    return row;
  }

  function ensureVoteRow(name) {
    let row = Array.from(voteBoard.querySelectorAll('.vote-row'))
      .find((candidate) => candidate.dataset.name === name);
    if (row) return row;
    row = createVoteRow(name, 0, 0);
    voteBoard.appendChild(row);
    return row;
  }

  function addLocalCustomVoteRow(name) {
    const row = ensureVoteRow(name);
    row.dataset.count = '1';
    row.dataset.vetoCount = row.dataset.vetoCount || '0';
    renderVoteBoard(Array.from(voteBoard.querySelectorAll('.vote-row')));
  }

  function renderVoteBoard(rows) {
    const sorted = rows.slice().sort((a, b) => {
      const da = Number(a.dataset.count || 0);
      const db = Number(b.dataset.count || 0);
      return db - da;
    });

    sorted.forEach((row) => voteBoard.appendChild(row));

    const voteCounts = sorted.map((row) => Number(row.dataset.count || 0));
    const vetoCounts = sorted.map((row) => Number(row.dataset.vetoCount || 0));
    const max = Math.max(1, ...voteCounts, ...vetoCounts);

    sorted.forEach((row, index) => {
      const voteCount = voteCounts[index];
      const vetoCount = vetoCounts[index];
      const leftFill = row.querySelector('.vote-bar-fill.left');
      const rightFill = row.querySelector('.vote-bar-fill.right');
      const countEl = row.querySelector('.vote-count.vote-main');
      const vetoCountEl = row.querySelector('.vote-count.veto-count');

      if (leftFill) leftFill.style.transform = `scaleX(${vetoCount / max})`;
      if (rightFill) rightFill.style.transform = `scaleX(${voteCount / max})`;
      if (countEl) countEl.textContent = String(voteCount);
      if (vetoCountEl) vetoCountEl.textContent = String(vetoCount);
    });
  }

  function updateVoteBoard(results) {
    if (!results) return;
    Object.keys(results).forEach((key) => {
      if (!key || key.indexOf('VETO:') === 0) return;
      ensureVoteRow(key);
    });

    const rows = Array.from(voteBoard.querySelectorAll('.vote-row'));
    rows.forEach((row) => {
      const voteCount = Number(results[row.dataset.name] || 0);
      const vetoCount = Number(results[`VETO:${row.dataset.name}`] || 0);
      row.dataset.count = String(voteCount);
      row.dataset.vetoCount = String(vetoCount);
    });
    renderVoteBoard(rows);
  }

  function initVoteBoardFromData() {
    const rows = Array.from(voteBoard.querySelectorAll('.vote-row'));
    renderVoteBoard(rows);
  }

  async function refreshVoteBoard() {
    setVoteBoardLoading(true);
    try {
      const response = await fetch(`${voteEndpoint}?action=results&topic=${encodeURIComponent(voteTopic)}`, {
        method: 'GET',
        mode: 'cors'
      });
      const data = await response.json();
      if (data && data.results) {
        updateVoteBoard(data.results);
        writeCachedResults(data.results);
      }
    } catch (_) {
      // Ignore refresh errors; the board still has its initial static state.
    } finally {
      setVoteBoardLoading(false);
    }
  }

  async function sendVote(choice, suggestion) {
    if (voteSubmitting) return;
    if (hasSubmittedVote()) {
      setVoteLocked(true);
      return;
    }

    voteSubmitting = true;
    setVoteStatus('Submitting your vote...');

    const payload = {
      vote: String(choice),
      suggestion: String(suggestion || ''),
      source: 'landing',
      clientId: getVoteClientId(),
      topic: voteTopic
    };
    const body = JSON.stringify(payload);

    try {
      const response = await fetch(voteEndpoint, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body
      });

      const data = await response.json();

      if (data && data.result === 'duplicate') {
        setVoteLocked(true, getDuplicateVoteMessage());
        await refreshVoteBoard();
        return;
      }

      if (!response.ok || !data || data.result !== 'success') {
        throw new Error('Vote submission failed');
      }

      if (choice === 'custom' && suggestion) addLocalCustomVoteRow(suggestion);
      setVoteLocked(true, 'Thanks for voting!');
      trackEvent('vote_submit', 'vote', 'submit');
      await refreshVoteBoard();
    } catch (_) {
      try {
        await fetch(voteEndpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        if (choice === 'custom' && suggestion) addLocalCustomVoteRow(suggestion);
        setVoteLocked(true, 'Thanks for voting!');
        trackEvent('vote_submit', 'vote', 'submit');
        await refreshVoteBoard();
      } catch (fallbackError) {
        setVoteStatus('Could not submit. Please try again.', true);
      }
    } finally {
      voteSubmitting = false;
    }
  }

  document.querySelectorAll('[data-gtag="vote_click"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      trackEvent('vote_click', 'vote', 'vote_click');
    });
  });

  if (hasSubmittedVote()) {
    setVoteLocked(true);
  }

  if (voteSuggestion) {
    voteSuggestion.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const value = voteSuggestion.value.trim();
      if (!value) {
        setVoteStatus('Please enter a suggested name.', true);
        return;
      }
      sendVote('custom', value);
      voteSuggestion.value = '';
    });
  }

  document.querySelectorAll('[data-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.getAttribute('data-vote');
      if (!choice) return;
      sendVote(choice, '');
    });
  });

  document.querySelectorAll('[data-veto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-veto');
      if (!name) return;
      sendVote(`VETO:${name}`, '');
    });
  });

  if (nameFlip) {
    const words = ['Liftally', 'Liftally?', 'You name it!'];
    let index = 0;
    setInterval(() => {
      nameFlip.classList.remove('flip-in');
      nameFlip.classList.add('flip-out');
      setTimeout(() => {
        index = (index + 1) % words.length;
        nameFlip.textContent = words[index];
        nameFlip.classList.remove('flip-out');
        nameFlip.classList.add('flip-in');
      }, 260);
    }, 1500);
  }

  const cachedResults = readCachedResults();
  if (cachedResults) {
    updateVoteBoard(cachedResults);
  } else {
    setVoteBoardLoading(true);
  }

  function showVoteSlidein() {
    if (!voteSlidein) return;
    if (localStorage.getItem(VOTE_DISMISSED_KEY) === '1') return;
    if (voteSectionVisible || hasSubmittedVote()) return;
    voteSlidein.classList.add('show');
    slideinShown = true;
  }

  function hideVoteSlidein(persistDismissal) {
    if (!voteSlidein) return;
    voteSlidein.classList.remove('show');
    slideinShown = false;
    if (persistDismissal) {
      localStorage.setItem(VOTE_DISMISSED_KEY, '1');
    }
  }

  if (voteDismiss) {
    voteDismiss.addEventListener('click', () => hideVoteSlidein(true));
  }

  if ('IntersectionObserver' in window && voteSection) {
    const voteSectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        voteSectionVisible = entry.isIntersecting;
        if (voteSectionVisible) {
          hideVoteSlidein(false);
        }
      });
    }, { threshold: 0.2 });

    voteSectionObserver.observe(voteSection);
  }

  window.addEventListener('scroll', () => {
    if (slideinShown) return;
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    const progress = scrolled / total;
    if (progress >= 0.45) {
      showVoteSlidein();
    }
  }, { passive: true });

  initVoteBoardFromData();
  refreshVoteBoard();
}());
