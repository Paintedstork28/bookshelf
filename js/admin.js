// ===== Admin Page Logic =====

let data = { categories: [], tags: [], books: [] };
let _lastDeleted = null;
let _lastDeletedIndex = -1;
let _undoTimer = null;
const MAX_BACKUPS = 10;

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
  const confirmPass = document.getElementById('setup-confirm').value;
  const error = document.getElementById('auth-error');

  if (!user || !pass) { error.textContent = 'All fields are required.'; return; }
  if (pass.length < 6) { error.textContent = 'Password must be at least 6 characters.'; return; }
  if (pass !== confirmPass) { error.textContent = 'Passwords do not match.'; return; }

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
    migrateReviews();
  }
}

function migrateReviews() {
  let changed = false;
  data.books.forEach(book => {
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
  if (changed) saveData();
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

// --- Backup System ---
function createBackup(label) {
  const key = 'bookshelf_backup_' + Date.now();
  const backup = {
    label: label,
    timestamp: new Date().toISOString(),
    bookCount: data.books.length,
    data: JSON.parse(JSON.stringify(data))
  };
  localStorage.setItem(key, JSON.stringify(backup));
  pruneBackups();
}

function getBackups() {
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('bookshelf_backup_')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        backups.push({ key, ...val });
      } catch (e) { /* skip corrupt entries */ }
    }
  }
  backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return backups;
}

function pruneBackups() {
  const backups = getBackups();
  if (backups.length > MAX_BACKUPS) {
    backups.slice(MAX_BACKUPS).forEach(b => localStorage.removeItem(b.key));
  }
}

function restoreBackup(key) {
  const raw = localStorage.getItem(key);
  if (!raw) { showToast('Backup not found.'); return; }
  try {
    const backup = JSON.parse(raw);
    createBackup('Pre-restore');
    data = backup.data;
    saveData();
    renderAll();
    showToast('Backup restored.');
  } catch (e) {
    showToast('Failed to restore backup.');
  }
}

function downloadBackup(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const backup = JSON.parse(raw);
  const dateStr = new Date(backup.timestamp).toISOString().split('T')[0];
  const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookshelf-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function deleteBackup(key) {
  localStorage.removeItem(key);
  renderBackups();
  showToast('Backup deleted.');
}

function clearAllBackups() {
  const input = prompt('Type DELETE to confirm removing all backups:');
  if (input !== 'DELETE') return;
  getBackups().forEach(b => localStorage.removeItem(b.key));
  renderBackups();
  showToast('All backups cleared.');
}

function renderBackups() {
  const container = document.getElementById('backup-list');
  const backups = getBackups();

  if (backups.length === 0) {
    container.innerHTML = '<p style="color:#97a3b6;font-size:13px;">No backups yet. Backups are created automatically before destructive actions.</p>';
    return;
  }

  container.innerHTML = backups.map(b => {
    const date = new Date(b.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `
      <div class="backup-item">
        <div>
          <div class="backup-label">${b.label} &middot; ${dateStr}, ${timeStr}</div>
          <div class="backup-meta">${b.bookCount} book${b.bookCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="backup-actions">
          <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="restoreBackup('${b.key}')">Restore</button>
          <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;" onclick="downloadBackup('${b.key}')">Download</button>
          <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="deleteBackup('${b.key}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Toast (with optional undo) ---
function showToast(msg, undoCallback) {
  if (_undoTimer) clearTimeout(_undoTimer);
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  if (undoCallback) {
    toast.innerHTML = `<span>${msg}</span><button class="toast-undo" id="toast-undo-btn">Undo</button>`;
    toast.classList.add('show');
    document.getElementById('toast-undo-btn').addEventListener('click', () => {
      clearTimeout(_undoTimer);
      undoCallback();
      toast.classList.remove('show');
    });
    _undoTimer = setTimeout(() => {
      toast.classList.remove('show');
      // Finalize the delete — already removed from data, just clear undo state
      _lastDeleted = null;
      _lastDeletedIndex = -1;
    }, 8000);
  } else {
    toast.innerHTML = `<span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

// --- Render ---
function renderAll() {
  renderCategories();
  renderTags();
  renderBookList();
  renderBackups();
}

function renderCategories() {
  const list = document.getElementById('category-list');
  list.innerHTML = data.categories.map(cat => `
    <span class="item-chip">
      ${cat}
      <button class="remove-btn" onclick="removeCategory('${cat.replace(/'/g, "\\'")}')">&times;</button>
    </span>
  `).join('');
}

function renderTags() {
  const list = document.getElementById('tag-list');
  list.innerHTML = data.tags.map(tag => `
    <span class="item-chip">
      ${tag}
      <button class="remove-btn" onclick="removeTag('${tag.replace(/'/g, "\\'")}')">&times;</button>
    </span>
  `).join('');
}

function renderBookList() {
  const list = document.getElementById('admin-book-list');
  if (data.books.length === 0) {
    list.innerHTML = '<p style="color:#97a3b6;font-size:13px">No books yet. Add one below.</p>';
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
          <small id="cover-status" style="color:#97a3b6;font-size:0.75rem">Fill in title & author, then click Fetch Cover — or it auto-fetches when you tab out of Author.</small>
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
        <label>Review</label>
        <textarea id="bf-review">${isEdit ? (book.review || '') : ''}</textarea>
      </div>
      <input type="hidden" id="bf-id" value="${isEdit ? book.id : ''}">
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="cancelForm()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update Book' : 'Add Book'}</button>
      </div>
    </form>
  `;

  document.getElementById('book-form').addEventListener('submit', handleBookSubmit);
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

  if (!title) { status.textContent = 'Enter a title first.'; status.style.color = '#e74c3c'; return; }

  btn.disabled = true;
  btn.textContent = 'Searching...';
  status.textContent = 'Searching Open Library...';
  status.style.color = '#97a3b6';

  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await fetch(`https://openlibrary.org/search.json?q=${query}&limit=5&fields=isbn,cover_i,title,author_name`);
    const json = await res.json();

    if (json.docs && json.docs.length > 0) {
      const doc = json.docs[0];
      if (doc.cover_i) {
        coverInput.value = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        status.textContent = 'Cover found!';
        status.style.color = '#0fba68';
      } else if (doc.isbn && doc.isbn.length > 0) {
        coverInput.value = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
        status.textContent = 'Cover found via ISBN.';
        status.style.color = '#0fba68';
      } else {
        status.textContent = 'No cover found. You can paste a URL manually.';
        status.style.color = '#e74c3c';
      }
    } else {
      status.textContent = 'No results found. Try a different title/author or paste a URL manually.';
      status.style.color = '#e74c3c';
    }
  } catch (e) {
    console.error('Cover fetch error:', e);
    status.textContent = 'Failed to fetch. Check your internet connection.';
    status.style.color = '#e74c3c';
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
  if (!confirm(`Remove tag "${tag}"? It will be removed from all books.`)) return;
  createBackup('Before removing tag: ' + tag);
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

  // Create backup before delete
  createBackup('Before deleting: ' + book.title);

  // Soft-delete: remove from array but keep reference for undo
  const idx = data.books.findIndex(b => b.id === id);
  _lastDeleted = JSON.parse(JSON.stringify(book));
  _lastDeletedIndex = idx;
  data.books.splice(idx, 1);
  saveData();
  renderBookList();

  // Show toast with undo
  showToast(`"${book.title}" deleted.`, () => {
    // Undo: re-insert at original position
    if (_lastDeleted) {
      data.books.splice(_lastDeletedIndex, 0, _lastDeleted);
      saveData();
      renderBookList();
      _lastDeleted = null;
      _lastDeletedIndex = -1;
      showToast('Delete undone.');
    }
  });
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
    review: document.getElementById('bf-review').value.trim()
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
  const dateStr = new Date().toISOString().split('T')[0];
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookshelf-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported.');
}

function importData() {
  const mode = prompt('Import mode:\n\nType "replace" to replace all data\nType "merge" to add new books only');
  if (!mode || (mode !== 'replace' && mode !== 'merge')) {
    showToast('Import cancelled.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      // Validate structure
      if (!imported.books || !Array.isArray(imported.books) || !imported.categories || !Array.isArray(imported.categories)) {
        showToast('Invalid file: must have books and categories arrays.');
        return;
      }

      // Validate each book has required fields
      const invalid = imported.books.filter(b => !b.title || !b.author || !b.id);
      if (invalid.length > 0) {
        showToast(`Invalid file: ${invalid.length} book(s) missing title, author, or id.`);
        return;
      }

      if (!imported.tags) imported.tags = [];

      // Auto-backup before import
      createBackup('Pre-import');

      if (mode === 'replace') {
        data = imported;
      } else {
        // Merge: add books with new IDs, merge categories and tags
        const existingIds = new Set(data.books.map(b => b.id));
        let nextId = getNextId();
        imported.books.forEach(book => {
          if (!existingIds.has(book.id)) {
            data.books.push(book);
          } else {
            // ID conflict — assign new ID
            book.id = nextId++;
            data.books.push(book);
          }
        });
        // Merge categories and tags (no duplicates)
        imported.categories.forEach(c => {
          if (!data.categories.includes(c)) data.categories.push(c);
        });
        imported.tags.forEach(t => {
          if (!data.tags.includes(t)) data.tags.push(t);
        });
      }

      saveData();
      renderAll();
      showToast(`Data imported (${mode}). ${data.books.length} books total.`);
    } catch (err) {
      showToast('Failed to import file. Check the JSON format.');
    }
  };
  input.click();
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
