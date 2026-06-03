// ===== Landing Page Logic =====

let allBooks = [];
let allCategories = [];
let allTags = [];

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

function renderBooks() {
  const grid = document.getElementById('book-grid');
  const books = getFilteredBooks();

  if (books.length === 0) {
    grid.innerHTML = '<div class="empty-state">No books match your filters.</div>';
    return;
  }

  grid.innerHTML = books.map(book => `
    <a href="book.html?id=${book.id}" class="book-card">
      <div class="cover-wrap">
        ${book.cover
          ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-cover\\'>No Cover</div>'">`
          : '<div class="no-cover">No Cover</div>'}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(book.title)}</div>
        <div class="card-author">${escapeHtml(book.author)}</div>
        ${(book.tags || []).length > 0 ? `
          <div class="card-tags">
            ${book.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="card-category">${escapeHtml(book.category)}</span>
          <span class="stars">${renderStars(book.rating)}</span>
        </div>
      </div>
    </a>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  populateFilters();
  renderBooks();

  ['search-input', 'filter-category', 'filter-rating', 'filter-tag', 'sort-by'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener(id === 'search-input' ? 'input' : 'change', renderBooks);
  });
});
