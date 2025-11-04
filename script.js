const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8vSxqgHTn1RORtUw3EuFgCf9MgQx1zGeJAUgKTaIDciaAz5J2zvMH8FTD2FDOi5lN/exec";

function getToken() {
  return sessionStorage.getItem("visatoken");
}

function checkAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

function logout() {
  sessionStorage.removeItem("visatoken");
  sessionStorage.removeItem("visausername");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  if (!checkAuth()) return;

  const addBtn = document.getElementById("add-applicant");
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("close-modal");
  const cancelBtn = document.getElementById("cancel-btn");
  const form = document.getElementById("applicant-form");
  const tableBody = document.getElementById("table-body");
  const photoInput = document.getElementById("photo");
  const photoPreview = document.getElementById("photo-preview");
  const modalTitle = document.getElementById("modal-title");
  const searchInput = document.getElementById("search");
  const filterSelect = document.getElementById("filter");
  const monthFilterSelect = document.getElementById("month-filter");
  const yearFilterSelect = document.getElementById("year-filter");
  const loadingIndicator = document.getElementById("loading-indicator");
  const exportCsvBtn = document.getElementById("export-csv");
  const logoutBtn = document.getElementById("logout-btn");

  let applicants = [];
  let editingIndex = -1;       // Index in applicants array being edited
  let editingRowIndex = -1;    // Actual Google Sheet row number being edited
  let newPhotoBase64 = "";     // Base64 string for newly uploaded photo
  let keepExistingPhoto = "";  // Base64 or URL of existing photo when editing

  // Display logged in username
  const username = sessionStorage.getItem("visausername");
  const usernameDisplay = document.getElementById("username-display");
  if (usernameDisplay) usernameDisplay.textContent = username;

  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  function showToast(text, bg = "#16a34a") {
    Toastify({
      text,
      duration: 3000,
      gravity: "top",
      position: "right",
      style: { background: bg },
    }).showToast();
  }

  function showLoading(show) {
    loadingIndicator.classList.toggle("hidden", !show);
  }

  // Format functions and utility omitted for brevity - keep same as before

  async function loadData() {
    try {
      showLoading(true);
      const token = getToken();
      if (!token) {
        logout();
        return;
      }
      let url = `${SCRIPT_URL}?token=${encodeURIComponent(token)}`;
      const month = monthFilterSelect.value;
      const year = yearFilterSelect.value;
      if (month !== "all") url += `&month=${month}`;
      if (year) url += `&year=${year}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.result.success) {
        applicants = data.applicants.map((row, idx) => ({
          rowIndex: idx + 2, // Assuming first row is header
          timestamp: row[0],
          name: row[1],
          passport: row[2],
          mobile: row[3],
          jobProfile: row[4],
          dob: row[5],
          address: row[6],
          status: row[7],
          advance: Number(row[8]) || 0,
          final: Number(row[9]) || 0,
          photo: row[10] || "",
        }));
        renderTable(applicants);
        showToast(`Loaded ${applicants.length} applicants`, "#16a34a");
      } else {
        showToast(`Error loading data: ${data.message}`, "#b91c1c");
      }
    } catch (error) {
      console.error("Load error:", error);
      showToast("Failed to load data", "#b91c1c");
    } finally {
      showLoading(false);
    }
  }

  function renderTable(filtered) {
    tableBody.innerHTML = "";
    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="10" class="px-4 py-6 text-center text-gray-500">No applicants found</td></tr>`;
      return;
    }
    filtered.forEach((app, i) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";

      tr.innerHTML = `
        <td class="px-4 py-3">${app.photo ? `<img src="${app.photo}" alt="photo" class="photo-thumb" />` : `<div class="photo-thumb bg-gray-100"></div>`}</td>
        <td class="px-4 py-3">${escapeHtml(app.name)}</td>
        <td class="px-4 py-3 font-mono">${escapeHtml(app.passport)}</td>
        <td class="px-4 py-3">${escapeHtml(app.mobile)}</td>
        <td class="px-4 py-3">${escapeHtml(app.jobProfile)}</td>
        <td class="px-4 py-3">${calculateAge(app.dob)}</td>
        <td class="px-4 py-3"><span class="status-badge ${getStatusClass(app.status)}">${escapeHtml(app.status)}</span></td>
        <td class="px-4 py-3">${formatNumber(app.advance)}</td>
        <td class="px-4 py-3">${formatNumber(app.final)}</td>
        <td class="px-4 py-3 table-actions">
          <button class="px-2 py-1 bg-blue-600 text-white rounded" onclick="viewApplicant(${i})">View</button>
          <button class="px-2 py-1 bg-yellow-500 text-white rounded" onclick="editApplicant(${i})">Edit</button>
          <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteApplicant(${i})">Delete</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  addBtn.addEventListener("click", () => {
    editingIndex = -1;
    editingRowIndex = -1;
    modalTitle.textContent = "Add Applicant";
    form.reset();
    newPhotoBase64 = "";
    keepExistingPhoto = "";
    photoPreview.innerHTML = "";
    modal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
  cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));

  photoInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) {
      newPhotoBase64 = "";
      if (keepExistingPhoto) photoPreview.innerHTML = `<img src="${keepExistingPhoto}" class="details-photo" alt="current photo"/>`;
      return;
    }
    if (!file.type.startsWith("image")) {
      showToast("Please upload an image file", "#b91c1c");
      photoInput.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image must be less than 2 MB", "#b91c1c");
      photoInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      newPhotoBase64 = reader.result;
      photoPreview.innerHTML = `<img src="${newPhotoBase64}" class="details-photo" alt="preview" />`;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      logout();
      return;
    }

    const name = document.getElementById("name").value.trim();
    const passport = document.getElementById("passport").value.trim();
    const dob = document.getElementById("dob").value;
    const address = document.getElementById("address").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const jobProfile = document.getElementById("jobProfile").value.trim();
    const status = document.getElementById("status").value;
    const advance = parseFloat(document.getElementById("advance").value) || 0;
    const finalAmt = parseFloat(document.getElementById("final").value) || 0;

    // Basic validations
    if (!/^[A-Z0-9]{8}$/.test(passport)) {
      showToast("Passport must be exactly 8 alphanumeric characters", "#b91c1c");
      return;
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      showToast("Enter a valid 10-digit mobile number", "#b91c1c");
      return;
    }

    // Photo handling: use newly uploaded photo or keep existing when editing
    const photoToSend = newPhotoBase64 || keepExistingPhoto || "";

    const formData = new URLSearchParams();
    formData.append("token", token);
    formData.append("action", editingIndex >= 0 ? "edit" : "add");
    formData.append("name", name);
    formData.append("passport", passport);
    formData.append("mobile", mobile);
    formData.append("jobProfile", jobProfile);
    formData.append("dob", dob);
    formData.append("address", address);
    formData.append("status", status);
    formData.append("advance", advance);
    formData.append("final", finalAmt);
    formData.append("photo", photoToSend);

    if (editingIndex >= 0) {
      // pass sheet rowIndex for correct update
      formData.append("rowIndex", editingRowIndex);
    }

    try {
      showToast("Saving...", "#0ea5e9");
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (result.result.success) {
        showToast(editingIndex >= 0 ? "Applicant updated successfully" : "Applicant added successfully", "#16a34a");
        editingIndex = -1;
        editingRowIndex = -1;
        newPhotoBase64 = "";
        keepExistingPhoto = "";
        form.reset();
        photoPreview.innerHTML = "";
        modal.classList.add("hidden");
        await loadData();
      } else {
        showToast(result.message || "Error saving applicant", "#b91c1c");
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("Network error. Please check your connection.", "#b91c1c");
    }
  });

  window.editApplicant = function (index) {
    const app = applicants[index];
    if (!app) return;

    editingIndex = index;
    editingRowIndex = app.rowIndex;

    modalTitle.textContent = "Edit Applicant";
    document.getElementById("name").value = app.name;
    document.getElementById("passport").value = app.passport;
    document.getElementById("mobile").value = app.mobile;
    document.getElementById("jobProfile").value = app.jobProfile;
    document.getElementById("dob").value = app.dob;
    document.getElementById("address").value = app.address;
    document.getElementById("status").value = app.status;
    document.getElementById("advance").value = app.advance;
    document.getElementById("final").value = app.final;

    keepExistingPhoto = app.photo;
    newPhotoBase64 = "";
    photoPreview.innerHTML = app.photo ? `<img src="${app.photo}" class="details-photo" alt="current photo"/>` : "";
    photoInput.value = "";

    modal.classList.remove("hidden");
  };

  // Other utility functions like deleteApplicant, viewApplicant omitted for brevity - keep them unchanged

  // Initial load
  loadData();
});
