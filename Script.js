// VisaTracker - script.js (Google Sheets full integration)
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
  const exportCsvBtn = document.getElementById('export-csv');

  // Data
  let applicants = JSON.parse(localStorage.getItem('applicants')) || [];
  let editingIndex = -1;
  let currentPhotoBase64 = '';

  // ✅ Google Apps Script Web App URL (replace with your own if needed)
  const webAppUrl = "https://script.google.com/macros/s/AKfycbzzs8Qa6Cy05cOjkLJc1kJBu5n8YuRJAUyFui2dsqoLRN6ybr7sCgTY6cUNCaahnxCf/exec";

  // Helpers
  function showToast(text, bg = '#16a34a') {
    Toastify({ text, duration: 3000, gravity: 'top', position: 'right', style: { background: bg } }).showToast();
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
<td class="px-4 py-3">${app.photo ? `<img src="${app.photo}" class="photo-thumb">` : `<div class="photo-thumb bg-gray-100"></div>`}</td>
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
</td>`;
      tableBody.appendChild(tr);
    });
  }

  function formatNumber(v) { return isNaN(v) ? '0.00' : Number(v).toFixed(2); }
  function escapeHtml(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
  function persist() { localStorage.setItem('applicants', JSON.stringify(applicants)); }

  // Add/Edit Modal
  addBtn.addEventListener('click', () => {
    editingIndex = -1;
    modalTitle.textContent = 'Add Applicant';
    form.reset();
    currentPhotoBase64 = '';
    photoPreview.innerHTML = '';
    modal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
  cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

  // Photo preview
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) { currentPhotoBase64=''; photoPreview.innerHTML=''; return; }
    if(!file.type.startsWith('image/')) { showToast('Upload image file','#b91c1c'); photoInput.value=''; return; }
    if(file.size>2*1024*1024) { showToast('Image <2MB','#b91c1c'); photoInput.value=''; return; }
    const reader = new FileReader(); 
    reader.onload=()=>{ 
      currentPhotoBase64=reader.result; 
      photoPreview.innerHTML=`<img src="${currentPhotoBase64}" class="details-photo">`; 
    }; 
    reader.readAsDataURL(file);
  });

  // Passport & Mobile input validation
  document.getElementById('passport').addEventListener('input', e=>{
    let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(v.length>8)v=v.slice(0,8);
    e.target.value=v;
  });
  document.getElementById('mobile').addEventListener('input', e=>{
    e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,10);
  });

  // ✅ Submit (Add/Edit)
  form.addEventListener('submit', (e) => {
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

    if(!/^[A-Z0-9]{8}$/.test(passport)){ showToast('Passport must be 8 characters','#b91c1c'); return; }
    if(!/^[0-9]{10}$/.test(mobile)){ showToast('Mobile must be 10 digits','#b91c1c'); return; }

    const record={ name, passport, dob, address, mobile, jobProfile, status, advance, final: finalAmt, photo: currentPhotoBase64||'' };

    if(editingIndex>=0){
      // Edit
      const rowIndex = applicants[editingIndex].sheetRow || (editingIndex+2);
      fetch(webAppUrl,{
        method:"POST",
        body: JSON.stringify({ action:"edit", rowIndex, ...record })
      }).then(r=>r.json()).then(res=>{
        if(res.result==="success"){
          applicants[editingIndex]={...record,sheetRow: rowIndex};
          persist(); renderTable(); showToast('Applicant updated','#0ea5a2');
          modal.classList.add('hidden'); editingIndex=-1;
        } else showToast(res.message||'Error','#b91c1c');
      }).catch(err=>{ console.error(err); showToast('Error','#b91c1c'); });
    } else {
      // ✅ Add (fixed)
      fetch(webAppUrl,{
        method:"POST",
        body: JSON.stringify({ action:"add", ...record })
      })
      .then(r=>r.json())
      .then(res=>{
        if(res.result==="success"){
          record.sheetRow = applicants.length+2;
          applicants.push(record);
          persist(); renderTable();
          form.reset(); photoPreview.innerHTML=''; currentPhotoBase64='';
          modal.classList.add('hidden');
          showToast('Applicant added successfully','#16a34a');
        } else showToast(res.message||'Error','#b91c1c');
      })
      .catch(err=>{ console.error(err); showToast('Error connecting to Google Sheet','#b91c1c'); });
    }
  });

  // Edit/Delete/View
  window.editApplicant = function(idx){ 
    const a=applicants[idx]; if(!a) return; 
    editingIndex=idx; modalTitle.textContent='Edit Applicant'; 
    document.getElementById('name').value=a.name; 
    document.getElementById('passport').value=a.passport; 
    document.getElementById('dob').value=a.dob; 
    document.getElementById('address').value=a.address; 
    document.getElementById('mobile').value=a.mobile; 
    document.getElementById('jobProfile').value=a.jobProfile; 
    document.getElementById('status').value=a.status; 
    document.getElementById('advance').value=a.advance; 
    document.getElementById('final').value=a.final; 
    currentPhotoBase64=a.photo||''; 
    photoPreview.innerHTML=a.photo?`<img src="${a.photo}" class="details-photo">`:''; 
    modal.classList.remove('hidden'); 
  };

  window.deleteApplicant = function(idx){ 
    if(!confirm('Delete this applicant?')) return; 
    const rowIndex = applicants[idx].sheetRow || (idx+2); 
    fetch(webAppUrl,{ 
      method:"POST", 
      body:JSON.stringify({action:"delete", rowIndex}) 
    })
    .then(r=>r.json())
    .then(res=>{ 
      if(res.result==="success"){ 
        applicants.splice(idx,1); persist(); renderTable(); showToast('Deleted','#dc2626'); 
      } else showToast(res.message||'Error','#b91c1c'); 
    })
    .catch(err=>{ console.error(err); showToast('Error','#b91c1c'); }); 
  };

  window.viewApplicant = function(idx){ 
    const a=applicants[idx]; if(!a) return; 
    const age=calculateAge(a.dob); 
    const progress = a.status==='Visa Received'?100:
                     a.status==='Departure'?90:
                     a.status==='Visa In Process'?60:
                     a.status==='On Hold'?30:
                     a.status==='Visa Rejected'?10:0; 
    detailsContent.innerHTML=`<div class="flex gap-4 items-start">
      ${a.photo?`<img src="${a.photo}" class="details-photo">`:`<div class="details-photo bg-gray-100"></div>`}
      <div><h3 class="text-xl font-semibold mb-1">${escapeHtml(a.name)}</h3>
      <p><strong>Passport:</strong> ${escapeHtml(a.passport)}</p>
      <p><strong>Mobile:</strong> ${escapeHtml(a.mobile||'')}</p>
      <p><strong>Job Profile:</strong> ${escapeHtml(a.jobProfile||'')}</p>
      <p><strong>DOB:</strong> ${escapeHtml(a.dob||'')} (${age?age+' yrs':''})</p>
      <p><strong>Address:</strong> ${escapeHtml(a.address||'')}</p>
      <p><strong>Status:</strong> <span class="status-badge ${getStatusClass(a.status)}">${escapeHtml(a.status)}</span></p>
      <div class="progress-bar mt-2"><div class="progress-fill" style="width:${progress}%;"></div></div></div></div>
      <div class="mt-2"><p><strong>Advance:</strong> ₹${formatNumber(a.advance)}</p>
      <p><strong>Final:</strong> ₹${formatNumber(a.final)}</p>
      <p><strong>Total:</strong> ₹${formatNumber(a.advance+a.final)}</p></div>`;
    detailsModal.classList.remove('hidden'); 
  };

  closeDetails.addEventListener('click',()=>detailsModal.classList.add('hidden'));
  closeDetails2.addEventListener('click',()=>detailsModal.classList.add('hidden'));

  // Filters & CSV export
  function applyFilters(){ 
    const q=(searchInput.value||'').toLowerCase().trim(); 
    const f=filterSelect.value; 
    const filtered=applicants.filter(a=>((a.name||'').toLowerCase().includes(q)||(a.passport||'').toLowerCase().includes(q))&&(!f||a.status===f)); 
    renderTable(filtered); 
  }
  searchInput.addEventListener('input',applyFilters);
  filterSelect.addEventListener('change',applyFilters);

  exportCsvBtn.addEventListener('click',()=>{
    if(!applicants.length){showToast('No data','#b91c1c'); return;}
    const csv = Papa.unparse(applicants.map(a=>({
      name:a.name, passport:a.passport, mobile:a.mobile, jobProfile:a.jobProfile, 
      dob:a.dob, age:calculateAge(a.dob), address:a.address, 
      status:a.status, advance:a.advance, final:a.final
    })));
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'}); 
    const url=URL.createObjectURL(blob);
    const aTag=document.createElement('a'); 
    aTag.href=url; aTag.download='visatracker_applicants.csv'; 
    document.body.appendChild(aTag); aTag.click(); aTag.remove(); 
    URL.revokeObjectURL(url); showToast('CSV exported','#0ea5a2');
  });

  renderTable();
});
