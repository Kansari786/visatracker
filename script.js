// =======================
// script.js - Full (drop-in) for VisaTracker
// =======================

// ---------- CONFIG ----------
const RAW_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8vSxqgHTn1RORtUw3EuFgCf9MgQx1zGeJAUgKTaIDciaAz5J2zvMH8FTD2FDOi5lN/exec';
const SCRIPT_URL = RAW_SCRIPT_URL.replace(/^\uFEFF/, '').trim(); // guard: BOM/invisible chars

// ---------- Helpers ----------
function getToken() { return sessionStorage.getItem('visa_token'); }
function getUsername() { return sessionStorage.getItem('visa_username') || 'User'; }
function checkAuth() { if (!getToken()) { window.location.href = 'login.html'; return false; } return true; }
function logout() { sessionStorage.removeItem('visa_token'); sessionStorage.removeItem('visa_username'); window.location.href = 'login.html'; }

function showToast(text, bg = '#16a34a') {
  if (typeof Toastify !== 'undefined') {
    Toastify({ text, duration: 3000, gravity: 'top', position: 'right', style: { background: bg } }).showToast();
  } else {
    alert(text);
  }
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNumber(v) {
  if (v === undefined || v === null || isNaN(v)) return '0.00';
  return Number(v).toFixed(2);
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const d = (dateValue instanceof Date) ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return '';
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function calculateAge(dob) {
  if (!dob) return '';
  const b = new Date(dob);
  if (isNaN(b.getTime())) return '';
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return isNaN(age) ? '' : age;
}

function getStatusClass(status) {
  const m = {
    'Visa In Process': 'status-in-process',
    'Visa Received': 'status-received',
    'Departure': 'status-departure',
    'Visa Rejected': 'status-rejected',
    'On Hold': 'status-on-hold',
    'Withdrawn Application': 'status-withdrawn'
  };
  return m[status] || 'status-on-hold';
}

// ---------- Network helpers ----------
async function postToScript(formData) {
  try {
    const url = new URL(SCRIPT_URL);
    console.log('POST to:', url.toString());
    const resp = await fetch(url.toString(), { method: 'POST', body: formData });
    console.log('POST status:', resp.status);
    const txt = await resp.text();
    console.log('POST body:', txt);
    let result;
    try { result = JSON.parse(txt); } catch (e) { result = { result: 'error', message: txt }; }
    return { status: resp.status, body: result };
  } catch (err) {
    console.error('postToScript exception:', err);
    throw err;
  }
}

async function fetchFromScript(paramsObj) {
  try {
    const url = new URL(SCRIPT_URL);
    Object.keys(paramsObj || {}).forEach(k => {
      if (paramsObj[k] !== undefined && paramsObj[k] !== null) url.searchParams.set(k, paramsObj[k]);
    });
    console.log('GET from:', url.toString());
    const resp = await fetch(url.toString());
    console.log('GET status:', resp.status);
    const txt = await resp.text();
    console.log('GET body:', txt);
    let data;
    try { data = JSON.parse(txt); } catch (e) { data = { result: 'error', message: txt }; }
    return { status: resp.status, body: data };
  } catch (err) {
    console.error('fetchFromScript exception:', err);
    throw err;
  }
}

// ---------- App state ----------
let applicants = []; // array of objects parsed from sheet rows
let editingIndex = -1; // index inside applicants[]
let editingRowIndex = -1; // actual sheet row index number
let newPhotoBase64 = ''; // temp store for uploaded image during edit/add
let keepExistingPhoto = ''; // store existing photo so edit without upload keeps it

// ---------- DOM binding (on ready) ----------
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

  // Basic UI elements (IDs expected in index.html)
  const addBtn = document.getElementById('add-applicant');
  const modal = document.getElementById('modal');
  const closeModalBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('cancel-btn');
  const form = document.getElementById('applicant-form');
  const tableBody = document.getElementById('table-body');
  const photoInput = document.getElementById('photo');
  const photoPreview = document.getElementById('photo-preview');
  const modalTitle = document.getElementById('modal-title');
  const detailsModal = document.getElementById('details-modal');
  const detailsContent = document.getElementById('details-content');
  const closeDetailsBtns = [document.getElementById('close-details'), document.getElementById('close-details-2')].filter(Boolean);
  const searchInput = document.getElementById('search');
  const filterSelect = document.getElementById('filter');
  const monthFilterSelect = document.getElementById('month-filter');
  const yearFilterSelect = document.getElementById('year-filter');
  const loadingIndicator = document.getElementById('loading-indicator');
  const exportCsvBtn = document.getElementById('export-csv');
  const logoutBtn = document.getElementById('logout-btn');
  const usernameDisplay = document.getElementById('username-display');

  if (usernameDisplay) usernameDisplay.textContent = getUsername();
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  function showLoading(show) { if (loadingIndicator) loadingIndicator.classList.toggle('hidden', !show); }

  // ---------- Load data ----------
  async function loadData() {
    try {
      showLoading(true);
      const token = getToken();
      if (!token) { logout(); return; }

      const params = { token };
      const month = monthFilterSelect ? monthFilterSelect.value : 'all';
      const year = yearFilterSelect ? yearFilterSelect.value : '';
      if (month && month !== 'all') params.month = month;
      if (year) params.year = year;

      const res = await fetchFromScript(params);
      if (res.status !== 200) {
        showToast('Server error: check console', '#b91c1c');
        return;
      }
      const data = res.body;
      if (data.result === 'success') {
        // data.applicants expected to be an array-of-arrays (sheet rows)
        const rows = data.applicants || [];
        applicants = rows.map((r, idx) => ({
          // sheet row indexes often start at 2 if header row present; backend should provide exact mapping - we'll store a rowIndex provided by backend in row._row or compute
          rowIndex: (r._row) ? r._row : (idx + 2),
          timestamp: r[0],
          name: r[1] || '',
          passport: r[2] || '',
          mobile: r[3] || '',
          jobProfile: r[4] || '',
          dob: r[5] || '',
          address: r[6] || '',
          status: r[7] || '',
          advance: Number(r[8]) || 0,
          final: Number(r[9]) || 0,
          photo: r[10] || ''
        }));
        renderTable();
        const monthName = (month === 'all') ? 'All months' : new Date(2025, (parseInt(month) || 1) - 1).toLocaleString('default', { month: 'long' });
        showToast(`Loaded ${applicants.length} applicants (${monthName} ${year || ''})`, '#16a34a');
      } else {
        const msg = data.message || 'Failed to load';
        if (/unauthor/i.test(msg)) { showToast('Session expired. Login again.', '#b91c1c'); setTimeout(logout, 900); return; }
        showToast('Error: ' + msg, '#b91c1c');
      }
    } catch (err) {
      console.error('loadData error:', err);
      showToast('Network error while loading data. Check console.', '#b91c1c');
    } finally {
      showLoading(false);
    }
  }

  // ---------- Render table ----------
  function renderTable(filtered = applicants) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="10" class="px-4 py-6 text-center text-gray-500">No applicants found</td></tr>`;
      return;
    }

    filtered.forEach((app, i) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';

      const age = calculateAge(app.dob);

      tr.innerHTML = `
        <td class="px-4 py-3">
          ${app.photo ? `<img src="${app.photo}" class="photo-thumb" alt="photo">` : `<div class="photo-thumb bg-gray-100"></div>`}
        </td>
        <td class="px-4 py-3">${escapeHtml(app.name)}</td>
        <td class="px-4 py-3 font-mono">${escapeHtml(app.passport)}</td>
        <td class="px-4 py-3">${escapeHtml(app.mobile)}</td>
        <td class="px-4 py-3">${escapeHtml(app.jobProfile)}</td>
        <td class="px-4 py-3">${age}</td>
        <td class="px-4 py-3"><span class="status-badge ${getStatusClass(app.status)}">${escapeHtml(app.status)}</span></td>
        <td class="px-4 py-3">₹${formatNumber(app.advance)}</td>
        <td class="px-4 py-3">₹${formatNumber(app.final)}</td>
        <td class="px-4 py-3 table-actions">
          <button class="px-2 py-1 bg-blue-600 text-white rounded" data-action="view" data-index="${i}">View</button>
          <button class="px-2 py-1 bg-yellow-500 text-white rounded" data-action="edit" data-index="${i}">Edit</button>
          <button class="px-2 py-1 bg-red-600 text-white rounded" data-action="delete" data-index="${i}">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // delegate actions
    tableBody.querySelectorAll('button').forEach(btn => {
      const act = btn.getAttribute('data-action');
      const idx = Number(btn.getAttribute('data-index'));
      if (act === 'view') btn.onclick = () => viewApplicant(idx);
      if (act === 'edit') btn.onclick = () => editApplicant(idx);
      if (act === 'delete') btn.onclick = () => deleteApplicant(idx);
    });
  }

  // ---------- Add / Edit flow ----------
  if (addBtn) addBtn.addEventListener('click', () => {
    editingIndex = -1;
    editingRowIndex = -1;
    newPhotoBase64 = '';
    keepExistingPhoto = '';
    if (modalTitle) modalTitle.textContent = 'Add Applicant';
    if (form) form.reset();
    if (photoPreview) photoPreview.innerHTML = '';
    if (modal) modal.classList.remove('hidden');
  });

  if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        newPhotoBase64 = '';
        photoPreview.innerHTML = keepExistingPhoto ? `<img src="${keepExistingPhoto}" class="details-photo" alt="current">` : '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', '#b91c1c');
        photoInput.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2 MB', '#b91c1c');
        photoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        newPhotoBase64 = reader.result;
        if (photoPreview) photoPreview.innerHTML = `<img src="${newPhotoBase64}" class="details-photo" alt="preview">`;
      };
      reader.readAsDataURL(file);
    });
  }

  // Passport upper & sanitize
  const passportInput = document.getElementById('passport');
  if (passportInput) {
    passportInput.addEventListener('input', (e) => {
      let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      e.target.value = v.length > 8 ? v.slice(0, 8) : v;
    });
  }
  // Mobile sanitize
  const mobileInput = document.getElementById('mobile');
  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
    });
  }

  // Submit add/edit
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      if (!token) { logout(); return; }

      const name = document.getElementById('name').value.trim();
      const passport = document.getElementById('passport').value.trim();
      const dob = document.getElementById('dob').value;
      const address = document.getElementById('address').value.trim();
      const mobile = document.getElementById('mobile').value.trim();
      const jobProfile = document.getElementById('jobProfile').value.trim();
      const status = document.getElementById('status').value;
      const advance = parseFloat(document.getElementById('advance').value) || 0;
      const finalAmt = parseFloat(document.getElementById('final').value) || 0;

      if (!/^[A-Z0-9]{8}$/.test(passport)) {
        showToast('Passport must be exactly 8 alphanumeric characters', '#b91c1c');
        return;
      }
      if (!/^[0-9]{10}$/.test(mobile)) {
        showToast('Enter a valid 10-digit mobile number', '#b91c1c');
        return;
      }

      const photoToSend = newPhotoBase64 || keepExistingPhoto || '';

      const fd = new URLSearchParams();
      fd.append('token', token);
      fd.append('action', editingIndex >= 0 ? 'edit' : 'add');
      fd.append('name', name);
      fd.append('passport', passport);
      fd.append('mobile', mobile);
      fd.append('jobProfile', jobProfile);
      fd.append('dob', dob);
      fd.append('address', address);
      fd.append('status', status);
      fd.append('advance', advance);
      fd.append('final', finalAmt);
      fd.append('photo', photoToSend);

      if (editingIndex >= 0) fd.append('rowIndex', editingRowIndex);

      showToast('Saving...', '#0ea5a2');
      const res = await postToScript(fd);
      const result = res.body;

      if (result.result === 'success') {
        showToast(editingIndex >= 0 ? 'Applicant updated successfully' : 'Applicant added successfully', '#16a34a');
        editingIndex = -1; editingRowIndex = -1; newPhotoBase64 = ''; keepExistingPhoto = '';
        form.reset(); if (photoPreview) photoPreview.innerHTML = '';
        if (modal) modal.classList.add('hidden');
        await loadData();
      } else {
        if (/unauthor/i.test(result.message || '')) { showToast('Session expired. Login again.', '#b91c1c'); setTimeout(logout, 900); return; }
        showToast('Save failed: ' + (result.message || 'Unknown'), '#b91c1c');
      }
    } catch (err) {
      console.error('save error:', err);
      showToast('Network error while saving. Check console.', '#b91c1c');
    }
  });

  // ---------- Edit / Delete / View handlers ----------
  window.editApplicant = function (index) {
    const a = applicants[index];
    if (!a) return;
    editingIndex = index;
    editingRowIndex = a.rowIndex;
    if (modalTitle) modalTitle.textContent = 'Edit Applicant';
    document.getElementById('name').value = a.name;
    document.getElementById('passport').value = a.passport;
    document.getElementById('mobile').value = a.mobile || '';
    document.getElementById('jobProfile').value = a.jobProfile || '';
    document.getElementById('address').value = a.address || '';
    document.getElementById('status').value = a.status || '';
    document.getElementById('advance').value = a.advance || '';
    document.getElementById('final').value = a.final || '';
    document.getElementById('dob').value = formatDate(a.dob) || '';

    keepExistingPhoto = a.photo || '';
    newPhotoBase64 = '';
    if (photoPreview) photoPreview.innerHTML = a.photo ? `<img src="${a.photo}" class="details-photo" alt="current">` : '';
    if (photoInput) photoInput.value = '';
    if (modal) modal.classList.remove('hidden');
  };

  window.deleteApplicant = async function (index) {
    const ok = confirm('Delete this applicant? This action cannot be undone.');
    if (!ok) return;
    try {
      const token = getToken(); if (!token) { logout(); return; }
      const app = applicants[index];
      const fd = new URLSearchParams();
      fd.append('action', 'delete');
      fd.append('token', token);
      fd.append('rowIndex', app.rowIndex);
      showToast('Deleting...', '#0ea5a2');
      const res = await postToScript(fd);
      if (res.body.result === 'success') {
        showToast('Applicant deleted', '#dc2626');
        await loadData();
      } else {
        showToast('Delete failed: ' + (res.body.message || 'Unknown'), '#b91c1c');
      }
    } catch (err) {
      console.error('delete error:', err);
      showToast('Network error while deleting. Check console.', '#b91c1c');
    }
  };

  window.viewApplicant = function (index) {
    const a = applicants[index];
    if (!a) return;
    const advance = Number(a.advance || 0);
    const final = Number(a.final || 0);
    const total = advance + final;
    const progress = a.status === 'Visa Received' ? 100 : a.status === 'Departure' ? 90 : a.status === 'Visa In Process' ? 60 : a.status === 'On Hold' ? 30 : a.status === 'Visa Rejected' ? 10 : 0;
    const age = calculateAge(a.dob);
    const formattedDob = formatDate(a.dob);
    if (detailsContent) {
      detailsContent.innerHTML = `
        <div class="flex gap-4 items-start">
          ${a.photo ? `<img src="${a.photo}" class="details-photo" alt="photo">` : `<div class="details-photo bg-gray-100"></div>`}
          <div>
            <h3 class="text-xl font-semibold mb-1">${escapeHtml(a.name)}</h3>
            <p class="text-sm"><strong>Passport:</strong> ${escapeHtml(a.passport)}</p>
            <p class="text-sm"><strong>Mobile:</strong> ${escapeHtml(a.mobile || '')}</p>
            <p class="text-sm"><strong>Job Profile:</strong> ${escapeHtml(a.jobProfile || '')}</p>
            <p class="text-sm"><strong>DOB:</strong> ${formattedDob} ${age ? '(' + age + ' years old)' : ''}</p>
            <p class="text-sm"><strong>Address:</strong> ${escapeHtml(a.address || '')}</p>
            <p class="text-sm mt-2"><strong>Status:</strong> <span class="status-badge ${getStatusClass(a.status)}">${escapeHtml(a.status)}</span></p>
            <div class="progress-bar mt-3"><div class="progress-fill" style="width: ${progress}%;"></div></div>
          </div>
        </div>
        <div class="mt-4 p-3 bg-gray-50 rounded">
          <h4 class="font-semibold mb-2">Payment Details</h4>
          <p class="text-sm"><strong>Advance Payment:</strong> ₹${formatNumber(advance)}</p>
          <p class="text-sm"><strong>Final Payment:</strong> ₹${formatNumber(final)}</p>
          <p class="text-sm font-semibold text-green-700 mt-1"><strong>Total Payment:</strong> ₹${formatNumber(total)}</p>
        </div>
      `;
    }
    if (detailsModal) detailsModal.classList.remove('hidden');
  };

  closeDetailsBtns.forEach(b => b.addEventListener('click', () => detailsModal.classList.add('hidden')));

  // ---------- Filters & search ----------
  function applyFilters() {
    const q = (searchInput && searchInput.value || '').toLowerCase().trim();
    const f = (filterSelect && filterSelect.value) || '';
    const filtered = applicants.filter(a => {
      const matchesQ = (a.name || '').toLowerCase().includes(q) ||
                       (a.passport || '').toLowerCase().includes(q) ||
                       (a.mobile || '').toLowerCase().includes(q);
      const matchesF = !f || a.status === f;
      return matchesQ && matchesF;
    });
    renderTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (filterSelect) filterSelect.addEventListener('change', applyFilters);
  if (monthFilterSelect) monthFilterSelect.addEventListener('change', () => loadData());
  if (yearFilterSelect) yearFilterSelect.addEventListener('change', () => loadData());

  // ---------- Export CSV ----------
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {
    if (!applicants.length) { showToast('No data to export', '#b91c1c'); return; }
    // Use Papa if available, otherwise simple CSV
    let csv;
    if (typeof Papa !== 'undefined') {
      csv = Papa.unparse(applicants.map(a => ({
        name: a.name, passport: a.passport, mobile: a.mobile, jobProfile: a.jobProfile,
        dob: formatDate(a.dob), age: calculateAge(a.dob), address: a.address,
        status: a.status, advance: a.advance, final: a.final, total: Number(a.advance || 0) + Number(a.final || 0)
      })));
    } else {
      const headers = ['name','passport','mobile','jobProfile','dob','age','address','status','advance','final','total'];
      const rows = applicants.map(a => [
        `"${(a.name||'').replace(/"/g,'""')}"`,
        `"${(a.passport||'').replace(/"/g,'""')}"`,
        `"${(a.mobile||'').replace(/"/g,'""')}"`,
        `"${(a.jobProfile||'').replace(/"/g,'""')}"`,
        `"${formatDate(a.dob)}"`,
        `"${calculateAge(a.dob)}"`,
        `"${(a.address||'').replace(/"/g,'""')}"`,
        `"${(a.status||'').replace(/"/g,'""')}"`,
        `${a.advance}`, `${a.final}`, `${Number(a.advance||0)+Number(a.final||0)}`
      ].join(','));
      csv = [headers.join(','), ...rows].join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const aTag = document.createElement('a');
    aTag.href = url;
    aTag.download = 'visatracker_applicants.csv';
    document.body.appendChild(aTag);
    aTag.click();
    aTag.remove();
    URL.revokeObjectURL(url);
    showToast('CSV exported', '#0ea5a2');
  });

  // ---------- Initial load ----------
  loadData();
}); // end DOMContentLoaded
