import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, query, orderBy, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Config ---
const firebaseConfig = {
    apiKey: "AIzaSyCdIwPsO2wsdrc7KX7bWFS5wcgih7FM9a4",
    authDomain: "daily-expense-7c035.firebaseapp.com",
    projectId: "daily-expense-7c035",
    storageBucket: "daily-expense-7c035.firebasestorage.app",
    messagingSenderId: "65048540802",
    appId: "1:65048540802:web:142e01b7cf3491ca6f269b",
    measurementId: "G-Z0TEGD5H6T"
};

// --- Init ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Enable Firestore Offline Persistence ---
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser');
    }
});

// --- IndexedDB for Offline Sync Queue ---
const IDB_NAME = 'expenseProOffline';
const IDB_VERSION = 1;
const SYNC_STORE = 'syncQueue';
const LOCAL_EXPENSES_STORE = 'localExpenses';

function openIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        request.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains(SYNC_STORE)) {
                idb.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
            }
            if (!idb.objectStoreNames.contains(LOCAL_EXPENSES_STORE)) {
                idb.createObjectStore(LOCAL_EXPENSES_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function addToSyncQueue(operation) {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(SYNC_STORE, 'readwrite');
        tx.objectStore(SYNC_STORE).add(operation);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function getSyncQueue() {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(SYNC_STORE, 'readonly');
        const req = tx.objectStore(SYNC_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function clearSyncQueue() {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(SYNC_STORE, 'readwrite');
        tx.objectStore(SYNC_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function saveLocalExpenses(expenses) {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(LOCAL_EXPENSES_STORE, 'readwrite');
        const store = tx.objectStore(LOCAL_EXPENSES_STORE);
        store.clear();
        expenses.forEach(exp => store.put(exp));
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function getLocalExpenses() {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = idb.transaction(LOCAL_EXPENSES_STORE, 'readonly');
        const req = tx.objectStore(LOCAL_EXPENSES_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// --- Sync Queue Processing ---
async function processSyncQueue() {
    if (!navigator.onLine || !currentUser) return;

    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} queued operations...`);

    for (const op of queue) {
        try {
            if (op.type === 'add') {
                await addDoc(collection(db, "users", op.userId, "expenses"), op.data);
            } else if (op.type === 'update') {
                await updateDoc(doc(db, "users", op.userId, "expenses", op.docId), op.data);
            } else if (op.type === 'delete') {
                await deleteDoc(doc(db, "users", op.userId, "expenses", op.docId));
            } else if (op.type === 'setBudget') {
                await setDoc(doc(db, "users", op.userId, "settings", "budget"), op.data);
            }
        } catch (err) {
            console.error('Sync error for operation:', op, err);
        }
    }

    await clearSyncQueue();
    showSimpleToast("✅ Offline changes synced!");
    console.log('Sync queue processed successfully');
}

// --- DOM ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('loginBtn');
const profileSection = document.getElementById('profileSection');
const avatarBtn = document.getElementById('avatarBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');

const form = document.getElementById('expenseForm');
const expenseList = document.getElementById('expenseList');
const monthFilter = document.getElementById('monthFilter');
const categoryFilter = document.getElementById('categoryFilter');
const searchInput = document.getElementById('searchInput');
const submitBtn = document.getElementById('submitBtn');

const categorySelect = document.getElementById('category');
const customCatInput = document.getElementById('customCategoryInput');

const budgetInput = document.getElementById('budgetInput');
const setBudgetBtn = document.getElementById('setBudgetBtn');

const todayTotalEl = document.getElementById('todayTotal');
const monthTotalEl = document.getElementById('monthTotal');
const remainingMoneyEl = document.getElementById('remainingMoney');
const totalEntriesEl = document.getElementById('totalEntries');

const dynamicToast = document.getElementById('dynamicToast');
const toastMessage = document.getElementById('toastMessage');
const toastActionBtn = document.getElementById('toastActionBtn');
const toastProgress = document.getElementById('toastProgress');

// --- Edit Modal DOM ---
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editModalDocId = document.getElementById('editModalDocId');
const editPurpose = document.getElementById('editPurpose');
const editCategory = document.getElementById('editCategory');
const editCustomCategory = document.getElementById('editCustomCategory');
const editAmount = document.getElementById('editAmount');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// --- Offline/Online Indicator ---
const offlineIndicator = document.getElementById('offlineIndicator');

// --- PWA Install (inside login card) ---
const installHint = document.getElementById('installHint');
const installBtn = document.getElementById('installBtn');

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install hint inside login card
    if (installHint) {
        installHint.classList.remove('hidden');
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('Install outcome:', outcome);
        deferredPrompt = null;
        if (installHint) installHint.classList.add('hidden');
    });
}

window.addEventListener('appinstalled', () => {
    if (installHint) installHint.classList.add('hidden');
    deferredPrompt = null;
    showSimpleToast("🎉 App installed successfully!");
});

// --- Online/Offline Events ---
function updateOnlineStatus() {
    if (navigator.onLine) {
        offlineIndicator.classList.add('hidden');
        // Sync when back online
        processSyncQueue();
    } else {
        offlineIndicator.classList.remove('hidden');
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// --- State ---
let currentUser = null;
let allExpenses = [];
let userBudget = 0;
let categoryChartInstance = null;
let monthlyChartInstance = null;
let toastTimeoutId = null;
let isFirstLoad = true;

// --- Auth ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userAvatar.src = user.photoURL || "https://via.placeholder.com/40";
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        isFirstLoad = true;

        // Load cached expenses first for instant display
        try {
            const cachedExpenses = await getLocalExpenses();
            if (cachedExpenses.length > 0) {
                allExpenses = cachedExpenses;
                updateSummaryCards();
                updateCharts();
                populateMonthFilter();
                renderExpenses();
            }
        } catch (e) {
            console.warn('Failed to load cached expenses:', e);
        }

        loadUserExpenses();
        loadUserBudget();

        // Process any queued offline operations
        if (navigator.onLine) {
            processSyncQueue();
        }
    } else {
        currentUser = null;
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        profileSection.classList.remove('active');
    }
});

loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => console.error(e));
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
    profileSection.classList.remove('active');
});

avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileSection.classList.toggle('active');
});

document.addEventListener('click', () => {
    if (profileSection.classList.contains('active')) {
        profileSection.classList.remove('active');
    }
});

// --- Custom Category (Add Form) ---
categorySelect.addEventListener('change', () => {
    if (categorySelect.value === 'Custom') {
        customCatInput.style.display = 'block';
        customCatInput.required = true;
        customCatInput.focus();
    } else {
        customCatInput.style.display = 'none';
        customCatInput.required = false;
    }
});

// --- Custom Category (Edit Modal) ---
editCategory.addEventListener('change', () => {
    if (editCategory.value === 'Custom') {
        editCustomCategory.style.display = 'block';
        editCustomCategory.required = true;
        editCustomCategory.focus();
    } else {
        editCustomCategory.style.display = 'none';
        editCustomCategory.required = false;
    }
});

// --- Database ---

async function loadUserBudget() {
    if (!currentUser) return;
    try {
        const budgetRef = doc(db, "users", currentUser.uid, "settings", "budget");
        const docSnap = await getDoc(budgetRef);
        if (docSnap.exists()) {
            userBudget = parseFloat(docSnap.data().amount) || 0;
            budgetInput.value = userBudget;
            updateSummaryCards();
        }
    } catch (e) {
        console.warn('Failed to load budget (may be offline):', e);
        // Try loading from localStorage
        const cachedBudget = localStorage.getItem('userBudget');
        if (cachedBudget) {
            userBudget = parseFloat(cachedBudget) || 0;
            budgetInput.value = userBudget;
            updateSummaryCards();
        }
    }
}

setBudgetBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    const val = parseFloat(budgetInput.value);
    if (!isNaN(val)) {
        userBudget = val;
        localStorage.setItem('userBudget', val);

        if (navigator.onLine) {
            try {
                await setDoc(doc(db, "users", currentUser.uid, "settings", "budget"), { amount: val });
            } catch (e) {
                console.warn('Budget save failed, queuing for sync:', e);
                await addToSyncQueue({
                    type: 'setBudget',
                    userId: currentUser.uid,
                    data: { amount: val },
                    timestamp: Date.now()
                });
            }
        } else {
            await addToSyncQueue({
                type: 'setBudget',
                userId: currentUser.uid,
                data: { amount: val },
                timestamp: Date.now()
            });
        }

        updateSummaryCards();
        showSimpleToast("Budget saved successfully!");
    }
});

function loadUserExpenses() {
    if (!currentUser) return;
    const expensesRef = collection(db, "users", currentUser.uid, "expenses");
    const q = query(expensesRef, orderBy("dateRaw", "asc"));

    onSnapshot(q, (snapshot) => {
        allExpenses = [];
        snapshot.forEach((docItem) => {
            allExpenses.push({ id: docItem.id, ...docItem.data() });
        });

        // Cache expenses locally for offline access
        saveLocalExpenses(allExpenses).catch(e => console.warn('Failed to cache expenses:', e));

        updateSummaryCards();
        updateCharts();
        populateMonthFilter();
        renderExpenses();
    }, (error) => {
        console.warn('Snapshot listener error (may be offline):', error);
    });
}

// --- Add Expense ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const purpose = document.getElementById('purpose').value.trim();

    let catValue = categorySelect.value;
    if (catValue === 'Custom') {
        catValue = customCatInput.value.trim() || 'Others';
    }

    const amount = parseFloat(document.getElementById('amount').value);
    const now = new Date();

    if (purpose === '' || isNaN(amount) || amount <= 0) return;

    const expenseData = {
        purpose: purpose,
        category: catValue,
        amount: amount,
        dateRaw: now.toISOString(),
        dateDisplay: now.toLocaleString()
    };

    if (navigator.onLine) {
        try {
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), expenseData);
            showDeleteToast(docRef.id, `Added "${purpose}" — ₹${amount}`);
        } catch (error) {
            console.error('Online add failed, queuing:', error);
            // Add locally and queue for sync
            const tempId = 'temp_' + Date.now();
            allExpenses.push({ id: tempId, ...expenseData });
            saveLocalExpenses(allExpenses);
            await addToSyncQueue({
                type: 'add',
                userId: currentUser.uid,
                data: expenseData,
                timestamp: Date.now()
            });
            updateSummaryCards();
            updateCharts();
            populateMonthFilter();
            renderExpenses();
            showDeleteToast(tempId, `Added "${purpose}" — ₹${amount}`);
        }
    } else {
        // Offline: add locally and queue for sync
        const tempId = 'temp_' + Date.now();
        allExpenses.push({ id: tempId, ...expenseData });
        saveLocalExpenses(allExpenses);
        await addToSyncQueue({
            type: 'add',
            userId: currentUser.uid,
            data: expenseData,
            timestamp: Date.now()
        });
        updateSummaryCards();
        updateCharts();
        populateMonthFilter();
        renderExpenses();
        showDeleteToast(tempId, `Added "${purpose}" — ₹${amount}`);
    }

    form.reset();
    customCatInput.style.display = 'none';
    categorySelect.value = 'Food';
});

// --- Edit Modal Logic ---

window.editExpense = (docId) => {
    const expense = allExpenses.find(exp => exp.id === docId);
    if (!expense) return;

    editPurpose.value = expense.purpose;
    editAmount.value = expense.amount;
    editModalDocId.value = docId;

    const options = Array.from(editCategory.options);
    const catExists = options.some(opt => opt.value === expense.category);
    if (catExists) {
        editCategory.value = expense.category;
        editCustomCategory.style.display = 'none';
        editCustomCategory.required = false;
    } else {
        editCategory.value = 'Custom';
        editCustomCategory.style.display = 'block';
        editCustomCategory.required = true;
        editCustomCategory.value = expense.category;
    }

    editModal.classList.remove('hidden');
};

function closeEditModal() {
    editModal.classList.add('hidden');
    editForm.reset();
    editCustomCategory.style.display = 'none';
    editCustomCategory.required = false;
}

modalCloseBtn.addEventListener('click', closeEditModal);
modalCancelBtn.addEventListener('click', closeEditModal);

editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
        closeEditModal();
    }
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const docId = editModalDocId.value;
    const purpose = editPurpose.value.trim();
    let catValue = editCategory.value;
    if (catValue === 'Custom') {
        catValue = editCustomCategory.value.trim() || 'Others';
    }
    const amount = parseFloat(editAmount.value);
    const now = new Date();

    if (!docId || purpose === '' || isNaN(amount) || amount <= 0) return;

    const updateData = {
        purpose: purpose,
        category: catValue,
        amount: amount,
        dateRaw: now.toISOString(),
        dateDisplay: now.toLocaleString()
    };

    if (navigator.onLine && !docId.startsWith('temp_')) {
        try {
            await updateDoc(doc(db, "users", currentUser.uid, "expenses", docId), updateData);
            closeEditModal();
            showSimpleToast(`Updated "${purpose}" successfully`);
        } catch (error) {
            console.error('Online update failed, queuing:', error);
            await addToSyncQueue({
                type: 'update',
                userId: currentUser.uid,
                docId: docId,
                data: updateData,
                timestamp: Date.now()
            });
            // Update locally
            const idx = allExpenses.findIndex(exp => exp.id === docId);
            if (idx !== -1) {
                allExpenses[idx] = { id: docId, ...updateData };
                saveLocalExpenses(allExpenses);
                updateSummaryCards();
                updateCharts();
                renderExpenses();
            }
            closeEditModal();
            showSimpleToast(`Updated "${purpose}" — will sync when online`);
        }
    } else {
        // Offline or temp expense: update locally and queue
        if (!docId.startsWith('temp_')) {
            await addToSyncQueue({
                type: 'update',
                userId: currentUser.uid,
                docId: docId,
                data: updateData,
                timestamp: Date.now()
            });
        }
        const idx = allExpenses.findIndex(exp => exp.id === docId);
        if (idx !== -1) {
            allExpenses[idx] = { id: docId, ...updateData };
            saveLocalExpenses(allExpenses);
            updateSummaryCards();
            updateCharts();
            renderExpenses();
        }
        closeEditModal();
        showSimpleToast(`Updated "${purpose}" — will sync when online`);
    }
});

// --- Toast ---

function showDeleteToast(docId, msg) {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);

    toastMessage.textContent = msg;
    toastActionBtn.textContent = 'Undo';

    dynamicToast.classList.remove('hidden');
    dynamicToast.style.display = 'flex';

    toastActionBtn.onclick = () => {
        deleteExpense(docId);
        hideToast();
    };

    toastProgress.classList.remove('active');
    void toastProgress.offsetWidth;
    toastProgress.classList.add('active');

    toastTimeoutId = setTimeout(() => {
        hideToast();
    }, 5000);
}

function showSimpleToast(msg) {
    if (toastTimeoutId) clearTimeout(toastTimeoutId);

    toastMessage.textContent = msg;
    toastActionBtn.style.display = 'none';

    dynamicToast.classList.remove('hidden');
    dynamicToast.style.display = 'flex';

    toastProgress.classList.remove('active');
    void toastProgress.offsetWidth;
    toastProgress.classList.add('active');

    toastTimeoutId = setTimeout(() => {
        hideToast();
        toastActionBtn.style.display = 'inline-block';
    }, 3000);
}

function hideToast() {
    dynamicToast.classList.add('hidden');
    dynamicToast.style.display = 'none';
    toastProgress.classList.remove('active');
    toastActionBtn.style.display = 'inline-block';

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
}

window.deleteExpense = async (docId) => {
    if (navigator.onLine && !docId.startsWith('temp_')) {
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "expenses", docId));
        } catch (e) {
            console.warn('Delete failed, queuing:', e);
            await addToSyncQueue({
                type: 'delete',
                userId: currentUser.uid,
                docId: docId,
                timestamp: Date.now()
            });
        }
    } else {
        if (!docId.startsWith('temp_')) {
            await addToSyncQueue({
                type: 'delete',
                userId: currentUser.uid,
                docId: docId,
                timestamp: Date.now()
            });
        }
    }

    // Remove locally
    allExpenses = allExpenses.filter(exp => exp.id !== docId);
    saveLocalExpenses(allExpenses);
    updateSummaryCards();
    updateCharts();
    renderExpenses();
};

// --- UI ---

function updateSummaryCards() {
    const todayStr = new Date().toLocaleDateString();
    const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    let todayTotal = 0;
    let monthTotal = 0;

    allExpenses.forEach(exp => {
        if (exp.dateDisplay && exp.dateDisplay.startsWith(todayStr)) todayTotal += exp.amount;

        const d = new Date(exp.dateRaw);
        const expMonthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (expMonthStr === currentMonthStr) monthTotal += exp.amount;
    });

    todayTotalEl.textContent = `₹ ${todayTotal.toFixed(2)}`;
    monthTotalEl.textContent = `₹ ${monthTotal.toFixed(2)}`;
    totalEntriesEl.textContent = allExpenses.length;

    if (userBudget === 0) {
        remainingMoneyEl.textContent = "Set Budget";
        remainingMoneyEl.style.color = "#333";
    } else {
        const remaining = userBudget - monthTotal;
        remainingMoneyEl.textContent = `₹ ${remaining.toFixed(2)}`;
        remainingMoneyEl.style.color = remaining < 0 ? "#ef4444" : "#10b981";
    }
}

function updateCharts() {
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    const ctxMon = document.getElementById('monthlyChart').getContext('2d');

    const catData = {};
    allExpenses.forEach(exp => {
        const c = exp.category || 'Others';
        catData[c] = (catData[c] || 0) + exp.amount;
    });

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Expenses by Category', font: { size: 14, weight: '600' } },
                legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, font: { size: 11 } } }
            }
        }
    });

    const monData = {};
    allExpenses.forEach(exp => {
        const m = new Date(exp.dateRaw).toLocaleString('default', { month: 'short', year: 'numeric' });
        monData[m] = (monData[m] || 0) + exp.amount;
    });

    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(ctxMon, {
        type: 'bar',
        data: {
            labels: Object.keys(monData),
            datasets: [{
                label: 'Monthly Spending',
                data: Object.values(monData),
                backgroundColor: '#3b82f6',
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Monthly Trends', font: { size: 14, weight: '600' } },
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                x: { grid: { display: false } }
            }
        }
    });
}

monthFilter.addEventListener('change', renderExpenses);
categoryFilter.addEventListener('change', renderExpenses);
searchInput.addEventListener('input', renderExpenses);

function populateMonthFilter() {
    const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const months = new Set();
    months.add(currentMonthStr); // Always include current month
    allExpenses.forEach(exp => {
        if (exp.dateRaw) {
            const d = new Date(exp.dateRaw);
            const m = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.add(m);
        }
    });

    const sortedMonths = Array.from(months).sort((a, b) => new Date(b) - new Date(a));
    const previousSelection = monthFilter.value;

    monthFilter.innerHTML = '<option value="all">All Time</option>';
    sortedMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthFilter.appendChild(opt);
    });

    // On first load, default to current month
    if (isFirstLoad) {
        monthFilter.value = currentMonthStr;
        isFirstLoad = false;
    } else {
        // Preserve previous selection if it still exists
        const options = Array.from(monthFilter.options).map(o => o.value);
        if (options.includes(previousSelection)) {
            monthFilter.value = previousSelection;
        }
    }
}

function renderExpenses() {
    expenseList.innerHTML = '';
    const selectedMonth = monthFilter.value;
    const selectedCat = categoryFilter.value;
    const searchTxt = searchInput.value.toLowerCase();

    let filtered = allExpenses;

    if (selectedMonth !== 'all') {
        filtered = filtered.filter(exp => {
            if (!exp.dateRaw) return false;
            const m = new Date(exp.dateRaw).toLocaleString('default', { month: 'long', year: 'numeric' });
            return m === selectedMonth;
        });
    }

    if (selectedCat !== 'all') {
        filtered = filtered.filter(exp => exp.category === selectedCat);
    }

    if (searchTxt) {
        filtered = filtered.filter(exp => exp.purpose.toLowerCase().includes(searchTxt));
    }

    if (filtered.length === 0) {
        expenseList.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:40px; font-size:0.9rem;">No expenses found.</td></tr>';
    } else {
        filtered.forEach((expense, index) => {
            const row = document.createElement('tr');
            const isTemp = expense.id.startsWith('temp_');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td style="font-weight:500;">${expense.purpose}${isTemp ? ' <span style="color:#f59e0b;font-size:0.7rem;">⏳ pending sync</span>' : ''}</td>
                <td><span class="tag">${expense.category}</span></td>
                <td style="font-weight:700; color:#1a1a2e;">₹ ${expense.amount.toFixed(2)}</td>
                <td style="font-size:0.8rem; color:#6b7280;">${expense.dateDisplay}</td>
                <td class="action-buttons">
                    <button class="btn-edit" onclick="editExpense('${expense.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteExpense('${expense.id}')">Delete</button>
                </td>
            `;
            expenseList.appendChild(row);
        });
    }
}