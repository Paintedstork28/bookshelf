// ===== Book Detail Page Logic =====

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
}

async function loadBook() {
  const params = new URLSearchParams(window.location.search);
  const bookId = parseInt(params.get('id'));

  if (!bookId) {
    document.getElementById('book-detail').innerHTML = '<p>Book not found. <a href="index.html">Back to shelf</a></p>';
    return;
  }

  let books = [];
  const stored = localStorage.getItem('bookshelf_data');
  if (stored) {
    books = JSON.parse(stored).books || [];
  } else {
    try {
      const res = await fetch('data/books.json');
      const data = await res.json();
      books = data.books || [];
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  const book = books.find(b => b.id === bookId);
  if (!book) {
    document.getElementById('book-detail').innerHTML = '<p>Book not found. <a href="index.html">Back to shelf</a></p>';
    return;
  }

  document.title = `${book.title} — Bookshelf`;

  const review = book.review || book.reviewSpoilerFree || '';

  const container = document.getElementById('book-detail');
  container.innerHTML = `
    <a href="index.html" class="back-link">&larr; Back to Bookshelf</a>
    <div class="detail-header">
      <div class="detail-cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${book.title}" onerror="this.src=''; this.alt='No cover available'">`
          : '<div style="width:200px;height:300px;background:#f7f8fa;display:flex;align-items:center;justify-content:center;color:#97a3b6">No Cover</div>'}
      </div>
      <div class="detail-info">
        <h2>${book.title}</h2>
        <div class="author">by <span>${book.author}</span></div>
        <div class="meta-row">
          <span class="stars" style="font-size:1.2rem">${renderStars(book.rating)}</span>
          <span class="category-badge">${book.category}</span>
          ${(book.tags || []).map(t => `<span class="tag-badge">${t}</span>`).join('')}
        </div>
        <div class="date">Added ${new Date(book.dateAdded).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>

    ${review ? `
      <div class="review-section">
        <div class="review-header" onclick="toggleReview(this)">
          Review
          <span class="toggle">&#9660;</span>
        </div>
        <div class="review-body">${review}</div>
      </div>
    ` : ''}
  `;
}

function toggleReview(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.toggle');
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    toggle.innerHTML = '&#9660;';
  } else {
    body.classList.add('hidden');
    toggle.innerHTML = '&#9654;';
  }
}

document.addEventListener('DOMContentLoaded', loadBook);
