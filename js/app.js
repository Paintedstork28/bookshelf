// ===== Landing Page Logic =====

let allBooks = [];
let allCategories = [];
let allTags = [];

async function loadData() {
  const stored = localStorage.getItem('bookshelf_data');
  if (stored) {
    const data = JSON.parse(stored);
    // Migrate old spoiler/non-spoiler fields to single review
    let changed = false;
    (data.books || []).forEach(book => {
      if (book.reviewSpoilerFree || book.reviewSpoiler) {
        if (!book.review) {
          const parts = [book.reviewSpoilerFree, book.reviewSpoiler].filter(Boolean);
          book.review = parts.join('\n\n');
        }
        delete book.reviewSpoilerFree;
        delete book.reviewSpoiler;
        changed = true;
      }
    });
    if (changed) localStorage.setItem('bookshelf_data', JSON.stringify(data));
    allBooks = data.books || [];
    allCategories = data.categories || [];
    allTags = data.tags || [];
  } else {
    try {
      const res = await fetch('data/books.json');
      const data = await res.json();
      allBooks = data.books || [];
      allCategories = data.categories || [];
      allTags = data.tags || [];
    } catch (e) {
      console.error('Failed to load books data:', e);
      allBooks = [];
      allCategories = [];
      allTags = [];
    }
  }
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
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
  const search = document.getElementById('search-input').value.toLowerCase();
  const category = document.getElementById('filter-category').value;
  const rating = document.getElementById('filter-rating').value;
  const tag = document.getElementById('filter-tag').value;
  const sort = document.getElementById('sort-by').value;

  let filtered = allBooks.filter(book => {
    if (search && !book.title.toLowerCase().includes(search) && !book.author.toLowerCase().includes(search) && !(book.tags || []).some(t => t.toLowerCase().includes(search)) && !(book.review || book.reviewSpoilerFree || '').toLowerCase().includes(search) && !book.category.toLowerCase().includes(search)) return false;
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
          ? `<img src="${book.cover}" alt="${book.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'no-cover\\'>No Cover</div>'">`
          : '<div class="no-cover">No Cover</div>'}
      </div>
      <div class="card-body">
        <div class="card-title">${book.title}</div>
        <div class="card-author">${book.author}</div>
        ${(book.tags || []).length > 0 ? `
          <div class="card-tags">
            ${book.tags.map(t => `<span>${t}</span>`).join('')}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="card-category">${book.category}</span>
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
