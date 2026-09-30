import { supabase } from "./supabaseClient.js";
import {
  signUpWithPassword,
  signInWithPassword,
  signInWithGoogle,
  signOut,
  onAuthStateChange
} from "./auth.js";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchCustomCategories,
  addCustomCategory
} from "./expenses.js";
import { uploadReceiptPhoto } from "./drive.js";
import { DEFAULT_CATEGORIES } from "./categories.js";
import {
  ICON_MOON,
  ICON_SUN,
  ICON_LOGOUT,
  ICON_TRASH,
  ICON_CAMERA,
  ICON_RECEIPT,
  ICON_GOOGLE,
  ICON_GRID,
  ICON_LIST,
  ICON_CLOSE
} from "./icons.js";

const THEME_KEY = "dh_theme";
const VIEW_MODE_KEY = "dh_view_mode";

const state = {
  theme: localStorage.getItem(THEME_KEY) || "light",
  // "list" (default, tampilan lama) atau "grid" (thumbnail ala Instagram).
  viewMode: localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "list",
  authMode: "login",
  session: null,
  expenses: [],
  categories: [...DEFAULT_CATEGORIES],
  currentExpenseId: null,
  pendingReceiptUrl: null,
  uploadingReceipt: false
};

const els = {
  // Auth
  screenAuth: document.getElementById("screen-auth"),
  authTabLogin: document.getElementById("auth-tab-login"),
  authTabSignup: document.getElementById("auth-tab-signup"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  authInfo: document.getElementById("auth-info"),
  authSubmit: document.getElementById("auth-submit"),
  authGoogleBtn: document.getElementById("auth-google-btn"),
  googleIcon: document.getElementById("google-icon"),

  // List
  screenList: document.getElementById("screen-list"),
  viewToggle: document.getElementById("view-toggle"),
  viewIcon: document.getElementById("view-icon"),
  themeToggle: document.getElementById("theme-toggle"),
  themeIcon: document.getElementById("theme-icon"),
  logoutBtn: document.getElementById("logout-btn"),
  logoutIcon: document.getElementById("logout-icon"),
  summaryTotal: document.getElementById("summary-total"),
  expenseListStatus: document.getElementById("expense-list-status"),
  expenseListEmpty: document.getElementById("expense-list-empty"),
  expenseListWrap: document.getElementById("expense-list-wrap"),
  addExpenseFab: document.getElementById("add-expense-fab"),

  // Modal popup foto (tampilan grid)
  photoModal: document.getElementById("photo-modal"),
  photoModalBackdrop: document.getElementById("photo-modal-backdrop"),
  photoModalClose: document.getElementById("photo-modal-close"),
  photoModalCloseIcon: document.getElementById("photo-modal-close-icon"),
  photoModalImg: document.getElementById("photo-modal-img"),
  photoModalNoPhoto: document.getElementById("photo-modal-no-photo"),
  photoModalNoPhotoIcon: document.getElementById("photo-modal-no-photo-icon"),
  photoModalCategory: document.getElementById("photo-modal-category"),
  photoModalAmount: document.getElementById("photo-modal-amount"),
  photoModalNote: document.getElementById("photo-modal-note"),
  photoModalDate: document.getElementById("photo-modal-date"),
  photoModalEditBtn: document.getElementById("photo-modal-edit-btn"),

  // Expense form
  screenExpense: document.getElementById("screen-expense"),
  expenseBackBtn: document.getElementById("expense-back-btn"),
  expenseFormTitle: document.getElementById("expense-form-title"),
  expenseDeleteBtn: document.getElementById("expense-delete-btn"),
  deleteIcon: document.getElementById("delete-icon"),
  expenseForm: document.getElementById("expense-form"),
  expenseDate: document.getElementById("expense-date"),
  expenseAmount: document.getElementById("expense-amount"),
  expenseCategory: document.getElementById("expense-category"),
  addCategoryBtn: document.getElementById("add-category-btn"),
  addCategoryInline: document.getElementById("add-category-inline"),
  newCategoryInput: document.getElementById("new-category-input"),
  saveCategoryBtn: document.getElementById("save-category-btn"),
  cancelCategoryBtn: document.getElementById("cancel-category-btn"),
  expenseNote: document.getElementById("expense-note"),
  receiptPreview: document.getElementById("receipt-preview"),
  receiptPreviewImg: document.getElementById("receipt-preview-img"),
  receiptRemoveBtn: document.getElementById("receipt-remove-btn"),
  receiptCaptureBtn: document.getElementById("receipt-capture-btn"),
  cameraIcon: document.getElementById("camera-icon"),
  receiptInput: document.getElementById("receipt-input"),
  receiptStatus: document.getElementById("receipt-status"),
  expenseError: document.getElementById("expense-error"),
  expenseSaveBtn: document.getElementById("expense-save-btn")
};

// ---------- Util ----------

function todayLocalDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatRupiah(amount) {
  const n = Number(amount) || 0;
  return `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function formatDateHeading(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function setIcons() {
  els.googleIcon.innerHTML = ICON_GOOGLE;
  els.logoutIcon.innerHTML = ICON_LOGOUT;
  els.deleteIcon.innerHTML = ICON_TRASH;
  els.cameraIcon.innerHTML = ICON_CAMERA;
  els.photoModalCloseIcon.innerHTML = ICON_CLOSE;
  els.photoModalNoPhotoIcon.innerHTML = ICON_RECEIPT;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  els.themeIcon.innerHTML = state.theme === "dark" ? ICON_SUN : ICON_MOON;
  document.getElementById("meta-theme-color").setAttribute("content", state.theme === "dark" ? "#000000" : "#ffffff");
}

// Ikon tombol toggle nunjukin tampilan yang akan DITUJU kalau diklik (sama
// seperti pola tombol tema: nampilin ikon matahari waktu gelap, dst).
function applyViewIcon() {
  els.viewIcon.innerHTML = state.viewMode === "grid" ? ICON_LIST : ICON_GRID;
}

function showScreen(name) {
  els.screenAuth.hidden = name !== "auth";
  els.screenList.hidden = name !== "list";
  els.screenExpense.hidden = name !== "expense";
}

// ---------- Auth ----------

function setAuthMode(mode) {
  state.authMode = mode;
  els.authTabLogin.classList.toggle("auth-tab--active", mode === "login");
  els.authTabSignup.classList.toggle("auth-tab--active", mode === "signup");
  els.authSubmit.textContent = mode === "login" ? "Masuk" : "Daftar";
  els.authPassword.autocomplete = mode === "login" ? "current-password" : "new-password";
  els.authError.hidden = true;
  els.authInfo.hidden = true;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;

  els.authError.hidden = true;
  els.authInfo.hidden = true;
  els.authSubmit.disabled = true;

  try {
    if (state.authMode === "login") {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        els.authError.hidden = false;
        els.authError.textContent = error.message === "Invalid login credentials"
          ? "Email atau kata sandi salah."
          : error.message;
      }
      // Kalau sukses, onAuthStateChange yang akan pindah layar.
    } else {
      const { data, error } = await signUpWithPassword(email, password);
      if (error) {
        els.authError.hidden = false;
        els.authError.textContent = error.message;
      } else if (!data.session) {
        // Project Supabase-nya minta konfirmasi email dulu sebelum bisa login.
        els.authInfo.hidden = false;
        els.authInfo.textContent = "Pendaftaran berhasil! Cek email kamu untuk konfirmasi, lalu masuk lewat tab \"Masuk\".";
        setAuthMode("login");
      }
      // Kalau data.session langsung ada (konfirmasi email dimatikan di project),
      // onAuthStateChange yang akan pindah layar.
    }
  } finally {
    els.authSubmit.disabled = false;
  }
}

async function handleGoogleSignIn() {
  els.authGoogleBtn.disabled = true;
  const { error } = await signInWithGoogle();
  if (error) {
    els.authError.hidden = false;
    els.authError.textContent = error.message;
    els.authGoogleBtn.disabled = false;
  }
  // Kalau sukses, browser akan redirect ke Google lalu balik lagi ke sini --
  // tidak ada kode lanjutan yang perlu dijalankan di sini.
}

// ---------- Kategori ----------

async function loadCategories() {
  try {
    const custom = await fetchCustomCategories();
    const customNames = custom.map((c) => c.name);
    state.categories = [...DEFAULT_CATEGORIES, ...customNames.filter((n) => !DEFAULT_CATEGORIES.includes(n))];
  } catch (err) {
    console.error(err);
    state.categories = [...DEFAULT_CATEGORIES];
  }
  renderCategoryOptions();
}

function renderCategoryOptions(selected) {
  const prev = selected || els.expenseCategory.value;
  els.expenseCategory.innerHTML = "";
  for (const name of state.categories) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.expenseCategory.appendChild(opt);
  }
  if (prev && state.categories.includes(prev)) {
    els.expenseCategory.value = prev;
  }
}

async function handleAddCategory() {
  const name = els.newCategoryInput.value.trim();
  if (!name) return;
  if (state.categories.includes(name)) {
    renderCategoryOptions(name);
    els.addCategoryInline.hidden = true;
    els.newCategoryInput.value = "";
    return;
  }

  els.saveCategoryBtn.disabled = true;
  try {
    await addCustomCategory(state.session.user.id, name);
    state.categories.push(name);
    renderCategoryOptions(name);
    els.addCategoryInline.hidden = true;
    els.newCategoryInput.value = "";
  } catch (err) {
    console.error(err);
    alert("Gagal menambah kategori. Coba lagi.");
  } finally {
    els.saveCategoryBtn.disabled = false;
  }
}

// ---------- Daftar pengeluaran ----------

async function loadExpenses() {
  els.expenseListStatus.hidden = false;
  els.expenseListStatus.textContent = "Memuat...";
  els.expenseListEmpty.hidden = true;

  try {
    state.expenses = await fetchExpenses();
  } catch (err) {
    console.error(err);
    els.expenseListStatus.hidden = false;
    els.expenseListStatus.textContent = "Gagal memuat data. Cek koneksi internet kamu.";
    return;
  }

  els.expenseListStatus.hidden = true;
  renderSummary();
  renderExpenseList();
}

function renderSummary() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let total = 0;
  for (const exp of state.expenses) {
    const d = new Date(`${exp.expense_date}T00:00:00`);
    if (d.getFullYear() === y && d.getMonth() === m) {
      total += Number(exp.amount) || 0;
    }
  }
  els.summaryTotal.textContent = formatRupiah(total);
}

function renderExpenseList() {
  els.expenseListWrap.innerHTML = "";

  if (state.expenses.length === 0) {
    els.expenseListEmpty.hidden = false;
    return;
  }
  els.expenseListEmpty.hidden = true;

  if (state.viewMode === "grid") {
    renderExpenseGrid();
  } else {
    renderExpenseListRows();
  }
}

// Tampilan lama: baris per pengeluaran, klik langsung buka form edit.
function renderExpenseListRows() {
  let currentDate = null;
  let listEl = null;

  for (const exp of state.expenses) {
    if (exp.expense_date !== currentDate) {
      currentDate = exp.expense_date;
      const heading = document.createElement("div");
      heading.className = "expense-date-heading";
      heading.textContent = formatDateHeading(currentDate);
      els.expenseListWrap.appendChild(heading);

      listEl = document.createElement("div");
      listEl.className = "expense-list";
      els.expenseListWrap.appendChild(listEl);
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "expense-item";

    const avatar = document.createElement("div");
    avatar.className = "expense-item-avatar";
    if (exp.receipt_url) {
      const img = document.createElement("img");
      img.src = exp.receipt_url;
      img.alt = "";
      img.loading = "lazy";
      avatar.appendChild(img);
    } else {
      avatar.innerHTML = ICON_RECEIPT;
    }

    const main = document.createElement("div");
    main.className = "expense-item-main";
    const cat = document.createElement("span");
    cat.className = "expense-item-category";
    cat.textContent = exp.category;
    main.appendChild(cat);
    if (exp.note) {
      const note = document.createElement("span");
      note.className = "expense-item-note";
      note.textContent = exp.note;
      main.appendChild(note);
    }

    const amount = document.createElement("span");
    amount.className = "expense-item-amount";
    amount.textContent = formatRupiah(exp.amount);

    item.appendChild(avatar);
    item.appendChild(main);
    item.appendChild(amount);
    item.addEventListener("click", () => openEditExpense(exp));

    listEl.appendChild(item);
  }
}

// Tampilan baru: grid thumbnail 3 kolom ala Instagram, klik buka popup foto
// + keterangan (bukan langsung ke form edit -- edit tetap bisa lewat tombol
// "Edit" di dalam popup-nya).
function renderExpenseGrid() {
  let currentDate = null;
  let gridEl = null;

  for (const exp of state.expenses) {
    if (exp.expense_date !== currentDate) {
      currentDate = exp.expense_date;
      const heading = document.createElement("div");
      heading.className = "expense-date-heading";
      heading.textContent = formatDateHeading(currentDate);
      els.expenseListWrap.appendChild(heading);

      gridEl = document.createElement("div");
      gridEl.className = "expense-grid";
      els.expenseListWrap.appendChild(gridEl);
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "expense-grid-item";
    item.title = exp.note ? `${exp.category} -- ${exp.note}` : exp.category;

    if (exp.receipt_url) {
      const img = document.createElement("img");
      img.src = exp.receipt_url;
      img.alt = "";
      img.loading = "lazy";
      item.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "expense-grid-item-placeholder";
      placeholder.innerHTML = ICON_RECEIPT;
      item.appendChild(placeholder);
    }

    const amountTag = document.createElement("span");
    amountTag.className = "expense-grid-item-amount";
    amountTag.textContent = formatRupiah(exp.amount);
    item.appendChild(amountTag);

    item.addEventListener("click", () => openPhotoModal(exp));

    gridEl.appendChild(item);
  }
}

// ---------- Modal popup foto (dipicu dari tampilan grid) ----------

function openPhotoModal(exp) {
  if (exp.receipt_url) {
    els.photoModalImg.src = exp.receipt_url;
    els.photoModalImg.hidden = false;
    els.photoModalNoPhoto.hidden = true;
  } else {
    els.photoModalImg.src = "";
    els.photoModalImg.hidden = true;
    els.photoModalNoPhoto.hidden = false;
  }

  els.photoModalCategory.textContent = exp.category;
  els.photoModalAmount.textContent = formatRupiah(exp.amount);

  if (exp.note) {
    els.photoModalNote.hidden = false;
    els.photoModalNote.textContent = exp.note;
  } else {
    els.photoModalNote.hidden = true;
    els.photoModalNote.textContent = "";
  }

  els.photoModalDate.textContent = formatDateHeading(exp.expense_date);
  els.photoModalEditBtn.onclick = () => {
    closePhotoModal();
    openEditExpense(exp);
  };

  els.photoModal.hidden = false;
}

function closePhotoModal() {
  els.photoModal.hidden = true;
  els.photoModalImg.src = "";
}

// ---------- Form tambah / edit ----------

function resetExpenseForm() {
  state.currentExpenseId = null;
  state.pendingReceiptUrl = null;
  state.uploadingReceipt = false;
  els.expenseFormTitle.textContent = "Tambah Pengeluaran";
  els.expenseDeleteBtn.hidden = true;
  els.expenseDate.value = todayLocalDateStr();
  els.expenseAmount.value = "";
  renderCategoryOptions(state.categories[0]);
  els.expenseNote.value = "";
  els.receiptPreview.hidden = true;
  els.receiptPreviewImg.src = "";
  els.receiptInput.value = "";
  els.receiptStatus.hidden = true;
  els.expenseError.hidden = true;
  els.addCategoryInline.hidden = true;
  els.newCategoryInput.value = "";
}

function openAddExpense() {
  resetExpenseForm();
  showScreen("expense");
}

function openEditExpense(exp) {
  resetExpenseForm();
  state.currentExpenseId = exp.id;
  state.pendingReceiptUrl = exp.receipt_url || null;
  els.expenseFormTitle.textContent = "Edit Pengeluaran";
  els.expenseDeleteBtn.hidden = false;
  els.expenseDate.value = exp.expense_date;
  els.expenseAmount.value = exp.amount;
  renderCategoryOptions(exp.category);
  els.expenseNote.value = exp.note || "";
  if (exp.receipt_url) {
    els.receiptPreview.hidden = false;
    els.receiptPreviewImg.src = exp.receipt_url;
  }
  showScreen("expense");
}

async function handleReceiptFileChange() {
  const file = els.receiptInput.files && els.receiptInput.files[0];
  if (!file) return;

  // Preview lokal langsung -- tidak nunggu upload selesai dulu.
  const localUrl = URL.createObjectURL(file);
  els.receiptPreview.hidden = false;
  els.receiptPreviewImg.src = localUrl;

  state.uploadingReceipt = true;
  els.receiptStatus.hidden = false;
  els.receiptStatus.textContent = "Mengupload foto ke Google Drive...";
  els.expenseSaveBtn.disabled = true;

  const result = await uploadReceiptPhoto(file);

  state.uploadingReceipt = false;
  els.expenseSaveBtn.disabled = false;

  if (result.ok) {
    state.pendingReceiptUrl = result.url;
    els.receiptStatus.hidden = true;
  } else {
    els.receiptStatus.hidden = false;
    els.receiptStatus.textContent = result.error || "Upload foto gagal.";
  }
}

function handleReceiptRemove() {
  state.pendingReceiptUrl = null;
  els.receiptInput.value = "";
  els.receiptPreview.hidden = true;
  els.receiptPreviewImg.src = "";
  els.receiptStatus.hidden = true;
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  els.expenseError.hidden = true;

  if (state.uploadingReceipt) {
    els.expenseError.hidden = false;
    els.expenseError.textContent = "Tunggu upload foto selesai dulu ya.";
    return;
  }

  const amount = Number(els.expenseAmount.value);
  if (!els.expenseDate.value || !amount || amount <= 0 || !els.expenseCategory.value) {
    els.expenseError.hidden = false;
    els.expenseError.textContent = "Lengkapi tanggal, nominal, dan kategori dulu.";
    return;
  }

  const payload = {
    expenseDate: els.expenseDate.value,
    amount,
    category: els.expenseCategory.value,
    note: els.expenseNote.value.trim(),
    receiptUrl: state.pendingReceiptUrl
  };

  els.expenseSaveBtn.disabled = true;
  try {
    if (state.currentExpenseId) {
      await updateExpense(state.currentExpenseId, payload);
    } else {
      await createExpense(state.session.user.id, payload);
    }
    await loadExpenses();
    showScreen("list");
  } catch (err) {
    console.error(err);
    els.expenseError.hidden = false;
    els.expenseError.textContent = "Gagal menyimpan. Coba lagi.";
  } finally {
    els.expenseSaveBtn.disabled = false;
  }
}

async function handleExpenseDelete() {
  if (!state.currentExpenseId) return;
  if (!confirm("Hapus catatan pengeluaran ini?")) return;

  try {
    await deleteExpense(state.currentExpenseId);
    await loadExpenses();
    showScreen("list");
  } catch (err) {
    console.error(err);
    alert("Gagal menghapus. Coba lagi.");
  }
}

// ---------- App lifecycle ----------

async function enterApp() {
  showScreen("list");
  await Promise.all([loadCategories(), loadExpenses()]);
}

function leaveApp() {
  state.expenses = [];
  state.categories = [...DEFAULT_CATEGORIES];
  els.authEmail.value = "";
  els.authPassword.value = "";
  showScreen("auth");
}

function wireEvents() {
  els.authTabLogin.addEventListener("click", () => setAuthMode("login"));
  els.authTabSignup.addEventListener("click", () => setAuthMode("signup"));
  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.authGoogleBtn.addEventListener("click", handleGoogleSignIn);

  els.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme();
  });

  els.viewToggle.addEventListener("click", () => {
    state.viewMode = state.viewMode === "grid" ? "list" : "grid";
    localStorage.setItem(VIEW_MODE_KEY, state.viewMode);
    applyViewIcon();
    renderExpenseList();
  });

  els.photoModalClose.addEventListener("click", closePhotoModal);
  els.photoModalBackdrop.addEventListener("click", closePhotoModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.photoModal.hidden) closePhotoModal();
  });

  els.logoutBtn.addEventListener("click", async () => {
    await signOut();
  });

  els.addExpenseFab.addEventListener("click", openAddExpense);
  els.expenseBackBtn.addEventListener("click", () => showScreen("list"));

  els.addCategoryBtn.addEventListener("click", () => {
    els.addCategoryInline.hidden = !els.addCategoryInline.hidden;
    if (!els.addCategoryInline.hidden) els.newCategoryInput.focus();
  });
  els.cancelCategoryBtn.addEventListener("click", () => {
    els.addCategoryInline.hidden = true;
    els.newCategoryInput.value = "";
  });
  els.saveCategoryBtn.addEventListener("click", handleAddCategory);

  els.receiptCaptureBtn.addEventListener("click", () => els.receiptInput.click());
  els.receiptInput.addEventListener("change", handleReceiptFileChange);
  els.receiptRemoveBtn.addEventListener("click", handleReceiptRemove);

  els.expenseForm.addEventListener("submit", handleExpenseSubmit);
  els.expenseDeleteBtn.addEventListener("click", handleExpenseDelete);
}

async function main() {
  setIcons();
  applyTheme();
  applyViewIcon();
  setAuthMode("login");
  wireEvents();

  onAuthStateChange(async (session) => {
    const hadSession = !!state.session;
    state.session = session;
    if (session && !hadSession) {
      // Ini juga menangani sesi yang sudah ada dari awal (buka ulang app)
      // karena Supabase langsung memanggil callback ini sekali dengan sesi
      // saat ini begitu subscribe, dan juga sesudah redirect balik dari
      // login Google.
      await enterApp();
    } else if (!session && hadSession) {
      leaveApp();
    }
  });
}

main();
