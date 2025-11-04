// VisaTracker - script.js (WITH AUTHENTICATION - FIXED)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyG8chw4nBpFHKGbbzInDBC5ExoqF5oPKpdt3FpaTTnz9xOPFEQLCNro8tS3lSp7P5P/exec';

// Get auth token from sessionStorage
function getToken() {
  return sessionStorage.getItem('visa_token');
}

// Check if user is authenticated
function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Logout function
function logout() {
  sessionStorage.removeItem('visa_token');
  sessionStorage.removeItem('visa_username');
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication on page load
  if (!checkAuth()) {
    return;
  }

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
  const closeDetails = document.getElementById('close-details');
  const closeDetails2 = document.getElementById('close-details-2');

  const searchInput = document.getElementById('search');
  const filterSelect = document.getElementById('filter');
  const monthFilterSelect = document.getElementById('month-filter');
  const yearFilterSelect = document.getElementById('year-filter');
  const loadingIndicator = document.getElementById('loading-indicator');
  const exportCsvBtn = document.getElementById('export-csv');
  const logoutBtn = document.getElementById('logout-btn');

  let applicants = [];
  let editingIndex = -1;
  let editingRowIndex = -1;
  let currentPhotoBase64 = '';
  let existingPhotoBase64 = ''; // Store original photo for edit

  // Display username
  const username = sessionStorage.getItem('visa_username') || 'User';
  const usernameDisplay = document.getElementById('username-display');
  if (usernameDisplay) {
    usernameDisplay.textContent = username;
  }

  // Logout button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  function showToast(text, bg = '#16a34a') {
    Toastify({
      text,
      duration: 3000,
      gravity: 'top',
      position: 'right',
      style: { background: bg },
    }).showToast();
  }

  function showLoading(show) {
    if (show) {
      loadingIndicator.classList.remove('hidden');
    } else {
      loadingIndicator.classList.add('hidden');
    }
  }

  function getStatusClass(status) {
    if (status === 'Visa In Process') return 'status-in-process';
    if (status === 'Visa Received') return 'status-received';
    if (status === 'Departure') return 'status-departure';
    if (status === 'Visa Rejected') return 'status-rejected';
    if (status === 'On Hold') return 'status-on-hold';
    if (status === 'Withdrawn Application') return 'status-withdrawn';
    return 'status-on-hold';
  }

  function calculateAge(dob) {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return isNaN(age) ? '' : age;
  }

  // Format date to YYYY-MM-DD
  function formatDate(dateValue) {
    if (!dateValue) return '';
    const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle auth errors
  function handleAuthError(result) {
    if (result.code === 'AUTH_REQUIRED' || result.message === 'Unauthorized') {
      showToast('Session expired. Please login again.', '#b91c1c');
      setTimeout(() => logout(), 1500);
      return true;
    }
    return false;
  }

  // Load data with authentication
  async function loadData() {
    try {
      showLoading(true);
      showToast('Loading data...', '#0ea5a2');
      
      const token = getToken();
      if (!token) {
        logout();
        return;
      }
      
      const month = monthFilterSelect.value;
      const year = yearFilterSelect.value;
      
      // Build URL with filters and token
      let url = SCRIPT_URL;
      const params = [`token=${encodeURIComponent(token)}`];
      
      if (month !== 'all') {
        params.push(`month=${month}`);
      }
      
      if (year) {
        params.push(`year=${year}`);
      }
      
      url += '?' + params.join('&');
      
      console.log('Loading from:', url);
      const startTime = performance.now();
      
      const response = await fetch(url);
      const data = await response.json();
      
      const loadTime = performance.now() - startTime;
      console.log(`Data loaded in ${loadTime.toFixed(0)}ms`);
      
      if (data.result === 'success') {
        applicants = data.applicants.map((row, idx) => ({
          rowIndex: idx + 2,
          timestamp: row[0],
          name: row[1] || '',
          passport: row[2] || '',
          mobile: row[3] || '',
          jobProfile: row[4] || '',
          dob: row[5] || '',
          address: row[6] || '',
          status: row[7] || '',
          advance: Number(row[8]) || 0,
          final: Number(row[9]) || 0,
          photo: row[10] || ''
        }));
        
        renderTable();
        
        const monthName = month === 'all' ? 'All months' : new Date(2025, month - 1).toLocaleString('default', { month: 'long' });
        showToast(`Loaded ${applicants.length} applicants (${monthName} ${year})`, '#16a34a');
      } else {
        if (handleAuthError(data)) return;
        showToast('Error: ' + data.message, '#b91c1c');
      }
    } catch (error) {
      console.error('Load error:', error);
      showToast('Failed to load data', '#b91c1c');
    } finally {
      showLoading(false);
    }
  }

  // Batch render for smoother performance
  function renderTable(filtered = applicants) {
    tableBody.innerHTML = '';
    
    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="10" class="px-4 py-6 text-center text-gray-500">No applicants found</td></tr>`;
      return;
    }

    const batchSize = 10;
    let currentIndex = 0;

    function renderBatch() {
      const endIndex = Math.min(currentIndex + batchSize, filtered.length);
      
      for (let i = currentIndex; i < endIndex; i++) {
        const app = filtered[i];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        const age = calculateAge(app.dob);
        
        tr.innerHTML = `
          <td class="px-4 py-3">
            ${app.photo ? `<img src="${app.photo}" class="photo-thumb" alt="photo">` : `<div class="photo-thumb bg-gray-100"></div>`}
          </td>
          <td class="px-4 py-3">${escapeHtml(app.name)}</td>
          <td class="px-4 py-3 font-mono">${escapeHtml(app.passport)}</td>
          <td class="px-4 py-3">${escapeHtml(app.mobile || '')}</td>
          <td class="px-4 py-3">${escapeHtml(app.jobProfile || '')}</td>
          <td class="px-4 py-3">${age}</td>
          <td class="px-4 py-3"><span class="status-badge ${getStatusClass(app.status)}">${escapeHtml(app.status)}</span></td>
          <td class="px-4 py-3">₹${formatNumber(app.advance)}</td>
          <td class="px-4 py-3">₹${formatNumber(app.final)}</td>
          <td class="px-4 py-3 table-actions">
            <button class="px-2 py-1 bg-blue-600 text-white rounded" onclick="viewApplicant(${i})">View</button>
            <button class="px-2 py-1 bg-yellow-500 text-white rounded" onclick="editApplicant(${i})">Edit</button>
            <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteApplicant(${i})">Delete</button>
          </td>
        `;
        
        tableBody.appendChild(tr);
      }
      
      currentIndex = endIndex;
      
      if (currentIndex < filtered.length) {
        requestAnimationFrame(renderBatch);
      }
    }
    
    renderBatch();
  }

  function formatNumber(v) {
    if (v === undefined || v === null || isNaN(v)) return '0.00';
    return Number(v).toFixed(2);
  }

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  addBtn.addEventListener('click', () => {
    editingIndex = -1;
    editingRowIndex = -1;
    modalTitle.textContent = 'Add Applicant';
    form.reset();
    currentPhotoBase64 = '';
    existingPhotoBase64 = '';
    photoPreview.innerHTML = '';
    photoInput.value = '';
    modal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      currentPhotoBase64 = existingPhotoBase64; // Revert to existing if cleared
      if (existingPhotoBase64) {
        photoPreview.innerHTML = `<img src="${existingPhotoBase64}" class="details-photo" alt="preview">`;
      } else {
        photoPreview.innerHTML = '';
      }
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
      currentPhotoBase64 = reader.result;
      photoPreview.innerHTML = `<img src="${currentPhotoBase64}" class="details-photo" alt="preview">`;
    };
    reader.readAsDataURL(file);
  });

  const passportInput = document.getElementById('passport');
  passportInput.addEventListener('input', (e) => {
    let v = e.target.value.toUpperCase();
    v = v.replace(/[^A-Z0-9]/g, '');
    if (v.length > 8) v = v.slice(0, 8);
    e.target.value = v;
  });

  const mobileInput = document.getElementById('mobile');
  mobileInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      logout();
      return;
    }

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

    // Use currentPhotoBase64 if set, otherwise use existingPhotoBase64 (for edits without photo change)
    const photoToSend = currentPhotoBase64 || existingPhotoBase64;

    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('name', name);
    formData.append('passport', passport);
    formData.append('mobile', mobile);
    formData.append('jobProfile', jobProfile);
    formData.append('dob', dob);
    formData.append('address', address);
    formData.append('status', status);
    formData.append('advance', advance);
    formData.append('final', finalAmt);
    formData.append('photo', photoToSend);

    try {
      showToast('Saving...', '#0ea5a2');
      
      if (editingIndex >= 0) {
        formData.append('action', 'edit');
        formData.append('rowIndex', editingRowIndex);
      } else {
        formData.append('action', 'add');
      }
      
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: formData,
        redirect: 'follow'
      });
      
      const result = await response.json();
      
      if (result.result === 'success') {
        if (editingIndex >= 0) {
          showToast('Applicant updated successfully', '#0ea5a2');
        } else {
          showToast('Applicant added successfully', '#16a34a');
        }
        
        editingIndex = -1;
        editingRowIndex = -1;
        currentPhotoBase64 = '';
        existingPhotoBase64 = '';
        await loadData();
        form.reset();
        photoPreview.innerHTML = '';
        photoInput.value = '';
        modal.classList.add('hidden');
      } else {
        if (handleAuthError(result)) return;
        showToast('Error: ' + result.message, '#b91c1c');
      }
      
    } catch (error) {
      console.error('Save error:', error);
      showToast('Network error. Please check your connection.', '#b91c1c');
    }
  });

  window.editApplicant = function (index) {
    const a = applicants[index];
    if (!a) return;
    
    editingIndex = index;
    editingRowIndex = a.rowIndex;
    
    modalTitle.textContent = 'Edit Applicant';
    document.getElementById('name').value = a.name;
    document.getElementById('passport').value = a.passport;
    document.getElementById('mobile').value = a.mobile;
    document.getElementById('jobProfile').value = a.jobProfile;
    document.getElementById('address').value = a.address;
    document.getElementById('status').value = a.status;
    document.getElementById('advance').value = a.advance;
    document.getElementById('final').value = a.final;
    
    // Format DOB for input field
    const formattedDob = formatDate(a.dob);
    document.getElementById('dob').value = formattedDob;
    
    // Store existing photo
    existingPhotoBase64 = a.photo || '';
    currentPhotoBase64 = a.photo || '';
    
    // Show existing photo
    if (a.photo) {
      photoPreview.innerHTML = `<img src="${a.photo}" class="details-photo" alt="current photo">`;
    } else {
      photoPreview.innerHTML = '';
    }
    
    // Clear file input
    photoInput.value = '';
    
    modal.classList.remove('hidden');
  };

  window.deleteApplicant = async function (index) {
    if (!confirm('Delete this applicant?')) return;
    
    const token = getToken();
    if (!token) {
      logout();
      return;
    }
    
    const app = applicants[index];
    
    try {
      showToast('Deleting...', '#0ea5a2');
      
      const formData = new URLSearchParams();
      formData.append('action', 'delete');
      formData.append('token', token);
      formData.append('rowIndex', app.rowIndex);
      
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: formData,
        redirect: 'follow'
      });
      
      const result = await response.json();
      
      if (result.result === 'success') {
        showToast('Applicant deleted successfully', '#dc2626');
        await loadData();
      } else {
        if (handleAuthError(result)) return;
        showToast('Error deleting: ' + result.message, '#b91c1c');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Network error. Please try again.', '#b91c1c');
    }
  };

  window.viewApplicant = function (index) {
    const a = applicants[index];
    if (!a) return;
    const advance = Number(a.advance || 0);
    const final = Number(a.final || 0);
    const total = advance + final;
    
    const progress =
      a.status === 'Visa Received' ? 100 :
      a.status === 'Departure' ? 90 :
      a.status === 'Visa In Process' ? 60 :
      a.status === 'On Hold' ? 30 :
      a.status === 'Visa Rejected' ? 10 : 0;

    const age = calculateAge(a.dob);
    const formattedDob = formatDate(a.dob);

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
    detailsModal.classList.remove('hidden');
  };

  closeDetails.addEventListener('click', () => detailsModal.classList.add('hidden'));
  closeDetails2.addEventListener('click', () => detailsModal.classList.add('hidden'));

  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase().trim();
    const f = filterSelect.value;
    const filtered = applicants.filter(a => {
      const matchesQ = (a.name || '').toLowerCase().includes(q) || 
                       (a.passport || '').toLowerCase().includes(q) ||
                       (a.mobile || '').toLowerCase().includes(q);
      const matchesF = !f || a.status === f;
      return matchesQ && matchesF;
    });
    renderTable(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  filterSelect.addEventListener('change', applyFilters);
  
  monthFilterSelect.addEventListener('change', () => loadData());
  yearFilterSelect.addEventListener('change', () => loadData());

  exportCsvBtn.addEventListener('click', () => {
    if (!applicants.length) { showToast('No data to export', '#b91c1c'); return; }
    const csv = Papa.unparse(applicants.map(a => ({
      name: a.name,
      passport: a.passport,
      mobile: a.mobile,
      jobProfile: a.jobProfile,
      dob: formatDate(a.dob),
      age: calculateAge(a.dob),
      address: a.address,
      status: a.status,
      advance: a.advance,
      final: a.final,
      total: Number(a.advance || 0) + Number(a.final || 0)
    })));
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

  // Initial load
  loadData();
});