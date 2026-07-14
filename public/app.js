/* ============================================================
   CineGuard – Frontend Application Logic
   ============================================================ */

const API = '';  // same origin

// ── Rating utilities ─────────────────────────────────────────
const RATING_ORDER = { 'None': 0, 'Mild': 1, 'Moderate': 2, 'Severe': 3, 'Unknown': 4 };
const RATING_EMOJI = { 'None': '🟢', 'Mild': '🟡', 'Moderate': '🟠', 'Severe': '🔴', 'Unknown': '⚪' };
const CATEGORY_ICONS = {
  nudity:      '🔞',
  violence:    '⚔️',
  profanity:   '🤬',
  alcohol:     '🍷',
  frightening: '😱',
};

function ratingClass(rating) {
  const map = { None: 'none', Mild: 'mild', Moderate: 'moderate', Severe: 'severe', Unknown: 'unknown' };
  return `rating-${map[rating] || 'unknown'}`;
}

function buildRatingBadge(rating) {
  const emoji = RATING_EMOJI[rating] || '⚪';
  return `<span class="rating-badge ${ratingClass(rating)}">${emoji} ${rating || 'Unknown'}</span>`;
}

function hide(el)   { el.hidden = true; }
function show(el)   { el.hidden = false; }
function openModalOverlay()  { detailModal.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
function closeModalOverlay() { detailModal.classList.remove('is-open'); document.body.style.overflow = ''; }

// ════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════
const tabSearch       = document.getElementById('tab-search');
const tabLetterboxd   = document.getElementById('tab-letterboxd');
const panelSearch     = document.getElementById('panel-search');
const panelLetterboxd = document.getElementById('panel-letterboxd');

function switchTab(activeTab, activePanel, inactiveTab, inactivePanel) {
  activeTab.classList.add('active');
  activeTab.setAttribute('aria-selected', 'true');
  activePanel.classList.add('active');
  show(activePanel);

  inactiveTab.classList.remove('active');
  inactiveTab.setAttribute('aria-selected', 'false');
  inactivePanel.classList.remove('active');
  hide(inactivePanel);
}

tabSearch.addEventListener('click', () => switchTab(tabSearch, panelSearch, tabLetterboxd, panelLetterboxd));
tabLetterboxd.addEventListener('click', () => switchTab(tabLetterboxd, panelLetterboxd, tabSearch, panelSearch));


// ════════════════════════════════════════════════════════════
// PANEL 1 – MOVIE SEARCH
// ════════════════════════════════════════════════════════════
const searchInput       = document.getElementById('search-input');
const searchBtn         = document.getElementById('search-btn');
const searchResultsList = document.getElementById('search-results-list');
const searchLoading     = document.getElementById('search-loading');
const searchError       = document.getElementById('search-error');
const searchErrorMsg    = document.getElementById('search-error-msg');
const guideCard         = document.getElementById('guide-card');
const guideLoading      = document.getElementById('guide-loading');

let searchDebounce;

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
searchBtn.addEventListener('click', doSearch);

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  // Clear previous state
  hide(guideCard);
  hide(searchError);
  hide(searchResultsList);
  show(searchLoading);

  try {
    const res = await fetch(`${API}/api/search?title=${encodeURIComponent(query)}`);
    const data = await res.json();
    hide(searchLoading);

    if (!res.ok || data.error) {
      showSearchError(data.error || 'Search failed. Please try again.');
      return;
    }

    if (!data.results || data.results.length === 0) {
      showSearchError('No results found. Try a different title.');
      return;
    }

    renderSearchResults(data.results);
  } catch (err) {
    hide(searchLoading);
    showSearchError('Server error: ' + err.message);
  }
}

function showSearchError(msg) {
  searchErrorMsg.textContent = msg;
  show(searchError);
}

function renderSearchResults(results) {
  searchResultsList.innerHTML = '';

  results.forEach(movie => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('role', 'option');

    const posterHTML = movie.poster
      ? `<img class="result-poster" src="${escHtml(movie.poster)}" alt="${escHtml(movie.title)}" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="result-poster-placeholder">🎬</div>`;

    item.innerHTML = `
      ${posterHTML}
      <div class="result-info">
        <div class="result-title">${escHtml(movie.title)}</div>
        <div class="result-meta">${escHtml(movie.year || '')}${movie.type ? ' · ' + escHtml(movie.type) : ''}</div>
        <div class="result-id">${escHtml(movie.imdbId)}</div>
      </div>
      <span class="result-arrow">→</span>
    `;

    item.addEventListener('click', () => loadParentalGuide(movie));
    searchResultsList.appendChild(item);
  });

  show(searchResultsList);
}

async function loadParentalGuide(movie) {
  hide(searchResultsList);
  hide(searchError);
  hide(guideCard);
  show(guideLoading);

  try {
    const res = await fetch(`${API}/api/parental-guide?imdbId=${encodeURIComponent(movie.imdbId)}`);
    const data = await res.json();
    hide(guideLoading);

    if (!res.ok || data.error) {
      showSearchError(data.error || 'Could not load parental guide.');
      return;
    }

    renderGuideCard(data, movie);
  } catch (err) {
    hide(guideLoading);
    showSearchError('Failed to fetch parental guide: ' + err.message);
  }
}

function renderGuideCard(data, movie) {
  // Poster
  const posterEl = document.getElementById('guide-poster');
  if (movie.poster) {
    posterEl.src = movie.poster;
    posterEl.alt = data.title || movie.title;
    posterEl.style.display = '';
  } else {
    posterEl.style.display = 'none';
  }

  // Title
  document.getElementById('guide-title').textContent = data.title || movie.title;
  document.getElementById('guide-imdb-link').href = data.imdbUrl || '#';
  document.getElementById('guide-pg-link').href = data.parentalGuideUrl || '#';

  // Quick rating badges
  const quickRatings = document.getElementById('quick-ratings');
  quickRatings.innerHTML = '';
  const cats = data.categories || {};
  Object.entries(cats).forEach(([key, cat]) => {
    const badge = document.createElement('span');
    badge.className = `quick-badge ${ratingClass(cat.rating)}`;
    badge.innerHTML = `${CATEGORY_ICONS[key] || '•'} <strong>${escHtml(cat.label)}</strong>: ${RATING_EMOJI[cat.rating] || '⚪'} ${escHtml(cat.rating)}`;
    quickRatings.appendChild(badge);
  });

  // Category cards
  const container = document.getElementById('categories-container');
  container.innerHTML = '';

  const order = ['nudity', 'violence', 'profanity', 'alcohol', 'frightening'];
  order.forEach(key => {
    const cat = cats[key];
    if (!cat) return;

    const card = document.createElement('div');
    card.className = `category-card ${key === 'nudity' ? 'nudity-card' : ''} rating-${(cat.rating || 'unknown').toLowerCase()}-card`;

    const descHTML = cat.descriptions && cat.descriptions.length > 0
      ? `<ul class="descriptions-list">${cat.descriptions.map(d =>
          `<li class="description-item"><span class="desc-bullet">▸</span> ${escHtml(d)}</li>`
        ).join('')}</ul>`
      : `<p class="no-descriptions">No scene descriptions available for this rating.</p>`;

    card.innerHTML = `
      <div class="category-header" role="button" tabindex="0" aria-expanded="${key === 'nudity' ? 'true' : 'false'}">
        <div class="category-label-group">
          <span class="category-icon">${CATEGORY_ICONS[key] || '•'}</span>
          <span class="category-label">${escHtml(cat.label)}</span>
          ${buildRatingBadge(cat.rating)}
        </div>
        <span class="category-chevron">▼</span>
      </div>
      <div class="category-body">
        ${descHTML}
      </div>
    `;

    // Auto-open nudity category
    if (key === 'nudity') card.classList.add('open');

    // Toggle expand
    const header = card.querySelector('.category-header');
    header.addEventListener('click', () => {
      card.classList.toggle('open');
      header.setAttribute('aria-expanded', card.classList.contains('open') ? 'true' : 'false');
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click(); }
    });

    container.appendChild(card);
  });

  show(guideCard);
}


// ════════════════════════════════════════════════════════════
// PANEL 2 – LETTERBOXD SORTER
// ════════════════════════════════════════════════════════════
const lbUrlInput          = document.getElementById('lb-url-input');
const lbFetchBtn          = document.getElementById('lb-fetch-btn');
const lbProgressSec       = document.getElementById('lb-progress-section');
const lbProgressBar       = document.getElementById('lb-progress-bar');
const lbProgressLabel     = document.getElementById('lb-progress-label');
const lbProgressCount     = document.getElementById('lb-progress-count');
const lbProgressMovie     = document.getElementById('lb-progress-movie');
const lbError             = document.getElementById('lb-error');
const lbErrorMsg          = document.getElementById('lb-error-msg');
const lbResults           = document.getElementById('lb-results');
const lbTableBody         = document.getElementById('lb-table-body');
const lbResultsTitle      = document.getElementById('lb-results-title');
const lbSaveBtn           = document.getElementById('lb-save-btn');
const lbSaveName          = document.getElementById('lb-save-name');
const lbSaveStatus        = document.getElementById('lb-save-status');
const savedListsContainer = document.getElementById('saved-lists-container');
const savedListsCount     = document.getElementById('saved-lists-count');

let allMovieData = [];
let activeFilter = 'all';
let currentListUrl = '';

// ── Saved Lists Sidebar ──────────────────────────────────
async function loadSavedLists() {
  try {
    const res  = await fetch(`${API}/api/saved-lists`);
    const data = await res.json();
    renderSavedLists(data.lists || []);
  } catch (_) {}
}

function renderSavedLists(lists) {
  savedListsCount.textContent = lists.length;
  if (!lists.length) {
    savedListsContainer.innerHTML = '<p class="sidebar-empty">No saved lists yet.<br>Sort a list and save it!</p>';
    return;
  }
  savedListsContainer.innerHTML = '';
  lists.forEach(lst => {
    const card = document.createElement('div');
    card.className = 'saved-list-card';
    const d = new Date(lst.savedAt);
    const dateStr = isNaN(d) ? '' : d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    card.innerHTML = `
      <div class="slc-name">${escHtml(lst.name)}</div>
      <div class="slc-meta">${lst.total} films &middot; ${dateStr}</div>
      <div class="slc-actions">
        <button class="slc-restore" data-id="${lst.id}">Load</button>
        <button class="slc-delete" data-id="${lst.id}" title="Delete">&#128465;</button>
      </div>
    `;
    card.querySelector('.slc-restore').addEventListener('click', () => {
      allMovieData = lst.movies;
      currentListUrl = lst.url || '';
      if (currentListUrl) lbUrlInput.value = currentListUrl;
      renderLetterboxdResults(allMovieData, currentListUrl);
    });
    card.querySelector('.slc-delete').addEventListener('click', async () => {
      if (!confirm(`Delete "${lst.name}"?`)) return;
      try {
        await fetch(`${API}/api/saved-lists/${lst.id}`, { method: 'DELETE' });
        loadSavedLists();
      } catch (_) {}
    });
    savedListsContainer.appendChild(card);
  });
}

// Save button
lbSaveBtn.addEventListener('click', async () => {
  const name = lbSaveName.value.trim() || 'My List';
  if (!allMovieData.length) { lbSaveStatus.textContent = '⚠️ Nothing to save'; return; }
  lbSaveBtn.disabled = true;
  lbSaveStatus.textContent = 'Saving…';
  try {
    const res = await fetch(`${API}/api/saved-lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, movies: allMovieData, url: currentListUrl }),
    });
    const data = await res.json();
    if (data.ok) {
      lbSaveStatus.textContent = '✅ Saved!';
      lbSaveName.value = '';
      loadSavedLists();
      setTimeout(() => { lbSaveStatus.textContent = ''; }, 3000);
    } else {
      lbSaveStatus.textContent = '❌ Error saving';
    }
  } catch (_) { lbSaveStatus.textContent = '❌ Error saving'; }
  lbSaveBtn.disabled = false;
});

// Load lists on tab click + on startup
document.getElementById('tab-letterboxd').addEventListener('click', loadSavedLists);
loadSavedLists();

lbFetchBtn.addEventListener('click', startLetterboxdFetch);
lbUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startLetterboxdFetch(); });


async function startLetterboxdFetch() {
  const url = lbUrlInput.value.trim();
  if (!url) return;

  // Reset UI
  hide(lbResults);
  hide(lbError);
  show(lbProgressSec);
  lbProgressBar.style.width = '0%';
  lbProgressLabel.textContent = 'Fetching movie list from Letterboxd…';
  lbProgressCount.textContent = '0 / 0';
  lbProgressMovie.textContent = '';
  allMovieData = [];
  currentListUrl = url;

  try {
    // Step 1: Get the list of films
    const listRes = await fetch(`${API}/api/letterboxd-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const listData = await listRes.json();

    if (!listRes.ok || listData.error) {
      showLbError(listData.error || 'Failed to fetch the Letterboxd list.');
      hide(lbProgressSec);
      return;
    }

    const films = listData.films;
    const total = films.length;

    if (total === 0) {
      showLbError('No films found in this list.');
      hide(lbProgressSec);
      return;
    }

    lbProgressLabel.textContent = `Fetching parental guides for ${total} films…`;
    lbProgressCount.textContent = `0 / ${total}`;

    // Step 2: Fetch parental guides (5 at a time in parallel)
    const results = [];
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < films.length; i += BATCH_SIZE) {
      const batch = films.slice(i, i + BATCH_SIZE);
      lbProgressMovie.textContent = `⏳ Fetching ${batch.length > 1 ? 'batch of ' + batch.length + ' films' : batch[0].title}...`;
      lbProgressCount.textContent = `${Math.min(i + BATCH_SIZE, total)} / ${total}`;
      lbProgressBar.style.width = `${Math.round((Math.min(i + BATCH_SIZE, total) / total) * 100)}%`;

      const batchPromises = batch.map(async (film) => {
        try {
          const guideRes = await fetch(`${API}/api/letterboxd-film-guide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: film.slug, title: film.title }),
          });
          return await guideRes.json();
        } catch (err) {
          return {
            slug: film.slug,
            title: film.title,
            error: 'Fetch failed',
            categories: { nudity: { label: 'Sex & Nudity', rating: 'Unknown', descriptions: [] } }
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    lbProgressCount.textContent = `${total} / ${total}`;
    lbProgressBar.style.width = '100%';
    lbProgressLabel.textContent = '✅ Done! Sorting results…';
    lbProgressMovie.textContent = '';

    allMovieData = results;

    await new Promise(r => setTimeout(r, 600));
    hide(lbProgressSec);
    renderLetterboxdResults(allMovieData, url);

  } catch (err) {
    hide(lbProgressSec);
    showLbError('Unexpected error: ' + err.message);
  }
}

function showLbError(msg) {
  lbErrorMsg.textContent = msg;
  show(lbError);
}

function sortedByNudity(movies) {
  return [...movies].sort((a, b) => {
    const ra = (a.categories?.nudity?.rating) || 'Unknown';
    const rb = (b.categories?.nudity?.rating) || 'Unknown';
    const diff = (RATING_ORDER[ra] ?? 4) - (RATING_ORDER[rb] ?? 4);
    if (diff !== 0) return diff;
    // Tiebreaker: highest IMDb rating on top
    const ia = a.imdbRating ?? -1;
    const ib = b.imdbRating ?? -1;
    return ib - ia;
  });
}

function renderLetterboxdResults(movies, listUrl) {
  const sorted = sortedByNudity(movies);

  lbResultsTitle.textContent = `${sorted.length} films sorted by Sex & Nudity`;
  lbTableBody.innerHTML = '';

  sorted.forEach((movie, i) => {
    renderTableRow(movie, i + 1);
  });

  show(lbResults);
  applyFilter(activeFilter);

  // Scroll to results
  lbResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTableRow(movie, rank) {
  const cats = movie.categories || {};
  const nudityRating    = cats.nudity?.rating    || 'Unknown';
  const violenceRating  = cats.violence?.rating  || 'Unknown';
  const profanityRating = cats.profanity?.rating || 'Unknown';

  const imdbRating = movie.imdbRating != null ? `⭐ ${movie.imdbRating.toFixed(1)}` : '—';
  const lbRating   = movie.lbRating   != null ? `🟢 ${movie.lbRating.toFixed(2)}` : '—';

  const tr = document.createElement('tr');
  tr.dataset.nudityRating = nudityRating;

  const imdbHref       = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : '#';
  const letterboxdHref = movie.slug   ? `https://letterboxd.com/film/${movie.slug}/`  : '#';

  tr.innerHTML = `
    <td class="row-number">${rank}</td>
    <td class="movie-cell">
      <a href="${letterboxdHref}" target="_blank" rel="noopener" class="movie-title-link">${escHtml(movie.title || movie.slug)}</a>
      ${movie.year ? `<div class="movie-year">${escHtml(String(movie.year))}</div>` : ''}
      ${movie.error ? `<div class="movie-year" style="color:#ff8a8a">⚠️ ${escHtml(movie.error)}</div>` : ''}
    </td>
    <td>${buildRatingBadge(nudityRating)}</td>
    <td>${buildRatingBadge(violenceRating)}</td>
    <td>${buildRatingBadge(profanityRating)}</td>
    <td class="rating-num">${movie.imdbId ? `<a href="${imdbHref}" target="_blank" rel="noopener" class="movie-title-link">${imdbRating}</a>` : imdbRating}</td>
    <td class="rating-num">${movie.slug ? `<a href="${letterboxdHref}" target="_blank" rel="noopener" class="movie-title-link">${lbRating}</a>` : lbRating}</td>
    <td>
      <button class="details-btn" data-slug="${escHtml(movie.slug || '')}">View All</button>
    </td>
  `;

  // Details button
  tr.querySelector('.details-btn').addEventListener('click', () => showMovieModal(movie));

  lbTableBody.appendChild(tr);
}

// ── Filter chips ─────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    applyFilter(activeFilter);
  });
});

function applyFilter(filter) {
  document.querySelectorAll('#lb-table-body tr').forEach(row => {
    if (filter === 'all' || row.dataset.nudityRating === filter) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ── Modal ─────────────────────────────────────────────────────
const detailModal   = document.getElementById('detail-modal');
const modalContent  = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');

function showMovieModal(movie) {
  const cats = movie.categories || {};
  const order = ['nudity', 'violence', 'profanity', 'alcohol', 'frightening'];
  const imdbHref = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/parentalguide` : '#';
  const lbHref   = movie.slug   ? `https://letterboxd.com/film/${movie.slug}/` : '#';

  let html = `
    <h2 id="modal-title" style="font-family:'DM Serif Display',serif;font-size:1.5rem;margin-bottom:0.5rem">${escHtml(movie.title || movie.slug)}</h2>
    <div style="display:flex;gap:0.5rem;margin-bottom:1.2rem;flex-wrap:wrap">
      ${movie.imdbId ? `<a href="${imdbHref}" target="_blank" rel="noopener" class="ext-link imdb-link">📽️ IMDb Parental Guide</a>` : ''}
      ${movie.slug   ? `<a href="${lbHref}"   target="_blank" rel="noopener" class="ext-link pg-link">🎞️ Letterboxd</a>` : ''}
    </div>
  `;

  order.forEach(key => {
    const cat = cats[key];
    if (!cat) return;
    const descHTML = cat.descriptions && cat.descriptions.length > 0
      ? `<ul class="descriptions-list">${cat.descriptions.map(d =>
          `<li class="description-item"><span class="desc-bullet">▸</span> ${escHtml(d)}</li>`
        ).join('')}</ul>`
      : `<p class="no-descriptions">No scene descriptions available.</p>`;

    html += `
      <div class="category-card ${key === 'nudity' ? 'nudity-card' : ''} rating-${(cat.rating||'unknown').toLowerCase()}-card open" style="margin-bottom:0.75rem">
        <div class="category-header" style="cursor:default">
          <div class="category-label-group">
            <span class="category-icon">${CATEGORY_ICONS[key] || '•'}</span>
            <span class="category-label">${escHtml(cat.label)}</span>
            ${buildRatingBadge(cat.rating)}
          </div>
        </div>
        <div class="category-body" style="max-height:none;border-top:1px solid rgba(255,255,255,0.06)">
          ${descHTML}
        </div>
      </div>
    `;
  });

  modalContent.innerHTML = html;
  openModalOverlay();
}

function closeModal() {
  closeModalOverlay();
}

modalCloseBtn.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });


// ── Utilities ─────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
