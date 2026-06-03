// ===== Shared Utilities =====

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
}

function loadBookshelfData() {
  const stored = localStorage.getItem('bookshelf_data');
  if (stored) {
    const data = JSON.parse(stored);
    migrateBookData(data);
    return data;
  }
  return null;
}

async function fetchBookshelfData() {
  try {
    const res = await fetch('data/books.json');
    return await res.json();
  } catch (e) {
    console.error('Failed to load books data:', e);
    return { categories: [], tags: [], books: [] };
  }
}

function migrateBookData(data) {
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
  if (changed) {
    localStorage.setItem('bookshelf_data', JSON.stringify(data));
  }
}

function matchesSearch(book, search) {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    book.title.toLowerCase().includes(s) ||
    book.author.toLowerCase().includes(s) ||
    (book.category || '').toLowerCase().includes(s) ||
    (book.review || '').toLowerCase().includes(s) ||
    (book.tags || []).some(t => t.toLowerCase().includes(s))
  );
}
