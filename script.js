// VisaTracker - script.js (WITH AUTHENTICATION - UPDATED)

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyG8chw4nBpFHKGbbzInDBC5ExoqF5oPKpdt3FpaTTnz9xOPFEQLCNro8tS3lSp7P5P/exec';

function getToken() {
    return sessionStorage.getItem('visa_token');
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function logout() {
    sessionStorage.removeItem('visa_token');
    sessionStorage.removeItem('visa_username');
    window.location.href = 'login.html';
}

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
    let currentPhotoBase64 = "";
    let existingPhotoBase64 = "";

    // Set username display
    const username = sessionStorage.getItem('visa_username');
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay && username) usernameDisplay.textContent = username;

    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Set default month and year filter to current in 2025 or current year dynamically
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    if (monthFilterSelect) monthFilterSelect.value = (currentMonth < 10 ? '0' + currentMonth : currentMonth.toString());
    if (yearFilterSelect) yearFilterSelect.value = currentYear > 2025 ? currentYear : 2025;

    function showToast(text, bg = '#16a34a') {
        Toastify({
            text,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            style: { background: bg }
        }).showToast();
    }

    function showLoading(show) {
        if (show) loadingIndicator.classList.remove('hidden');
        else loadingIndicator.classList.add('hidden');
    }

    function getStatusClass(status) {
        switch (status) {
            case "Visa In Process": return "status-in-process";
            case "Visa Received": return "status-received";
            case "Departure": return "status-departure";
            case "Visa Rejected": return "status-rejected";
            case "On Hold": return "status-on-hold";
            case "Withdrawn Application": return "status-withdrawn";
            default: return "status-on-hold";
        }
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

    function formatDate(dateValue) {
        if (!dateValue) return "";
        const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (isNaN(dateObj.getTime())) return dateValue;
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function handleAuthError(result) {
        if (result.code === "AUTH_REQUIRED" || (result.message && result.message.includes("Unauthorized"))) {
            showToast("Session expired. Please login again.", "#b91c1c");
            setTimeout(logout, 1500);
            return true;
        }
        return false;
    }

    async function loadData() {
        try {
            showLoading(true);
            showToast("Loading data...", "#0ea5a2");
            const token = getToken();
            if (!token) { logout(); return; }
            const month = monthFilterSelect.value;
            const year = yearFilterSelect.value;
            let url = SCRIPT_URL + `?token=${encodeURIComponent(token)}`;
            if (month !== "all") url += `&month=${month}`;
            if (year) url += `&year=${year}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.result === "success") {
                applicants = data.applicants.map((row, idx) => ({
                    rowIndex: idx + 2, // sheet rows usually start at 2 because 1 is header
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
                renderTable(applicants);
                const monthName = month === "all" ? "All months" : new Date(year, month - 1).toLocaleString("default", { month: "long" });
                showToast(`Loaded ${applicants.length} applicants (${monthName} ${year})`, "#16a34a");
            } else if (handleAuthError(data)) {
                return;
            } else {
                showToast(`Error: ${data.message}`, "#b91c1c");
            }
        } catch (error) {
            console.error("Load error:", error);
            showToast("Failed to load data", "#b91c1c");
        } finally {
            showLoading(false);
        }
    }

    function renderTable(filtered = applicants) {
        tableBody.innerHTML = "";
        if (filtered.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-gray-500">No applicants found</td></tr>`;
            return;
        }
        filtered.forEach((a, i) => {
            const age = calculateAge(a.dob);
            const tr = document.createElement("tr");
            tr.classList.add("hover:bg-gray-100");
            tr.innerHTML = `
                <td class="px-4 py-3">${a.photo ? `<img src="${a.photo}" class="photo-thumb" alt="Photo">` : `<div class="photo-thumb bg-gray-100"></div>`}</td>
                <td class="px-4 py-3">${escapeHtml(a.name)}</td>
                <td class="px-4 py-3 font-mono">${escapeHtml(a.passport)}</td>
                <td class="px-4 py-3">${escapeHtml(a.mobile)}</td>
                <td class="px-4 py-3">${escapeHtml(a.jobProfile)}</td>
                <td class="px-4 py-3">${formatDate(a.dob)}${age ? ` (${age} years old)` : ""}</td>
                <td class="px-4 py-3"><span class="status-badge ${getStatusClass(a.status)}">${escapeHtml(a.status)}</span></td>
                <td class="px-4 py-3">${formatNumber(a.advance)}</td>
                <td class="px-4 py-3">${formatNumber(a.final)}</td>
                <td class="px-4 py-3 space-x-1">
                    <button class="px-2 py-1 bg-blue-600 text-white rounded" onclick="viewApplicant(${i})">View</button>
                    <button class="px-2 py-1 bg-yellow-500 text-white rounded" onclick="editApplicant(${i})">Edit</button>
                    <button class="px-2 py-1 bg-red-600 text-white rounded" onclick="deleteApplicant(${i})">Delete</button>
                </td>`;
            tableBody.appendChild(tr);
        });
    }

    function formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return "0.00";
        return num.toFixed(2);
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // View applicant modal with original preferred format
    window.viewApplicant = function (index) {
        const a = applicants[index];
        if (!a) return;
        const advance = Number(a.advance);
        const finalAmt = Number(a.final);
        const total = advance + finalAmt;
        const age = calculateAge(a.dob);
        const formattedDob = formatDate(a.dob);
        detailsContent.innerHTML = `
            <div class="mb-2"><strong>Name:</strong> ${escapeHtml(a.name)}</div>
            <div class="mb-2"><strong>Passport:</strong> ${escapeHtml(a.passport)}</div>
            <div class="mb-2"><strong>Mobile:</strong> ${escapeHtml(a.mobile)}</div>
            <div class="mb-2"><strong>Job Profile:</strong> ${escapeHtml(a.jobProfile)}</div>
            <div class="mb-2"><strong>DOB:</strong> ${formattedDob} ${age ? `(${age} years old)` : ''}</div>
            <div class="mb-2"><strong>Address:</strong> ${escapeHtml(a.address)}</div>
            <div class="mb-2"><strong>Status:</strong> ${escapeHtml(a.status)}</div>
            <div class="mb-2"><strong>Advance Payment:</strong> ₹${formatNumber(advance)}</div>
            <div class="mb-2"><strong>Final Payment:</strong> ₹${formatNumber(finalAmt)}</div>
            <div class="mb-2"><strong>Total Payment:</strong> ₹${formatNumber(total)}</div>
            ${a.photo ? `<div class="mt-4"><img src="${a.photo}" class="details-photo" alt="Photo"></div>` : ''}
        `;
        detailsModal.classList.remove("hidden");
    };

    closeDetails.addEventListener("click", () => detailsModal.classList.add("hidden"));
    closeDetails2.addEventListener("click", () => detailsModal.classList.add("hidden"));

    // Edit applicant — fixed status error and photo update
    window.editApplicant = function (index) {
        const a = applicants[index];
        if (!a) return;
        editingIndex = index;
        editingRowIndex = a.rowIndex;
        modalTitle.textContent = "Edit Applicant";

        document.getElementById("name").value = a.name || "";
        document.getElementById("passport").value = a.passport || "";
        document.getElementById("mobile").value = a.mobile || "";
        document.getElementById("jobProfile").value = a.jobProfile || "";
        document.getElementById("address").value = a.address || "";
        document.getElementById("status").value = a.status || "";
        document.getElementById("advance").value = a.advance || 0;
        document.getElementById("final").value = a.final || 0;
        document.getElementById("dob").value = formatDate(a.dob);

        existingPhotoBase64 = a.photo || "";
        currentPhotoBase64 = ""; // Set to empty, so if user picks new photo it'll update
        if (a.photo) {
            photoPreview.innerHTML = `<img src="${a.photo}" class="details-photo" alt="Current Photo">`;
        } else {
            photoPreview.innerHTML = "";
        }
        photoInput.value = "";

        modal.classList.remove("hidden");
    };

    // Photo handling for new or edited
    photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) {
            currentPhotoBase64 = "";
            if (existingPhotoBase64) {
                photoPreview.innerHTML = `<img src="${existingPhotoBase64}" class="details-photo" alt="Current Photo">`;
            } else {
                photoPreview.innerHTML = "";
            }
            return;
        }
        if (!file.type.startsWith("image/")) {
            showToast("Please select a valid image file", "#b91c1c");
            photoInput.value = "";
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast("Image must be smaller than 2MB", "#b91c1c");
            photoInput.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            currentPhotoBase64 = reader.result;
            photoPreview.innerHTML = `<img src="${currentPhotoBase64}" class="details-photo" alt="Preview Photo">`;
        };
        reader.readAsDataURL(file);
    });

    // Submit form add/edit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = getToken();
        if (!token) { logout(); return; }

        const name = document.getElementById("name").value.trim();
        const passport = document.getElementById("passport").value.trim();
        const dob = document.getElementById("dob").value.trim();
        const address = document.getElementById("address").value.trim();
        const mobile = document.getElementById("mobile").value.trim();
        const jobProfile = document.getElementById("jobProfile").value.trim();
        const status = document.getElementById("status").value.trim();
        const advance = parseFloat(document.getElementById("advance").value) || 0;
        const finalAmt = parseFloat(document.getElementById("final").value) || 0;

        // Validate passport & mobile formats
        if (!/^[A-Z0-9]{8}$/.test(passport)) {
            showToast("Passport must be exactly 8 alphanumeric characters", "#b91c1c");
            return;
        }
        if (!/^\d{10}$/.test(mobile)) {
            showToast("Mobile number must be exactly 10 digits", "#b91c1c");
            return;
        }

        // Use new photo if selected, else keep existing
        const photoToSend = currentPhotoBase64 || existingPhotoBase64;

        const formData = new URLSearchParams();
        formData.append("token", token);
        formData.append("name", name);
        formData.append("passport", passport);
        formData.append("dob", dob);
        formData.append("address", address);
        formData.append("mobile", mobile);
        formData.append("jobProfile", jobProfile);
        formData.append("status", status);
        formData.append("advance", advance);
        formData.append("final", finalAmt);
        formData.append("photo", photoToSend);

        if (editingIndex >= 0) {
            formData.append("action", "edit");
            formData.append("rowIndex", editingRowIndex);
        } else {
            formData.append("action", "add");
        }

        try {
            showToast("Saving...", "#0ea5a2");
            const response = await fetch(SCRIPT_URL, {
                method: "POST",
                body: formData,
                redirect: "follow"
            });
            const result = await response.json();
            if (result.result === "success") {
                showToast(editingIndex >= 0 ? "Applicant updated successfully" : "Applicant added successfully", "#16a34a");
                editingIndex = -1;
                editingRowIndex = -1;
                currentPhotoBase64 = "";
                existingPhotoBase64 = "";
                form.reset();
                photoPreview.innerHTML = "";
                photoInput.value = "";
                modal.classList.add("hidden");
                await loadData();
            } else if (handleAuthError(result)) {
                return;
            } else {
                showToast(`Error: ${result.message}`, "#b91c1c");
            }
        } catch (error) {
            console.error("Save error:", error);
            showToast("Network error. Please check your connection.", "#b91c1c");
        }
    });

    // Delete applicant
    window.deleteApplicant = async function (index) {
        if (!confirm("Delete this applicant?")) return;
        const token = getToken();
        if (!token) { logout(); return; }
        const app = applicants[index];
        try {
            showToast("Deleting...", "#0ea5a2");
            const formData = new URLSearchParams();
            formData.append("action", "delete");
            formData.append("token", token);
            formData.append("rowIndex", app.rowIndex);
            const response = await fetch(SCRIPT_URL, {
                method: "POST",
                body: formData,
                redirect: "follow"
            });
            const result = await response.json();
            if (result.result === "success") {
                showToast("Applicant deleted successfully", "#dc2626");
                await loadData();
            } else if (handleAuthError(result)) {
                return;
            } else {
                showToast(`Error deleting: ${result.message}`, "#b91c1c");
            }
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Network error. Please try again.", "#b91c1c");
        }
    };

    // Search and filter including mobile number
    function applyFilters() {
        const q = searchInput.value.toLowerCase().trim();
        const f = filterSelect.value;
        const filtered = applicants.filter(a => {
            const matchSearch =
                a.name.toLowerCase().includes(q) ||
                a.passport.toLowerCase().includes(q) ||
                a.mobile.toLowerCase().includes(q);
            const matchFilter = !f || a.status === f;
            return matchSearch && matchFilter;
        });
        renderTable(filtered);
    }

    searchInput.addEventListener("input", applyFilters);
    filterSelect.addEventListener("change", applyFilters);
    monthFilterSelect.addEventListener("change", loadData);
    yearFilterSelect.addEventListener("change", loadData);

    exportCsvBtn.addEventListener("click", () => {
        if (applicants.length === 0) {
            showToast("No data to export", "#b91c1c");
            return;
        }
        const csvData = applicants.map(a => ({
            Name: a.name,
            Passport: a.passport,
            Mobile: a.mobile,
            JobProfile: a.jobProfile,
            DOB: formatDate(a.dob),
            Age: calculateAge(a.dob),
            Address: a.address,
            Status: a.status,
            AdvancePayment: a.advance,
            FinalPayment: a.final,
            TotalPayment: a.advance + a.final
        }));
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const aTag = document.createElement("a");
        aTag.href = url;
        aTag.download = "visatracker_applicants.csv";
        document.body.appendChild(aTag);
        aTag.click();
        aTag.remove();
        URL.revokeObjectURL(url);
        showToast("CSV exported", "#0ea5a2");
    });

    // Escape HTML utility function
    function escapeHtml(text) {
        if (!text && text !== 0) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Format number utility function
    function formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return "0.00";
        return num.toFixed(2);
    }

    // Initial load
    loadData();
});
