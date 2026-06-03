// ===== Admin Page Logic =====

let data = { categories: [], tags: [], books: [] };

// --- Auth ---
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isCredentialsSet() {
  return localStorage.getItem('bookshelf_admin_user') !== null;
}

function isLoggedIn() {
  return sessionStorage.getItem('bookshelf_admin_logged_in') === 'true';
}

async function handleSetup(e) {
  e.preventDefault();
  const user = document.getElementById('setup-user').value.trim();
  const pass = document.getElementById('setup-pass').value;
  const confirm = document.getElementById('setup-confirm').value;
  const error = document.getElementById('auth-error');

  if (!user || !pass) { error.textContent = 'All fields are required.'; return; }
  if (pass.length < 6) { error.textContent = 'Password must be at least 6 characters.'; return; }
  if (pass !== confirm) { error.textContent = 'Passwords do not match.'; return; }

  const hashed = await hashPassword(pass);
  localStorage.setItem('bookshelf_admin_user', user);
  localStorage.setItem('bookshelf_admin_pass', hashed);
  sessionStorage.setItem('bookshelf_admin_logged_in', 'true');
  showAdmin();
}

async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const error = document.getElementById('auth-error');

  const storedUser = localStorage.getItem('bookshelf_admin_user');
  const storedPass = localStorage.getItem('bookshelf_admin_pass');
  const hashed = await hashPassword(pass);

  if (user !== storedUser || hashed !== storedPass) {
    error.textContent = 'Invalid username or password.';
    return;
  }

  sessionStorage.setItem('bookshelf_admin_logged_in', 'true');
  showAdmin();
}

function logout() {
  sessionStorage.removeItem('bookshelf_admin_logged_in');
  location.reload();
}

function showAuthForm() {
  const container = document.getElementById('auth-container');
  const adminContent = document.getElementById('admin-content');
  adminContent.style.display = 'none';

  if (!isCredentialsSet()) {
    container.innerHTML = `
      <div class="login-container">
        <h2>Set Up Admin</h2>
        <p class="info">Create your admin credentials. You'll use these to log in.</p>
        <form id="setup-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="setup-user" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="setup-pass" required>
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="setup-confirm" required>
          </div>
          <div id="auth-error" class="error"></div>
          <button type="submit" class="btn btn-primary">Create Account</button>
        </form>
      </div>`;
    document.getElementById('setup-form').addEventListener('submit', handleSetup);
  } else {
    container.innerHTML = `
      <div class="login-container">
        <h2>Admin Login</h2>
        <form id="login-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="login-user" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-pass" required>
          </div>
          <div id="auth-error" class="error"></div>
          <button type="submit" class="btn btn-primary">Log In</button>
        </form>
      </div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
  }
}

function showAdmin() {
  document.getElementById('auth-container').innerHTML = '';
  document.getElementById('admin-content').style.display = 'block';
  document.getElementById('logout-btn').style.display = 'inline';
  loadData();
  renderAll();
}

// --- Data ---
function loadData() {
  const stored = localStorage.getItem('bookshelf_data');
  if (stored) {
    data = JSON.parse(stored);
  } else {
    // Load will be async, trigger from init
  }
}

async function loadDataFromFile() {
  try {
    const res = await fetch('data/books.json');
    data = await res.json();
    if (!data.tags) data.tags = [];
    saveData();
  } catch (e) {
    console.error('Failed to load books.json:', e);
    data = { categories: [], tags: [], books: [] };
  }
}

function saveData() {
  localStorage.setItem('bookshelf_data', JSON.stringify(data));
}

function getNextId() {
  if (data.books.length === 0) return 1;
  return Math.max(...data.books.map(b => b.id)) + 1;
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- Render ---
function renderAll() {
  renderCategories();
  renderTags();
  renderBookList();
}

function renderCategories() {
  const list = document.getElementById('category-list');
  list.innerHTML = data.categories.map(cat => `
    <span class="item-chip">
      ${cat}
      <button class="remove-btn" onclick="removeCategory('${cat}')">&times;</button>
    </span>
  `).join('');
}

function renderTags() {
  const list = document.getElementById('tag-list');
  list.innerHTML = data.tags.map(tag => `
    <span class="item-chip">
      ${tag}
      <button class="remove-btn" onclick="removeTag('${tag}')">&times;</button>
    </span>
  `).join('');
}

function renderBookList() {
  const list = document.getElementById('admin-book-list');
  if (data.books.length === 0) {
    list.innerHTML = '<p style="color:#999;font-size:0.9rem">No books yet. Add one below.</p>';
    return;
  }
  list.innerHTML = data.books.map(book => `
    <div class="admin-book-item">
      <div class="book-info">
        ${book.cover ? `<img src="${book.cover}" alt="" onerror="this.style.display='none'">` : ''}
        <div>
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author} &middot; ${book.category} &middot; ${'&#9733;'.repeat(book.rating)}</div>
        </div>
      </div>
      <div class="book-actions">
        <button class="btn btn-secondary" onclick="editBook(${book.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteBook(${book.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderBookForm(book = null) {
  const container = document.getElementById('book-form-container');
  const isEdit = book !== null;

  container.innerHTML = `
    <h3>${isEdit ? 'Edit Book' : 'Add New Book'}</h3>
    <form class="book-form" id="book-form">
      <div class="form-row">
        <div>
          <label>Title *</label>
          <input type="text" id="bf-title" value="${isEdit ? book.title : ''}" required>
        </div>
        <div>
          <label>Author *</label>
          <input type="text" id="bf-author" value="${isEdit ? book.author : ''}" required>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Cover Image URL</label>
          <div style="display:flex;gap:0.5rem;align-items:center">
            <input type="url" id="bf-cover" value="${isEdit ? (book.cover || '') : ''}" placeholder="Auto-fetched from Open Library..." style="flex:1">
            <button type="button" class="btn btn-secondary" id="fetch-cover-btn" onclick="fetchCover()">Fetch Cover</button>
          </div>
          <small id="cover-status" style="color:#999;font-size:0.75rem">Fill in title & author, then click Fetch Cover — or it auto-fetches when you tab out of Author.</small>
        </div>
        <div>
          <label>Category *</label>
          <select id="bf-category" required>
            <option value="">Select...</option>
            ${data.categories.map(c => `<option value="${c}" ${isEdit && book.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Rating *</label>
          <select id="bf-rating" required>
            ${[1,2,3,4,5].map(r => `<option value="${r}" ${isEdit && book.rating === r ? 'selected' : ''}>${r} Star${r > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Tags</label>
          <div class="tag-checkboxes">
            ${data.tags.map(t => `
              <label>
                <input type="checkbox" value="${t}" ${isEdit && (book.tags || []).includes(t) ? 'checked' : ''}>
                ${t}
              </label>
            `).join('')}
          </div>
        </div>
      </div>
      <div>
        <label>Spoiler-Free Review</label>
        <textarea id="bf-review-free">${isEdit ? (book.reviewSpoilerFree || '') : ''}</textarea>
      </div>
      <div>
        <label>Spoiler Review</label>
        <textarea id="bf-review-spoiler">${isEdit ? (book.reviewSpoiler || '') : ''}</textarea>
      </div>
      <input type="hidden" id="bf-id" value="${isEdit ? book.id : ''}">
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="cancelForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update Book' : 'Add Book'}</button>
      </div>
    </form>
  `;

  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);
  // Auto-fetch cover when author field loses focus (if title is also filled)
  document.getElementById('bf-author').addEventListener('blur', () => {
    const title = document.getElementById('bf-title').value.trim();
    const author = document.getElementById('bf-author').value.trim();
    const cover = document.getElementById('bf-cover').value.trim();
    if (title && author && !cover) fetchCover();
  });
  container.scrollIntoView({ behavior: 'smooth' });
}

// --- Cover Fetch ---
async function fetchCover() {
  const title = document.getElementById('bf-title').value.trim();
  const author = document.getElementById('bf-author').value.trim();
  const coverInput = document.getElementById('bf-cover');
  const status = document.getElementById('cover-status');
  const btn = document.getElementById('fetch-cover-btn');

  if (!title) { status.textContent = 'Enter a title first.'; status.style.color = '#c0392b'; return; }

  btn.disabled = true;
  btn.textContent = 'Searching...';
  status.textContent = 'Searching Open Library...';
  status.style.color = '#999';

  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=5&fields=isbn,cover_i,title,author_name`);
    const json = await res.json();

    if (json.docs && json.docs.length > 0) {
      // Try cover_i first (direct cover ID), then ISBN
      const doc = json.docs[0];
      if (doc.cover_i) {
        coverInput.value = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        status.textContent = 'Cover found!';
        status.style.color = '#27ae60';
      } else if (doc.isbn && doc.isbn.length > 0) {
        coverInput.value = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
        status.textContent = 'Cover found via ISBN.';
        status.style.color = '#27ae60';
      } else {
        status.textContent = 'No cover found. You can paste a URL manually.';
        status.style.color = '#c0392b';
      }
    } else {
      status.textContent = 'No results found. Try a different title/author or paste a URL manually.';
      status.style.color = '#c0392b';
    }
  } catch (e) {
    console.error('Cover fetch error:', e);
    status.textContent = 'Failed to fetch. Check your internet connection.';
    status.style.color = '#c0392b';
  }

  btn.disabled = false;
  btn.textContent = 'Fetch Cover';
}

// --- Actions ---
function addCategory() {
  const input = document.getElementById('new-category');
  const val = input.value.trim();
  if (!val) return;
  if (data.categories.includes(val)) { showToast('Category already exists.'); return; }
  data.categories.push(val);
  saveData();
  renderCategories();
  input.value = '';
  showToast(`Category "${val}" added.`);
}

function removeCategory(cat) {
  if (!confirm(`Remove category "${cat}"? Books in this category won't be deleted.`)) return;
  data.categories = data.categories.filter(c => c !== cat);
  saveData();
  renderCategories();
  showToast(`Category "${cat}" removed.`);
}

function addTag() {
  const input = document.getElementById('new-tag');
  const val = input.value.trim();
  if (!val) return;
  if (data.tags.includes(val)) { showToast('Tag already exists.'); return; }
  data.tags.push(val);
  saveData();
  renderTags();
  input.value = '';
  showToast(`Tag "${val}" added.`);
}

function removeTag(tag) {
  if (!confirm(`Remove tag "${tag}"?`)) return;
  data.tags = data.tags.filter(t => t !== tag);
  data.books.forEach(b => { b.tags = (b.tags || []).filter(t => t !== tag); });
  saveData();
  renderTags();
  showToast(`Tag "${tag}" removed.`);
}

function showAddBookForm() {
  renderBookForm(null);
}

function editBook(id) {
  const book = data.books.find(b => b.id === id);
  if (!book) return;
  renderBookForm(book);
}

function deleteBook(id) {
  const book = data.books.find(b => b.id === id);
  if (!book) return;
  if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
  data.books = data.books.filter(b => b.id !== id);
  saveData();
  renderBookList();
  showToast(`"${book.title}" deleted.`);
}

function cancelForm() {
  document.getElementById('book-form-container').innerHTML = '';
}

function handleBookSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('bf-id').value;
  const selectedTags = Array.from(document.querySelectorAll('.tag-checkboxes input:checked')).map(cb => cb.value);

  const bookData = {
    id: id ? parseInt(id) : getNextId(),
    title: document.getElementById('bf-title').value.trim(),
    author: document.getElementById('bf-author').value.trim(),
    cover: document.getElementById('bf-cover').value.trim() || '',
    category: document.getElementById('bf-category').value,
    rating: parseInt(document.getElementById('bf-rating').value),
    tags: selectedTags,
    dateAdded: id ? (data.books.find(b => b.id === parseInt(id))?.dateAdded || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
    reviewSpoilerFree: document.getElementById('bf-review-free').value.trim(),
    reviewSpoiler: document.getElementById('bf-review-spoiler').value.trim()
  };

  if (id) {
    const idx = data.books.findIndex(b => b.id === parseInt(id));
    if (idx !== -1) data.books[idx] = bookData;
    showToast(`"${bookData.title}" updated.`);
  } else {
    data.books.push(bookData);
    showToast(`"${bookData.title}" added.`);
  }

  saveData();
  renderBookList();
  cancelForm();
}

// --- Export / Import ---
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'books.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported.');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.books || !imported.categories) {
        showToast('Invalid data file.');
        return;
      }
      if (!imported.tags) imported.tags = [];
      data = imported;
      saveData();
      renderAll();
      showToast('Data imported successfully.');
    } catch (err) {
      showToast('Failed to import file.');
    }
  };
  input.click();
}

function resetToFile() {
  if (!confirm('Reset all data to the original books.json? All admin changes will be lost.')) return;
  localStorage.removeItem('bookshelf_data');
  loadDataFromFile().then(() => {
    renderAll();
    showToast('Data reset to original.');
  });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  if (isLoggedIn()) {
    const stored = localStorage.getItem('bookshelf_data');
    if (!stored) {
      await loadDataFromFile();
    } else {
      loadData();
    }
    showAdmin();
  } else {
    showAuthForm();
  }
});
