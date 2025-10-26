// VisaTracker - script.js (WITH DEBUGGING)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwppefXt4k5A7KPTHcSOSp6TOB3O-OqcQK8MJ1sajs2VrqUeM5MhPrb2o6jKznGpIpA/exec';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
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
  const exportCsvBtn = document.getElementById('export-csv');

  // Data
  let applicants = [];
  let editingIndex = -1;
  let editingRowIndex = -1;
  let currentPhotoBase64 = '';

  // Helpers
  function showToast(text, bg = '#16a34a') {
    Toastify({
      text,
      duration: 3000,
      gravity: 'top',
      position: 'right',
      style: { background: bg },
    }).showToast();
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

  // Load data from Google Sheets
  async function loadData() {
    try {
      showToast('Loading data...', '#0ea5a2');
      
      const monthFilter = monthFilterSelect.value;
      let url = SCRIPT_URL;
      
      if (monthFilter && monthFilter !== 'all') {
        const [month, year] = monthFilter.split('-');
        url += `?month=${month}&year=${year}`;
      }
      
      console.log('Loading from URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Received data:', data);
      
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
        showToast('Data loaded successfully', '#16a34a');
      } else {
        showToast('Error loading data: ' + data.message, '#b91c1c');
      }
    } catch (error) {
      console.error('Load error:', error);
      showToast('Failed to load data: ' + error.message, '#b91c1c');
    }
  }

  // Render table rows
  function renderTable(filtered = applicants) {
    tableBody.innerHTML = '';
    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="10" class="px-4 py-6 text-center text-gray-500">No applicants found</td></tr>`;
      return;
    }

    filtered.forEach((app, idx) => {
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
          <button class="px-2 py-1 bg-blue-600 text-white rounded" onclick="viewApplicant(${idx})">View</button>
          <button class="px-2 py-1 bg-yellow-500 text-white rounded" onclick="editApplicant(${idx})">Edit</button>
          <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteApplicant(${idx})">Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
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
    photoPreview.innerHTML = '';
    modal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      currentPhotoBase64 = '';
      photoPreview.innerHTML = '';
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

  // Submit handler with DETAILED LOGGING
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

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

    const record = {
      name, passport, mobile, jobProfile, dob, address,
      status, advance: Number(advance), final: Number(finalAmt),
      photo: currentPhotoBase64 || ''
    };

    try {
      showToast('Saving...', '#0ea5a2');
      
      if (editingIndex >= 0) {
        // EDIT mode
        record.action = 'edit';
        record.rowIndex = editingRowIndex;
        
        console.log('EDITING - Sending data:', {
          action: record.action,
          rowIndex: record.rowIndex,
          name: record.name
        });
        
        const response = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(record),
          redirect: 'follow'
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Edit result:', result);
        
        if (result.result === 'success') {
          showToast('Applicant updated successfully', '#0ea5a2');
          editingIndex = -1;
          editingRowIndex = -1;
        } else {
          console.error('Edit failed:', result.message);
          showToast('Error updating: ' + result.message, '#b91c1c');
          return;
        }
      } else {
        // ADD mode
        record.action = 'add';
        
        console.log('ADDING - Sending data:', {
          action: record.action,
          name: record.name
        });
        
        const response = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(record),
          redirect: 'follow'
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Add result:', result);
        
        if (result.result === 'success') {
          showToast('Applicant added successfully', '#16a34a');
        } else {
          console.error('Add failed:', result.message);
          showToast('Error adding: ' + result.message, '#b91c1c');
          return;
        }
      }

      await loadData();
      form.reset();
      photoPreview.innerHTML = '';
      currentPhotoBase64 = '';
      modal.classList.add('hidden');
      
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save: ' + error.message, '#b91c1c');
    }
  });

  window.editApplicant = function (index) {
    const a = applicants[index];
    if (!a) return;
    
    editingIndex = index;
    editingRowIndex = a.rowIndex;
    
    console.log('Opening edit for applicant:', {
      index: index,
      rowIndex: editingRowIndex,
      name: a.name
    });
    
    modalTitle.textContent = 'Edit Applicant';
    document.getElementById('name').value = a.name;
    document.getElementById('passport').value = a.passport;
    document.getElementById('dob').value = a.dob;
    document.getElementById('address').value = a.address;
    document.getElementById('mobile').value = a.mobile;
    document.getElementById('jobProfile').value = a.jobProfile;
    document.getElementById('status').value = a.status;
    document.getElementById('advance').value = a.advance;
    document.getElementById('final').value = a.final;
    currentPhotoBase64 = a.photo || '';
    photoPreview.innerHTML = a.photo ? `<img src="${a.photo}" class="details-photo">` : '';
    modal.classList.remove('hidden');
  };

  window.deleteApplicant = async function (index) {
    if (!confirm('Delete this applicant?')) return;
    
    const app = applicants[index];
    
    try {
      showToast('Deleting...', '#0ea5a2');
      
      console.log('Deleting row:', app.rowIndex);
      
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          rowIndex: app.rowIndex
        }),
        redirect: 'follow'
      });
      
      const result = await response.json();
      console.log('Delete result:', result);
      
      if (result.result === 'success') {
        showToast('Applicant deleted successfully', '#dc2626');
        await loadData();
      } else {
        showToast('Error deleting: ' + result.message, '#b91c1c');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Failed to delete: ' + error.message, '#b91c1c');
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

    detailsContent.innerHTML = `
      <div class="flex gap-4 items-start">
        ${a.photo ? `<img src="${a.photo}" class="details-photo" alt="photo">` : `<div class="details-photo bg-gray-100"></div>`}
        <div>
          <h3 class="text-xl font-semibold mb-1">${escapeHtml(a.name)}</h3>
          <p class="text-sm"><strong>Passport:</strong> ${escapeHtml(a.passport)}</p>
          <p class="text-sm"><strong>Mobile:</strong> ${escapeHtml(a.mobile || '')}</p>
          <p class="text-sm"><strong>Job Profile:</strong> ${escapeHtml(a.jobProfile || '')}</p>
          <p class="text-sm"><strong>DOB:</strong> ${escapeHtml(a.dob || '')} ${age ? '(' + age + ' years old)' : ''}</p>
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
      const matchesQ = (a.name || '').toLowerCase().includes(q) || (a.passport || '').toLowerCase().includes(q);
      const matchesF = !f || a.status === f;
      return matchesQ && matchesF;
    });
    renderTable(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  filterSelect.addEventListener('change', applyFilters);

  monthFilterSelect.addEventListener('change', () => {
    loadData();
  });

  exportCsvBtn.addEventListener('click', () => {
    if (!applicants.length) { showToast('No data to export', '#b91c1c'); return; }
    const csv = Papa.unparse(applicants.map(a => ({
      name: a.name,
      passport: a.passport,
      mobile: a.mobile,
      jobProfile: a.jobProfile,
      dob: a.dob,
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

  loadData();
});