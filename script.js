// =======================
// FULL FIXED script.js  ✅
// =======================

// 1️⃣  GOOGLE SCRIPT URL  (no < or > symbols)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8vSxqgHTn1RORtUw3EuFgCf9MgQx1zGeJAUgKTaIDciaAz5J2zvMH8FTD2FDOi5lN/exec'.replace(/^\uFEFF/, '').trim();

// 2️⃣  Helper functions
function getToken() { return sessionStorage.getItem('visa_token'); }
function getUsername() { return sessionStorage.getItem('visa_username') || 'User'; }
function checkAuth() { if (!getToken()) { window.location.href = 'login.html'; return false; } return true; }
function logout() { sessionStorage.removeItem('visa_token'); sessionStorage.removeItem('visa_username'); window.location.href = 'login.html'; }

function showToast(text, bg = '#16a34a') {
  if (typeof Toastify !== 'undefined') {
    Toastify({ text, duration: 3000, gravity: 'top', position: 'right', style: { background: bg } }).showToast();
  } else { alert(text); }
}

function formatNumber(v) { return isNaN(v) ? '0.00' : Number(v).toFixed(2); }
function formatDate(d) { if (!d) return ''; const x = new Date(d); if (isNaN(x)) return ''; return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function calculateAge(dob) { if (!dob) return ''; const b = new Date(dob); if (isNaN(b)) return ''; const t = new Date(); let a = t.getFullYear()-b.getFullYear(); const m=t.getMonth()-b.getMonth(); if(m<0||(m===0&&t.getDate()<b.getDate()))a--; return a; }
function getStatusClass(s){return{'Visa In Process':'status-in-process','Visa Received':'status-received','Departure':'status-departure','Visa Rejected':'status-rejected','On Hold':'status-on-hold','Withdrawn Application':'status-withdrawn'}[s]||'status-on-hold';}

// 3️⃣  Global variables
let applicants = [];
let editingIndex = -1;
let editingRowIndex = -1;
let newPhotoBase64 = '';
let keepExistingPhoto = '';

// 4️⃣  When page loads
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;

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

  function showLoading(b){ if(loadingIndicator) loadingIndicator.classList.toggle('hidden',!b); }

  // 🔹 Load data
  async function loadData() {
    try {
      showLoading(true);
      const token = getToken();
      if (!token) { logout(); return; }

      const url = new URL(SCRIPT_URL);
      url.searchParams.set('token', token);
      const month = monthFilterSelect?.value || 'all';
      const year = yearFilterSelect?.value || '';
      if (month !== 'all') url.searchParams.set('month', month);
      if (year) url.searchParams.set('year', year);

      const resp = await fetch(url);
      const txt = await resp.text();
      console.log('GET status:', resp.status, 'body:', txt);
      let data;
      try { data = JSON.parse(txt); } catch { data = { result:'error', message: txt }; }

      if (data.result === 'success') {
        applicants = data.applicants.map((r, i) => ({
          rowIndex: i + 2, timestamp: r[0], name: r[1] || '', passport: r[2] || '',
          mobile: r[3] || '', jobProfile: r[4] || '', dob: r[5] || '',
          address: r[6] || '', status: r[7] || '', advance: Number(r[8]) || 0,
          final: Number(r[9]) || 0, photo: r[10] || ''
        }));
        renderTable();
        showToast('Loaded '+applicants.length+' applicants', '#16a34a');
      } else showToast('Error loading: '+(data.message||'unknown'), '#b91c1c');
    } catch(e){ console.error('loadData error',e); showToast('Network error while loading','#b91c1c'); }
    finally{ showLoading(false); }
  }

  // 🔹 Render table
  function renderTable(list = applicants) {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!list.length) { tableBody.innerHTML = `<tr><td colspan="10" class="px-4 py-6 text-center text-gray-500">No applicants found</td></tr>`; return; }

    list.forEach((a,i)=>{
      const tr=document.createElement('tr');
      tr.className='hover:bg-gray-50';
      tr.innerHTML=`
      <td class="px-4 py-3">${a.photo?`<img src="${a.photo}" class="photo-thumb">`:`<div class="photo-thumb bg-gray-100"></div>`}</td>
      <td class="px-4 py-3">${a.name}</td>
      <td class="px-4 py-3 font-mono">${a.passport}</td>
      <td class="px-4 py-3">${a.mobile}</td>
      <td class="px-4 py-3">${a.jobProfile}</td>
      <td class="px-4 py-3">${calculateAge(a.dob)}</td>
      <td class="px-4 py-3"><span class="status-badge ${getStatusClass(a.status)}">${a.status}</span></td>
      <td class="px-4 py-3">₹${formatNumber(a.advance)}</td>
      <td class="px-4 py-3">₹${formatNumber(a.final)}</td>
      <td class="px-4 py-3">
        <button class="bg-blue-600 text-white px-2 py-1 rounded" onclick="viewApplicant(${i})">View</button>
        <button class="bg-yellow-500 text-white px-2 py-1 rounded" onclick="editApplicant(${i})">Edit</button>
        <button class="bg-red-600 text-white px-2 py-1 rounded" onclick="deleteApplicant(${i})">Delete</button>
      </td>`;
      tableBody.appendChild(tr);
    });
  }

  // 🔹 Add Applicant
  if (addBtn) addBtn.onclick = () => { editingIndex=-1; editingRowIndex=-1; newPhotoBase64=''; keepExistingPhoto=''; modalTitle.textContent='Add Applicant'; form.reset(); photoPreview.innerHTML=''; modal.classList.remove('hidden'); };
  if (closeModalBtn) closeModalBtn.onclick = ()=>modal.classList.add('hidden');
  if (cancelBtn) cancelBtn.onclick = ()=>modal.classList.add('hidden');

  // 🔹 Photo upload preview
  if (photoInput) photoInput.onchange = e=>{
    const f=e.target.files[0]; if(!f){newPhotoBase64=''; photoPreview.innerHTML=keepExistingPhoto?`<img src="${keepExistingPhoto}" class="details-photo">`:''; return;}
    if(!f.type.startsWith('image/')){showToast('Upload image file','#b91c1c');return;}
    if(f.size>2*1024*1024){showToast('Image <2MB','#b91c1c');return;}
    const r=new FileReader(); r.onload=()=>{newPhotoBase64=r.result; photoPreview.innerHTML=`<img src="${newPhotoBase64}" class="details-photo">`;}; r.readAsDataURL(f);
  };

  // 🔹 FORM SUBMIT (Add/Edit) — FIXED VERSION
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) { logout(); return; }

    const name = document.getElementById('name').value.trim();
    const passport = document.getElementById('passport').value.trim().toUpperCase();
    const dob = document.getElementById('dob').value;
    const address = document.getElementById('address').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const jobProfile = document.getElementById('jobProfile').value.trim();
    const status = document.getElementById('status').value;
    const advance = parseFloat(document.getElementById('advance').value)||0;
    const finalAmt = parseFloat(document.getElementById('final').value)||0;
    const photoToSend = newPhotoBase64 || keepExistingPhoto || '';

    showToast('Saving...', '#0ea5a2');
    console.log('---- SUBMIT APPLICANT ----', {action:(editingIndex>=0?'edit':'add'), row:editingRowIndex, status, photoLength:photoToSend.length});

    const fd = new URLSearchParams({token, action:(editingIndex>=0?'edit':'add'), name, passport, mobile, jobProfile, dob, address, status, advance, final:finalAmt, photo:photoToSend});
    if(editingIndex>=0) fd.append('rowIndex', editingRowIndex);

    // First attempt
    try {
      const res = await fetch(SCRIPT_URL, { method:'POST', body: fd });
      const txt = await res.text(); console.log('POST(form) status:', res.status, 'body:', txt);
      let data; try{data=JSON.parse(txt);}catch{data={result:'error',message:txt};}
      if(data.result==='success'){ showToast('Saved successfully','#16a34a'); resetForm(); await loadData(); return; }
      console.warn('Form POST failed, trying JSON fallback', data);
    } catch (err) { console.warn('Form POST error', err); }

    // JSON fallback
    try {
      const payload = {token, action:(editingIndex>=0?'edit':'add'), name, passport, mobile, jobProfile, dob, address, status, advance, final:finalAmt, photo:photoToSend};
      if(editingIndex>=0) payload.rowIndex=editingRowIndex;
      const res2 = await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const txt2 = await res2.text(); console.log('POST(json) status:', res2.status, 'body:', txt2);
      let data2; try{data2=JSON.parse(txt2);}catch{data2={result:'error',message:txt2};}
      if(data2.result==='success'){ showToast('Updated successfully','#16a34a'); resetForm(); await loadData(); return; }
      showToast('Save failed: '+(data2.message||'Unknown'),'#b91c1c');
    } catch(err2){ console.error('JSON fallback error',err2); showToast('Network error saving','#b91c1c'); }

    function resetForm(){
      editingIndex=-1; editingRowIndex=-1; newPhotoBase64=''; keepExistingPhoto='';
      form.reset(); if(photoPreview) photoPreview.innerHTML=''; modal.classList.add('hidden');
    }
  });

  // 🔹 Edit
  window.editApplicant = i=>{
    const a=applicants[i]; if(!a)return;
    editingIndex=i; editingRowIndex=a.rowIndex; modalTitle.textContent='Edit Applicant';
    document.getElementById('name').value=a.name; document.getElementById('passport').value=a.passport;
    document.getElementById('mobile').value=a.mobile; document.getElementById('jobProfile').value=a.jobProfile;
    document.getElementById('address').value=a.address; document.getElementById('status').value=a.status;
    document.getElementById('advance').value=a.advance; document.getElementById('final').value=a.final;
    document.getElementById('dob').value=formatDate(a.dob);
    keepExistingPhoto=a.photo||''; newPhotoBase64='';
    photoPreview.innerHTML=a.photo?`<img src="${a.photo}" class="details-photo">`:''; modal.classList.remove('hidden');
  };

  // 🔹 Delete
  window.deleteApplicant = async i=>{
    if(!confirm('Delete this applicant?'))return;
    const token=getToken(); if(!token){logout();return;}
    const fd=new URLSearchParams({action:'delete',token,rowIndex:applicants[i].rowIndex});
    const res=await fetch(SCRIPT_URL,{method:'POST',body:fd});
    const txt=await res.text(); console.log('DELETE status:',res.status,txt);
    let d;try{d=JSON.parse(txt);}catch{d={result:'error',message:txt};}
    if(d.result==='success'){showToast('Deleted','#dc2626');await loadData();}else showToast('Delete failed','#b91c1c');
  };

  // 🔹 View
  window.viewApplicant=i=>{
    const a=applicants[i]; if(!a)return;
    const progress=a.status==='Visa Received'?100:a.status==='Departure'?90:a.status==='Visa In Process'?60:a.status==='On Hold'?30:a.status==='Visa Rejected'?10:0;
    detailsContent.innerHTML=`
      <div class="flex gap-4 items-start">
        ${a.photo?`<img src="${a.photo}" class="details-photo">`:`<div class="details-photo bg-gray-100"></div>`}
        <div>
          <h3 class="text-xl font-semibold mb-1">${a.name}</h3>
          <p><strong>Passport:</strong> ${a.passport}</p>
          <p><strong>Mobile:</strong> ${a.mobile}</p>
          <p><strong>Job:</strong> ${a.jobProfile}</p>
          <p><strong>DOB:</strong> ${formatDate(a.dob)} (${calculateAge(a.dob)}y)</p>
          <p><strong>Address:</strong> ${a.address}</p>
          <p><strong>Status:</strong> <span class="status-badge ${getStatusClass(a.status)}">${a.status}</span></p>
          <div class="progress-bar mt-3"><div class="progress-fill" style="width:${progress}%;"></div></div>
        </div>
      </div>
      <div class="mt-4 p-3 bg-gray-50 rounded">
        <h4>Payments</h4>
        <p>Advance: ₹${formatNumber(a.advance)}</p>
        <p>Final: ₹${formatNumber(a.final)}</p>
        <p><strong>Total: ₹${formatNumber(a.advance+a.final)}</strong></p>
      </div>`;
    detailsModal.classList.remove('hidden');
  };
  closeDetailsBtns.forEach(b=>b.onclick=()=>detailsModal.classList.add('hidden'));

  // 🔹 Search & filters
  function applyFilters(){
    const q=(searchInput?.value||'').toLowerCase();
    const f=filterSelect?.value||'';
    const res=applicants.filter(a=>((a.name||'').toLowerCase().includes(q)||(a.passport||'').toLowerCase().includes(q)||(a.mobile||'').toLowerCase().includes(q))&&(!f||a.status===f));
    renderTable(res);
  }
  if(searchInput)searchInput.oninput=applyFilters;
  if(filterSelect)filterSelect.onchange=applyFilters;
  if(monthFilterSelect)monthFilterSelect.onchange=()=>loadData();
  if(yearFilterSelect)yearFilterSelect.onchange=()=>loadData();

  // 🔹 CSV Export
  if (exportCsvBtn) exportCsvBtn.onclick=()=>{
    if(!applicants.length){showToast('No data','#b91c1c');return;}
    const headers='name,passport,mobile,jobProfile,dob,age,address,status,advance,final,total\n';
    const rows=applicants.map(a=>[a.name,a.passport,a.mobile,a.jobProfile,formatDate(a.dob),calculateAge(a.dob),a.address,a.status,a.advance,a.final,a.advance+a.final].join(',')).join('\n');
    const blob=new Blob([headers+rows],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='visatracker.csv';a.click();
    showToast('CSV downloaded','#0ea5a2');
  };

  // Load data initially
  loadData();
});
