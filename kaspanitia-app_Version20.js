const STORAGE_KEY = "kaspanitia-live-v1";
const AUTH_KEY = "kaspanitia-auth-v1";

const defaultState = {
  currentUserId: "u-bendahara",
  users: [
    { id: "u-admin", name: "Admin Sistem", email: "admin@kaspanitia.id", role: "Admin", divisi: "-" },
    { id: "u-ketua", name: "Rina Ketua", email: "ketua@kaspanitia.id", role: "Ketua Panitia", divisi: "-" },
    { id: "u-bendahara", name: "Budi Bendahara", email: "bendahara@kaspanitia.id", role: "Bendahara", divisi: "-" },
    { id: "u-divisi-acara", name: "Ayu Acara", email: "acara@kaspanitia.id", role: "Koordinator Divisi", divisi: "Acara" },
    { id: "u-divisi-humas", name: "Dian Humas", email: "humas@kaspanitia.id", role: "Koordinator Divisi", divisi: "Humas" }
  ],
  accounts: [
    { id: "acc-cash", name: "Kas Tunai", type: "Kas Tunai", saldoAwal: 0 },
    { id: "acc-bank", name: "Rekening Bank", type: "Rekening Bank", saldoAwal: 0 }
  ],
  divisions: [
    { id: "div-acara", name: "Acara", coordinator: "Ayu Acara" },
    { id: "div-humas", name: "Humas", coordinator: "Dian Humas" },
    { id: "div-logistik", name: "Logistik", coordinator: "Budi Bendahara" }
  ],
  rab: [],
  submissions: [],
  transactions: [],
  auditLog: []
};

let activeScreen = "dashboard";
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      return structuredClone(defaultState);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.users) throw new Error("invalid");
    return parsed;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(parseNumber(value));
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function getDefaultPassword(user) {
  const role = user.role;
  if (role === "Admin") return "admin123";
  if (role === "Ketua Panitia") return "ketua123";
  if (role === "Bendahara") return "bendahara123";
  if (role === "Koordinator Divisi") return "divisi123";
  return "123456";
}

function showAuth() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

function showApp() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
}

function isLoggedIn() {
  const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
  return !!auth.userId && state.users.some(u => u.id === auth.userId);
}

function setLoggedUser(userId) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ userId }));
  state.currentUserId = userId;
  saveState();
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  state.currentUserId = defaultState.currentUserId;
  saveState();
  showAuth();
}

function getCurrentUser() {
  return state.users.find(u => u.id === state.currentUserId) || state.users[0];
}

function getUserById(id) {
  return state.users.find(u => u.id === id);
}

function getAccountById(id) {
  return state.accounts.find(a => a.id === id);
}

function canAccess(key) {
  const role = getCurrentUser().role;
  const map = {
    dashboard: ["Admin", "Ketua Panitia", "Koordinator Divisi", "Bendahara"],
    rab: ["Bendahara", "Ketua Panitia"],
    pengajuan: ["Koordinator Divisi", "Bendahara", "Ketua Panitia"],
    transaksi: ["Bendahara"],
    laporan: ["Bendahara", "Ketua Panitia", "Admin"],
    audit: ["Admin", "Bendahara", "Ketua Panitia"],
    users: ["Admin"]
  };
  return (map[key] || []).includes(role);
}

function recordAudit(action, detail) {
  state.auditLog.unshift({
    id: "log-" + Date.now(),
    time: new Date().toLocaleString("sv-SE").replace(" ", " "),
    actor: getCurrentUser().name,
    action,
    detail
  });
  saveState();
}

function getAccountBalance(accountId) {
  const account = getAccountById(accountId);
  if (!account) return 0;
  let total = parseNumber(account.saldoAwal);

  state.transactions.forEach(tx => {
    if (tx.accountId === accountId && tx.type === "Pemasukan") total += parseNumber(tx.nominal);
    if (tx.accountId === accountId && tx.type === "Pengeluaran") total -= parseNumber(tx.nominal);
    if (tx.fromAccountId === accountId && tx.type === "Transfer") total -= parseNumber(tx.nominal);
    if (tx.toAccountId === accountId && tx.type === "Transfer") total += parseNumber(tx.nominal);
  });

  return total;
}

function totalPemasukan() {
  return state.transactions
    .filter(tx => tx.type === "Pemasukan")
    .reduce((sum, tx) => sum + parseNumber(tx.nominal), 0);
}

function totalPengeluaran() {
  return state.transactions
    .filter(tx => tx.type === "Pengeluaran")
    .reduce((sum, tx) => sum + parseNumber(tx.nominal), 0);
}

function totalAnggaran() {
  return state.rab.reduce((sum, item) => sum + parseNumber(item.amount), 0);
}

function totalMenungguPersetujuan() {
  return state.submissions.filter(s => ["Diajukan", "Perlu Revisi"].includes(s.status)).length;
}

function statusBadgeClass(status) {
  const normalized = String(status || "").trim().toLowerCase().replace(/\s+/g, "-");
  return "badge status-" + normalized;
}

function setCurrentUser(userId) {
  if (!state.users.some(u => u.id === userId)) return;
  state.currentUserId = userId;
  saveState();
  render();
}

function getUserPhoto(userId) {
  const map = {
    "u-admin": "./assets/default-admin.jpg",
    "u-ketua": "./assets/default-ketua.jpg",
    "u-bendahara": "./assets/bendahara.jpg",
    "u-divisi-acara": "./assets/acara.jpg",
    "u-divisi-humas": "./assets/humas.jpg"
  };
  return map[userId] || "./assets/default-user.jpg";
}

function getUserPhotoKey(userId) {
  return `kaspanitia-photo-${userId}`;
}

function getStoredUserPhoto(userId) {
  return localStorage.getItem(getUserPhotoKey(userId));
}

function setStoredUserPhoto(userId, base64) {
  if (!base64) {
    localStorage.removeItem(getUserPhotoKey(userId));
    return;
  }
  localStorage.setItem(getUserPhotoKey(userId), base64);
}

function handleProfileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    const base64 = reader.result;
    const curr = getCurrentUser();
    setStoredUserPhoto(curr.id, base64);

    const photo = base64 || getUserPhoto(curr.id);
    document.getElementById("userAvatar").src = photo;
    document.getElementById("sidebarUserPhoto").src = photo;
  };
  reader.readAsDataURL(file);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function resetState() {
  const confirmed = window.confirm("Yakin ingin reset semua data aplikasi?");
  if (!confirmed) return;
  state = structuredClone(defaultState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  activeScreen = "dashboard";
  render();
}

function exportCsv() {
  const headers = ["Jenis", "Tanggal", "Deskripsi", "Kategori", "Akun", "Divisi", "Nominal", "Status"];
  const rows = [headers];

  state.transactions.forEach(tx => {
    rows.push([
      tx.type || "",
      tx.date || "",
      tx.description || "",
      tx.category || "",
      getAccountById(tx.accountId)?.name || "",
      tx.division || "",
      String(tx.nominal ?? 0),
      tx.status || ""
    ]);
  });

  const csv = rows
    .map(row =>
      row
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaspanitia-export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPdf() {
  if (!window.jspdf) {
    alert("Library PDF gagal dimuat.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const currentUser = getCurrentUser();
  const cash = getAccountBalance("acc-cash");
  const bank = getAccountBalance("acc-bank");
  const income = totalPemasukan();
  const expense = totalPengeluaran();
  const rabTotal = totalAnggaran();

  doc.setFontSize(18);
  doc.text("Laporan Keuangan KasPanitia", 14, 18);

  doc.setFontSize(11);
  doc.text(`Pengguna: ${currentUser.name} (${currentUser.role})`, 14, 28);
  doc.text(`Tanggal: ${new Date().toLocaleDateString("id-ID")}`, 14, 34);

  doc.setFontSize(12);
  doc.text("Ringkasan Keuangan", 14, 48);

  doc.setFontSize(10);
  doc.text(`Pemasukan: ${formatCurrency(income)}`, 14, 58);
  doc.text(`Pengeluaran: ${formatCurrency(expense)}`, 14, 66);
  doc.text(`Kas Tunai: ${formatCurrency(cash)}`, 14, 74);
  doc.text(`Rekening Bank: ${formatCurrency(bank)}`, 14, 82);
  doc.text(`Total RAB: ${formatCurrency(rabTotal)}`, 14, 90);

  let y = 110;
  doc.setFontSize(12);
  doc.text("Daftar Transaksi", 14, y);
  y += 8;

  const tx = state.transactions.slice(0, 12);

  if (tx.length === 0) {
    doc.setFontSize(10);
    doc.text("Belum ada transaksi.", 14, y + 8);
  } else {
    tx.forEach(item => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(9);
      const line = `${item.date} | ${item.type} | ${item.description} | ${formatCurrency(item.nominal)} | ${item.status}`;
      doc.text(line, 14, y);
      y += 8;
    });
  }

  doc.save("laporan-keuangan-kaspanitia.pdf");
}

function updateQuickActionButton() {
  const btn = document.getElementById("quickAction");
  if (!btn) return;

  const isBendahara = getCurrentUser().role === "Bendahara";
  btn.style.display = isBendahara ? "" : "none";
  btn.disabled = !isBendahara;
}

function updateHeaderMeta() {
  const curr = getCurrentUser();

  document.getElementById("userRoleTop").textContent = curr.role;
  document.getElementById("userNameTop").textContent = curr.name;
  document.getElementById("sidebarUserName").textContent = curr.name;
  document.getElementById("sidebarUserRole").textContent = curr.role;

  const stored = getStoredUserPhoto(curr.id);
  const photo = stored || getUserPhoto(curr.id);

  document.getElementById("userAvatar").src = photo;
  document.getElementById("sidebarUserPhoto").src = photo;

  document.title = `KasPanitia • ${curr.name} (${curr.role})`;
}

function renderNav() {
  const tabs = [
    { key: "dashboard", label: "Dashboard" },
    { key: "rab", label: "RAB" },
    { key: "pengajuan", label: "Pengajuan" },
    { key: "transaksi", label: "Transaksi" },
    { key: "laporan", label: "Laporan" },
    { key: "audit", label: "Audit Log" },
    { key: "users", label: "Pengguna" }
  ];

  const visible = tabs.filter(tab => canAccess(tab.key));
  document.getElementById("nav").innerHTML = visible.map(tab => `
    <button class="nav-btn ${activeScreen === tab.key ? "active" : ""}" data-nav="${tab.key}">${tab.label}</button>
  `).join("");

  document.querySelectorAll("[data-nav]").forEach(button => {
    button.addEventListener("click", () => {
      activeScreen = button.dataset.nav;
      render();
    });
  });

  const userSelect = document.getElementById("userSelect");
  userSelect.innerHTML = state.users.map(user => `
    <option value="${user.id}" ${user.id === state.currentUserId ? "selected" : ""}>${user.name} (${user.role})</option>
  `).join("");
  userSelect.onchange = (e) => setCurrentUser(e.target.value);
}

function renderScreenVisibility() {
  const screens = ["dashboard", "rab", "pengajuan", "transaksi", "laporan", "audit", "users"];
  screens.forEach(key => {
    const el = document.getElementById("screen-" + key);
    if (!el) return;
    const visible = key === activeScreen && canAccess(key);
    el.classList.toggle("hidden", !visible);
  });
  if (!canAccess(activeScreen)) activeScreen = "dashboard";
}

function renderDashboard() {
  if (!canAccess("dashboard")) return;

  document.getElementById("pageTitle").textContent = "Dashboard";
  document.getElementById("pageSubtitle").textContent = "Monitoring keuangan dan realisasi anggaran";

  const cashBal = getAccountBalance("acc-cash");
  const bankBal = getAccountBalance("acc-bank");
  const incoming = totalPemasukan();
  const outgoing = totalPengeluaran();
  const totalRAB = totalAnggaran();
  const pending = totalMenungguPersetujuan();

  document.getElementById("screen-dashboard").innerHTML = `
    <div class="section">
      <div class="summary-box">Selamat datang, ${getCurrentUser().name}. Belum ada data transaksi atau anggaran yang masuk.</div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-head">
            <span class="stat-label">Pemasukan</span>
            <span class="stat-icon icon-green">↗</span>
          </div>
          <div class="stat-value">${formatCurrency(incoming)}</div>
          <div class="trend up">▲ 0%</div>
        </div>

        <div class="stat-card">
          <div class="stat-head">
            <span class="stat-label">Pengeluaran</span>
            <span class="stat-icon icon-red">↘</span>
          </div>
          <div class="stat-value">${formatCurrency(outgoing)}</div>
          <div class="trend down">▼ 0%</div>
        </div>

        <div class="stat-card">
          <div class="stat-head">
            <span class="stat-label">Kas Tunai</span>
            <span class="stat-icon icon-blue">💵</span>
          </div>
          <div class="stat-value">${formatCurrency(cashBal)}</div>
          <div class="trend up">▲ 0%</div>
        </div>

        <div class="stat-card">
          <div class="stat-head">
            <span class="stat-label">Rekening Bank</span>
            <span class="stat-icon icon-gold">����</span>
          </div>
          <div class="stat-value">${formatCurrency(bankBal)}</div>
          <div class="trend up">▲ 0%</div>
        </div>
      </div>

      <div class="main-grid">
        <div class="section" style="padding:18px; margin:0;">
          <div class="section-header">
            <h3>Realisasi Anggaran</h3>
            <span class="muted">Belum ada data</span>
          </div>
          <div class="chart-wrap">
            <div class="bar-col"><div class="bar" style="height:0%"></div><div class="bar-label">Jan</div></div>
            <div class="bar-col"><div class="bar alt" style="height:0%"></div><div class="bar-label">Feb</div></div>
            <div class="bar-col"><div class="bar" style="height:0%"></div><div class="bar-label">Mar</div></div>
            <div class="bar-col"><div class="bar alt" style="height:0%"></div><div class="bar-label">Apr</div></div>
            <div class="bar-col"><div class="bar" style="height:0%"></div><div class="bar-label">Mei</div></div>
            <div class="bar-col"><div class="bar alt" style="height:0%"></div><div class="bar-label">Jun</div></div>
            <div class="bar-col"><div class="bar" style="height:0%"></div><div class="bar-label">Jul</div></div>
          </div>
        </div>

        <div class="section" style="padding:18px; margin:0;">
          <div class="section-header">
            <h3>Ringkasan</h3>
            <span class="muted">RAB aktif</span>
          </div>
          <div class="mini-list">
            <div class="mini-item">
              <span class="mini-dot" style="background:#1d5848"></span>
              <div>
                <strong>Total Anggaran</strong>
                <small>Keseluruhan divisi</small>
              </div>
              <span class="value">${formatCurrency(totalRAB)}</span>
            </div>
            <div class="mini-item">
              <span class="mini-dot" style="background:#2d6ec8"></span>
              <div>
                <strong>Menunggu</strong>
                <small>Pengajuan masuk</small>
              </div>
              <span class="value">${pending}</span>
            </div>
            <div class="mini-item">
              <span class="mini-dot" style="background:#b97b1d"></span>
              <div>
                <strong>Saldo net</strong>
                <small>Pemasukan - pengeluaran</small>
              </div>
              <span class="value">${formatCurrency(incoming - outgoing)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section" style="padding:18px; margin:0;">
        <div class="section-header">
          <h3>Transaksi Terbaru</h3>
          <span class="muted">Belum ada data</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaksi</th>
                <th>Kategori</th>
                <th>Divisi</th>
                <th>Nilai</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5"><div class="empty">Belum ada transaksi.</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderRab() {
  if (!canAccess("rab")) return;
  const canEdit = getCurrentUser().role === "Bendahara";

  document.getElementById("screen-rab").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Anggaran / RAB</h3>
        <span class="muted">${canEdit ? "Mode edit" : "Mode baca"}</span>
      </div>

      ${canEdit ? `
        <form id="rabForm">
          <div class="form-grid">
            <div class="field">
              <label class="label">Divisi</label>
              <select name="division" required>
                ${state.divisions.map(d => `<option value="${d.name}">${d.name}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label class="label">Kategori</label>
              <input type="text" name="category" placeholder="Contoh: Konsumsi" required />
            </div>
            <div class="field">
              <label class="label">Nominal</label>
              <input type="number" name="amount" min="0" step="1000" required />
            </div>
            <div class="field">
              <label class="label">Catatan</label>
              <input type="text" name="notes" placeholder="Catatan tambahan" />
            </div>
          </div>
          <div style="margin-top:12px;">
            <button type="submit" class="btn primary">Simpan RAB</button>
          </div>
        </form>
      ` : ""}

      <div style="margin-top:18px;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Divisi</th>
                <th>Kategori</th>
                <th>Nominal</th>
                <th>Catatan</th>
                ${canEdit ? "<th>Aksi</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${state.rab.length ? state.rab.map(item => `
                <tr>
                  <td>${item.division}</td>
                  <td>${item.category || "-"}</td>
                  <td>${formatCurrency(item.amount)}</td>
                  <td>${item.notes || "-"}</td>
                  ${canEdit ? `<td><button class="btn danger btn-delete-rab" data-id="${item.id}">Hapus</button></td>` : ""}
                </tr>
              `).join("") : `<tr><td colspan="${canEdit ? 5 : 4}"><div class="empty">Belum ada RAB.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("rabForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const division = String(fd.get("division") || "").trim();
    const category = String(fd.get("category") || "").trim();
    const amount = parseNumber(fd.get("amount"));
    const notes = String(fd.get("notes") || "").trim();

    if (!division || !category || amount <= 0) {
      alert("Divisi, kategori, dan nominal harus diisi dengan benar.");
      return;
    }

    state.rab.push({ id: "rab-" + Date.now(), division, category, amount, notes });
    saveState();
    recordAudit("Tambah RAB", `Menambahkan item ${category} untuk ${division}`);
    render();
  });

  document.querySelectorAll(".btn-delete-rab").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      state.rab = state.rab.filter(r => r.id !== id);
      saveState();
      recordAudit("Hapus RAB", `Menghapus item RAB ${id}`);
      render();
    });
  });
}

function renderPengajuan() {
  if (!canAccess("pengajuan")) return;
  const currentUser = getCurrentUser();
  const isBendahara = currentUser.role === "Bendahara";
  const isKoordinator = currentUser.role === "Koordinator Divisi";
  const isKetua = currentUser.role === "Ketua Panitia";

  const visibleSubmissions = state.submissions.filter(item => {
    if (isBendahara || isKetua) return true;
    if (isKoordinator) return item.requestorId === currentUser.id;
    return true;
  });

  document.getElementById("screen-pengajuan").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Pengajuan Dana</h3>
        <span class="muted">${isBendahara ? "Review dan approve" : "Daftar pengajuan"}</span>
      </div>

      ${(isKoordinator || isBendahara) ? `
        <form id="submissionForm">
          <div class="form-grid">
            <div class="field">
              <label class="label">Divisi</label>
              <select name="division" required>
                ${state.divisions.map(d => `<option value="${d.name}">${d.name}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label class="label">Judul Pengajuan</label>
              <input type="text" name="title" placeholder="Judul pengajuan" required />
            </div>

            <div class="field">
              <label class="label">Kategori</label>
              <input type="text" name="category" placeholder="Contoh: Konsumsi" required />
            </div>

            <div class="field">
              <label class="label">Nominal</label>
              <input type="number" name="nominal" min="0" step="1000" required />
            </div>

            <div class="field">
              <label class="label">Tanggal</label>
              <input type="date" name="date" required />
            </div>

            <div class="field">
              <label class="label">Lampiran</label>
              <input type="text" name="attachment" placeholder="dokumen.pdf" />
            </div>

            <div class="field">
              <label class="label">Foto Bon / Struk</label>
              <input type="file" name="receiptImage" accept="image/*" />
            </div>

            <div class="field full">
              <label class="label">Keterangan</label>
              <textarea name="notes" placeholder="Tujuan penggunaan dana"></textarea>
            </div>
          </div>

          <div style="margin-top:12px;">
            <button type="submit" class="btn primary">Kirim Pengajuan</button>
          </div>
        </form>
      ` : ""}

      <div style="margin-top:20px;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Divisi</th>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Nominal</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${visibleSubmissions.length ? visibleSubmissions.map(item => {
                const pemohon = getUserById(item.requestorId);
                let actions = "<span class='muted'>-</span>";

                if (isBendahara) {
                  actions = `
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                      <button class="btn primary btn-status" data-id="${item.id}" data-status="Disetujui">Setuju</button>
                      <button class="btn warning btn-status" data-id="${item.id}" data-status="Perlu Revisi">Revisi</button>
                      <button class="btn danger btn-status" data-id="${item.id}" data-status="Ditolak">Tolak</button>
                    </div>
                  `;
                } else if (isKoordinator && item.requestorId === currentUser.id) {
                  actions = `<button class="btn secondary btn-status" data-id="${item.id}" data-status="Diajukan">Ajukan Ulang</button>`;
                }

                return `
                  <tr>
                    <td>${item.division}</td>
                    <td>
                      <strong>${item.title || "-"}</strong>
                      ${item.receiptImage ? `<div style="margin-top:8px;"><img class="attachment-thumb" src="${item.receiptImage}" alt="Struk / Bon" /></div>` : `<div class="attachment-empty">No image</div>`}
                      <br>
                      <span class="muted" style="font-size:0.76rem;">Pemohon: ${pemohon ? pemohon.name : "-"}</span>
                    </td>
                    <td>${item.category || "-"}</td>
                    <td>${formatCurrency(item.nominal || 0)}</td>
                    <td>${formatDate(item.date)}</td>
                    <td><span class="${statusBadgeClass(item.status)}">${item.status}</span></td>
                    <td>${actions}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="7"><div class="empty">Belum ada pengajuan.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("submissionForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = String(fd.get("title") || "").trim();
    const category = String(fd.get("category") || "").trim();
    const division = String(fd.get("division") || "").trim();
    const date = String(fd.get("date") || "").trim();
    const nominal = parseNumber(fd.get("nominal"));
    const receiptFile = e.target.querySelector('input[name="receiptImage"]')?.files?.[0];
    const receiptImage = receiptFile ? await readFileAsDataURL(receiptFile) : "";

    if (!title || !category || !division || !date || nominal <= 0) {
      alert("Judul, kategori, divisi, tanggal, dan nominal wajib diisi.");
      return;
    }

    state.submissions.unshift({
      id: "sub-" + Date.now(),
      requestorId: currentUser.id,
      division,
      title,
      category,
      nominal,
      date,
      status: "Diajukan",
      notes: String(fd.get("notes") || "").trim(),
      attachment: String(fd.get("attachment") || "").trim() || "-",
      receiptImage
    });

    saveState();
    recordAudit("Buat pengajuan", `${title} • ${formatCurrency(nominal)}`);
    render();
  });

  document.querySelectorAll(".btn-status").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      const status = button.dataset.status;
      state.submissions = state.submissions.map(item => item.id === id ? { ...item, status } : item);
      saveState();
      recordAudit("Ubah status pengajuan", `ID ${id} -> ${status}`);
      render();
    });
  });
}

function renderTransaksi() {
  if (!canAccess("transaksi")) return;
  const isBendahara = getCurrentUser().role === "Bendahara";

  document.getElementById("screen-transaksi").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Transaksi Keuangan</h3>
        <span class="muted">${isBendahara ? "Input dan posting" : "Read only"}</span>
      </div>

      ${isBendahara ? `
        <form id="transactionForm">
          <div class="form-grid">
            <div class="field">
              <label class="label">Jenis</label>
              <select name="type" required>
                <option value="Pemasukan">Pemasukan</option>
                <option value="Pengeluaran">Pengeluaran</option>
                <option value="Transfer">Transfer Internal</option>
              </select>
            </div>

            <div class="field">
              <label class="label">Tanggal</label>
              <input type="date" name="date" required />
            </div>

            <div class="field">
              <label class="label">Deskripsi</label>
              <input type="text" name="description" placeholder="Deskripsi transaksi" required />
            </div>

            <div class="field">
              <label class="label">Kategori</label>
              <input type="text" name="category" placeholder="Contoh: Sponsor" required />
            </div>

            <div class="field">
              <label class="label">Akun</label>
              <select name="accountId" required>
                ${state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label class="label">Divisi</label>
              <select name="division">
                <option value="-">-</option>
                ${state.divisions.map(d => `<option value="${d.name}">${d.name}</option>`).join("")}
              </select>
            </div>

            <div class="field">
              <label class="label">Foto Bon / Struk</label>
              <input type="file" name="receiptImage" accept="image/*" />
            </div>

            <div class="field">
              <label class="label">Nominal</label>
              <input type="number" name="nominal" min="0" step="1000" required />
            </div>

            <div class="field">
              <label class="label">Transfer Tujuan</label>
              <select name="toAccountId">
                <option value="">-</option>
                ${state.accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="margin-top:14px;">
            <button type="submit" class="btn primary">Posting Transaksi</button>
          </div>
        </form>
      ` : `<div class="summary-box">Anda hanya dapat melihat transaksi keuangan.</div>`}

      <div style="margin-top:18px;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Deskripsi</th>
                <th>Jenis</th>
                <th>Akun</th>
                <th>Nominal</th>
                <th>Divisi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${state.transactions.length ? state.transactions.map(tx => `
                <tr>
                  <td>${formatDate(tx.date)}</td>
                  <td>
                    ${tx.description || "-"}
                    ${tx.receiptImage ? `<div style="margin-top:8px;"><img class="attachment-thumb" src="${tx.receiptImage}" alt="Struk / Bon" /></div>` : `<div class="attachment-empty">No image</div>`}
                  </td>
                  <td><span class="badge ${tx.type === "Pemasukan" ? "income" : tx.type === "Pengeluaran" ? "expense" : "transfer"}">${tx.type}</span></td>
                  <td>${getAccountById(tx.accountId)?.name || "-"}</td>
                  <td class="money ${tx.type === "Pemasukan" ? "in" : "out"}">${tx.type === "Pemasukan" ? "+" : "-"}${formatCurrency(tx.nominal || 0)}</td>
                  <td>${tx.division || "-"}</td>
                  <td>${tx.status}</td>
                </tr>
              `).join("") : `<tr><td colspan="7"><div class="empty">Belum ada transaksi.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("transactionForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = String(fd.get("type") || "");
    const description = String(fd.get("description") || "").trim();
    const category = String(fd.get("category") || "").trim();
    const accountId = String(fd.get("accountId") || "");
    const date = String(fd.get("date") || "").trim();
    const division = String(fd.get("division") || "-").trim();
    const nominal = parseNumber(fd.get("nominal"));
    const receiptFile = e.target.querySelector('input[name="receiptImage"]')?.files?.[0];
    const receiptImage = receiptFile ? await readFileAsDataURL(receiptFile) : "";

    if (!type || !description || !category || !accountId || !date || nominal <= 0) {
      alert("Data transaksi tidak lengkap atau nominal tidak valid.");
      return;
    }

    if (type === "Transfer") {
      const to = String(fd.get("toAccountId") || "");
      if (!to || to === accountId) {
        alert("Untuk transfer internal, pilih akun tujuan yang berbeda.");
        return;
      }
    }

    const payload = {
      id: "tx-" + Date.now(),
      date,
      description,
      type,
      category,
      accountId,
      division: division || "-",
      nominal,
      status: "Diposting",
      receiptImage
    };

    if (type === "Transfer") {
      payload.fromAccountId = accountId;
      payload.toAccountId = String(fd.get("toAccountId") || accountId);
    }

    state.transactions.unshift(payload);
    saveState();
    recordAudit("Posting transaksi", `${type} • ${description} • ${formatCurrency(nominal)}`);
    render();
  });
}

function renderLaporan() {
  if (!canAccess("laporan")) return;
  const cash = getAccountBalance("acc-cash");
  const bank = getAccountBalance("acc-bank");
  const income = totalPemasukan();
  const expense = totalPengeluaran();

  document.getElementById("pageTitle").textContent = "Laporan";
  document.getElementById("pageSubtitle").textContent = "Ringkasan keuangan dan realisasi";

  document.getElementById("screen-laporan").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Laporan Keuangan</h3>
        <span class="muted">PDF / Excel</span>
      </div>

      <div class="grid-2">
        <div class="list-card">
          <div class="mini-label">Pemasukan</div>
          <div class="big-number">${formatCurrency(income)}</div>
        </div>

        <div class="list-card">
          <div class="mini-label">Pengeluaran</div>
          <div class="big-number">${formatCurrency(expense)}</div>
        </div>

        <div class="list-card">
          <div class="mini-label">Saldo Kas</div>
          <div class="big-number">${formatCurrency(cash)}</div>
        </div>

        <div class="list-card">
          <div class="mini-label">Saldo Bank</div>
          <div class="big-number">${formatCurrency(bank)}</div>
        </div>
      </div>

      <div style="margin-top:20px;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Divisi</th>
                <th>RAB</th>
                <th>Realisasi</th>
                <th>Sisa</th>
              </tr>
            </thead>
            <tbody>
              ${state.divisions.length ? state.divisions.map(div => {
                const rabTotal = state.rab.filter(r => r.division === div.name).reduce((sum, r) => sum + parseNumber(r.amount), 0);
                const realized = state.transactions.filter(tx => tx.division === div.name && tx.type === "Pengeluaran").reduce((sum, tx) => sum + parseNumber(tx.nominal), 0);
                return `
                  <tr>
                    <td>${div.name}</td>
                    <td>${formatCurrency(rabTotal)}</td>
                    <td>${formatCurrency(realized)}</td>
                    <td>${formatCurrency(rabTotal - realized)}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="4"><div class="empty">Belum ada data divisi.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderAudit() {
  if (!canAccess("audit")) return;

  document.getElementById("screen-audit").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Audit Log</h3>
        <span class="muted">Jejak aktivitas</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengguna</th>
              <th>Aksi</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${state.auditLog.length ? state.auditLog.map(log => `
              <tr>
                <td>${log.time || "-"}</td>
                <td>${log.actor || "-"}</td>
                <td>${log.action || "-"}</td>
                <td>${log.detail || "-"}</td>
              </tr>
            `).join("") : `<tr><td colspan="4"><div class="empty">Belum ada log audit.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderUsers() {
  if (!canAccess("users")) return;

  document.getElementById("screen-users").innerHTML = `
    <div class="section">
      <div class="section-header">
        <h3>Kelola Pengguna</h3>
        <span class="muted">Admin only</span>
      </div>

      <form id="userForm">
        <div class="form-grid">
          <div class="field">
            <label class="label">Nama</label>
            <input type="text" name="name" required />
          </div>

          <div class="field">
            <label class="label">Email</label>
            <input type="email" name="email" required />
          </div>

          <div class="field">
            <label class="label">Role</label>
            <select name="role" required>
              <option value="Admin">Admin</option>
              <option value="Ketua Panitia">Ketua Panitia</option>
              <option value="Koordinator Divisi">Koordinator Divisi</option>
              <option value="Bendahara">Bendahara</option>
            </select>
          </div>

          <div class="field">
            <label class="label">Divisi</label>
            <input type="text" name="divisi" placeholder="Opsional" />
          </div>
        </div>

        <div style="margin-top:12px;">
          <button class="btn primary" type="submit">Tambah User</button>
        </div>
      </form>

      <div style="margin-top:20px;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Divisi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${state.users.map(user => `
                <tr>
                  <td>${user.name}</td>
                  <td>${user.email}</td>
                  <td>${user.role}</td>
                  <td>${user.divisi || "-"}</td>
                  <td><button class="btn danger btn-delete-user" data-id="${user.id}" ${user.id === state.currentUserId ? "disabled" : ""}>Hapus</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById("userForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const role = String(fd.get("role") || "").trim();
    const divisi = String(fd.get("divisi") || "").trim();

    if (!name || !email || !role) {
      alert("Nama, email, dan role wajib diisi.");
      return;
    }

    state.users.push({
      id: "u-" + Date.now(),
      name,
      email,
      role,
      divisi: divisi || "-"
    });

    saveState();
    recordAudit("Tambah user", `${name} (${role})`);
    render();
  });

  document.querySelectorAll(".btn-delete-user").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (id === state.currentUserId) {
        alert("Tidak bisa menghapus user yang sedang aktif.");
        return;
      }

      state.users = state.users.filter(u => u.id !== id);
      saveState();
      recordAudit("Hapus user", `User dihapus dari sistem`);
      render();
    });
  });
}

function attachStaticEvents() {
  const searchInput = document.getElementById("globalSearch");
  if (searchInput) {
    searchInput.oninput = (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      const rows = document.querySelectorAll("tbody tr");
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = (!keyword || text.includes(keyword)) ? "" : "none";
      });
    };
  }

  const quickAction = document.getElementById("quickAction");
  if (quickAction) {
    quickAction.onclick = () => {
      if (getCurrentUser().role !== "Bendahara") return;
      activeScreen = "transaksi";
      render();
    };
  }

  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) exportBtn.onclick = exportCsv;

  const pdfBtn = document.getElementById("downloadPdfBtn");
  if (pdfBtn) pdfBtn.onclick = exportPdf;

  const resetBtn = document.getElementById("resetDataBtn");
  if (resetBtn) resetBtn.onclick = resetState;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value.trim();
      const user = state.users.find(u => u.email.toLowerCase() === email);
      const errorBox = document.getElementById("loginError");

      if (!user) {
        errorBox.textContent = "Email tidak ditemukan.";
        errorBox.classList.add("show");
        return;
      }

      if (password !== getDefaultPassword(user)) {
        errorBox.textContent = "Password salah.";
        errorBox.classList.add("show");
        return;
      }

      errorBox.classList.remove("show");
      setLoggedUser(user.id);
      showApp();
      render();
    });
  }

  const profileUploadInput = document.getElementById("profileUploadInput");
  if (profileUploadInput) {
    profileUploadInput.addEventListener("change", handleProfileUpload);
  }
}

function render() {
  if (isLoggedIn()) {
    state.currentUserId = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}").userId || state.currentUserId;
    showApp();
  } else {
    showAuth();
  }

  if (isLoggedIn()) {
    updateQuickActionButton();
    renderScreenVisibility();
    renderNav();
    updateHeaderMeta();

    if (canAccess("dashboard")) renderDashboard();
    if (canAccess("rab")) renderRab();
    if (canAccess("pengajuan")) renderPengajuan();
    if (canAccess("transaksi")) renderTransaksi();
    if (canAccess("laporan")) renderLaporan();
    if (canAccess("audit")) renderAudit();
    if (canAccess("users")) renderUsers();
  }
}

document.querySelectorAll("#userAvatar, #sidebarUserPhoto").forEach(img => {
  img.addEventListener("error", function () {
    this.src = "./assets/default-user.jpg";
  });
});

attachStaticEvents();
render();
