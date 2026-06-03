// ===== Landing Page Logic =====

let allBooks = [];
let allCategories = [];
let allTags = [];

function showSkeletons() {
  const grid = document.getElementById('book-grid');
  grid.innerHTML = Array.from({ length: 6 }, () => `
    <div class="book-card skeleton">
      <div class="cover-wrap"></div>
      <div class="card-body">
        <div class="skel-line skel-title"></div>
        <div class="skel-line skel-author"></div>
      </div>
    </div>
  `).join('');
}

async function loadData() {
  const data = loadBookshelfData() || await fetchBookshelfData();
  allBooks = data.books || [];
  allCategories = data.categories || [];
  allTags = data.tags || [];
}

function populateFilters() {
  const catSelect = document.getElementById('filter-category');
  const tagSelect = document.getElementById('filter-tag');

  allCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  allTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    tagSelect.appendChild(opt);
  });
}

function getFilteredBooks() {
  const search = document.getElementById('search-input').value;
  const category = document.getElementById('filter-category').value;
  const rating = document.getElementById('filter-rating').value;
  const tag = document.getElementById('filter-tag').value;
  const sort = document.getElementById('sort-by').value;

  let filtered = allBooks.filter(book => {
    if (!matchesSearch(book, search)) return false;
    if (category && book.category !== category) return false;
    if (rating && book.rating < parseInt(rating)) return false;
    if (tag && !(book.tags || []).includes(tag)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case 'title': return a.title.localeCompare(b.title);
      case 'rating': return b.rating - a.rating;
      case 'date': return new Date(b.dateAdded) - new Date(a.dateAdded);
      case 'author': return a.author.localeCompare(b.author);
      default: return 0;
    }
  });

  return filtered;
}

function truncateText(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen).trim() + '...';
}

function renderBooks() {
  const grid = document.getElementById('book-grid');
  const countEl = document.getElementById('book-count');
  const books = getFilteredBooks();

  countEl.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;

  if (allBooks.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      Your bookshelf is empty.
      <br><a href="admin.html">Add your first book</a>
    </div>`;
    return;
  }

  if (books.length === 0) {
    grid.innerHTML = '<div class="empty-state">No books match your filters.</div>';
    return;
  }

  grid.innerHTML = books.map(book => {
    const reviewSnippet = truncateText(book.review, 120);
    return `
    <a href="book.html?id=${book.id}" class="book-card">
      <div class="cover-wrap">
        ${book.cover
          ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-cover\\'>No Cover</div>'">`
          : '<div class="no-cover">No Cover</div>'}
        ${reviewSnippet ? `<div class="hover-overlay"><p>${escapeHtml(reviewSnippet)}</p></div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(book.title)}</div>
        <div class="card-author">${escapeHtml(book.author)}</div>
        <div class="card-meta">
          <span class="card-category">${escapeHtml(book.category)}</span>
          <span class="stars">${renderStars(book.rating)}</span>
        </div>
        ${(book.tags || []).length > 0 ? `
          <div class="card-tags">
            ${book.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </a>
  `}).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  showSkeletons();
  await loadData();
  populateFilters();
  renderBooks();

  ['search-input', 'filter-category', 'filter-rating', 'filter-tag', 'sort-by'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener(id === 'search-input' ? 'input' : 'change', renderBooks);
  });
});
