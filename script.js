import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const editDocIdInput = document.getElementById('editDocId');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');

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

// --- State ---
let currentUser = null;
let allExpenses = [];
let userBudget = 0;
let categoryChartInstance = null;
let monthlyChartInstance = null;
let toastTimeoutId = null;

// --- Auth ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userAvatar.src = user.photoURL || "https://via.placeholder.com/40";
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        loadUserExpenses();
        loadUserBudget();
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

// --- Custom Category ---
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

// --- Database ---

async function loadUserBudget() {
    if (!currentUser) return;
    const budgetRef = doc(db, "users", currentUser.uid, "settings", "budget");
    const docSnap = await getDoc(budgetRef);
    if (docSnap.exists()) {
        userBudget = parseFloat(docSnap.data().amount) || 0; 
        budgetInput.value = userBudget;
        
        updateSummaryCards(); 
    }
}

setBudgetBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    const val = parseFloat(budgetInput.value);
    if (!isNaN(val)) {
        userBudget = val;
        await setDoc(doc(db, "users", currentUser.uid, "settings", "budget"), { amount: val });
        
        updateSummaryCards();
        alert("Budget saved!");
    }
});

function loadUserExpenses() {
    if (!currentUser) return;
    const expensesRef = collection(db, "users", currentUser.uid, "expenses");
    const q = query(expensesRef, orderBy("dateRaw", "asc"));

    onSnapshot(q, (snapshot) => {
        allExpenses = [];
        snapshot.forEach((doc) => {
            allExpenses.push({ id: doc.id, ...doc.data() });
        });
        updateSummaryCards();
        updateCharts();
        populateMonthFilter();
        renderExpenses();
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const purpose = document.getElementById('purpose').value.trim();
    
    let catValue = categorySelect.value;
    if (catValue === 'Custom') {
        catValue = customCatInput.value.trim() || 'Others';
    }

    const amount = parseFloat(document.getElementById('amount').value);
    const docId = editDocIdInput.value;
    const now = new Date();

    if (purpose === '' || isNaN(amount) || amount <= 0) return;

    try {
        if (!docId) {
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), {
                purpose: purpose,
                category: catValue,
                amount: amount,
                dateRaw: now.toISOString(),
                dateDisplay: now.toLocaleString()
            });
            
            showDeleteToast(docRef.id, `Added ${purpose} (₹${amount})`);

        } else {
            await updateDoc(doc(db, "users", currentUser.uid, "expenses", docId), {
                purpose: purpose,
                category: catValue,
                amount: amount,
                dateRaw: now.toISOString(),
                dateDisplay: now.toLocaleString()
            });
            resetFormState();
        }
        form.reset();
        customCatInput.style.display = 'none';
        categorySelect.value = 'Food';
    } catch (error) { console.error(error); }
});

function showDeleteToast(docId, msg) {
    // Clear any existing timer immediately
    if (toastTimeoutId) clearTimeout(toastTimeoutId);

    toastMessage.textContent = msg;
    
    // Force show (remove class and set inline style)
    dynamicToast.classList.remove('hidden');
    dynamicToast.style.display = 'flex';
    
    // Set button action
    toastActionBtn.onclick = () => {
        deleteExpense(docId);
        hideToast();
    };

    // Reset Progress Bar Animation
    toastProgress.classList.remove('active');
    void toastProgress.offsetWidth; // Force reflow
    toastProgress.classList.add('active');

    // Set Timer
    toastTimeoutId = setTimeout(() => {
        hideToast();
    }, 5000);
}

function hideToast() {
    // Force hide (add class and set inline style)
    dynamicToast.classList.add('hidden');
    dynamicToast.style.display = 'none';

    // Stop Animation
    toastProgress.classList.remove('active');
    
    // Clear Timer
    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }
}

window.deleteExpense = (docId) => {
    deleteDoc(doc(db, "users", currentUser.uid, "expenses", docId));
};

// --- UI ---

window.editExpense = (docId) => {
    const expense = allExpenses.find(exp => exp.id === docId);
    if (!expense) return;

    document.getElementById('purpose').value = expense.purpose;
    
    const options = Array.from(categorySelect.options);
    const catExists = options.some(opt => opt.value === expense.category);
    if (catExists) {
        categorySelect.value = expense.category;
        customCatInput.style.display = 'none';
    } else {
        categorySelect.value = 'Custom';
        customCatInput.style.display = 'block';
        customCatInput.value = expense.category;
    }

    document.getElementById('amount').value = expense.amount;
    editDocIdInput.value = docId;
    
    submitBtn.textContent = "Update";
    submitBtn.classList.add('btn-update');
    cancelBtn.style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

cancelBtn.addEventListener('click', () => {
    resetFormState();
    form.reset();
    customCatInput.style.display = 'none';
});

function resetFormState() {
    editDocIdInput.value = "";
    submitBtn.textContent = "Add";
    submitBtn.classList.remove('btn-update');
    cancelBtn.style.display = 'none';
}

function updateSummaryCards() {
    const todayStr = new Date().toLocaleDateString();
    const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    let todayTotal = 0;
    let monthTotal = 0;

    allExpenses.forEach(exp => {
        if (exp.dateDisplay.startsWith(todayStr)) todayTotal += exp.amount;
        
        const d = new Date(exp.dateRaw);
        const expMonthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (expMonthStr === currentMonthStr) monthTotal += exp.amount;
    });

    todayTotalEl.textContent = `₹ ${todayTotal.toFixed(2)}`;
    monthTotalEl.textContent = `₹ ${monthTotal.toFixed(2)}`;
    totalEntriesEl.textContent = allExpenses.length;

    // --- UPDATED LOGIC: Remaining Money ---
    if (userBudget === 0) {
        remainingMoneyEl.textContent = "Set Budget";
        remainingMoneyEl.style.color = "#333";
    } else {
        const remaining = userBudget - monthTotal;
        remainingMoneyEl.textContent = `₹ ${remaining.toFixed(2)}`;
        if (remaining < 0) {
            remainingMoneyEl.style.color = "#e74c3c"; // Red
        } else {
            remainingMoneyEl.style.color = "#2ecc71"; // Green
        }
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
        type: 'pie',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Expenses by Category' } } }
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
                backgroundColor: '#4A90E2'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Monthly Trends' } } }
    });
}

monthFilter.addEventListener('change', renderExpenses);
categoryFilter.addEventListener('change', renderExpenses);
searchInput.addEventListener('input', renderExpenses);

function populateMonthFilter() {
    const months = new Set();
    allExpenses.forEach(exp => {
        if(exp.dateRaw) {
            const d = new Date(exp.dateRaw);
            const m = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.add(m);
        }
    });
    const sortedMonths = Array.from(months).sort((a, b) => new Date(b) - new Date(a));
    monthFilter.innerHTML = '<option value="all">All Time</option>';
    sortedMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        monthFilter.appendChild(opt);
    });
}

function renderExpenses() {
    expenseList.innerHTML = '';
    const selectedMonth = monthFilter.value;
    const selectedCat = categoryFilter.value;
    const searchTxt = searchInput.value.toLowerCase();

    let filtered = allExpenses;

    if (selectedMonth !== 'all') {
        filtered = filtered.filter(exp => {
            if(!exp.dateRaw) return false;
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
        expenseList.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:30px;">No expenses found.</td></tr>';
    } else {
        filtered.forEach((expense, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${expense.purpose}</td>
                <td><span class="tag">${expense.category}</span></td>
                <td style="font-weight:bold;">₹ ${expense.amount.toFixed(2)}</td>
                <td style="font-size:0.8rem; color:#666">${expense.dateDisplay}</td>
                <td class="action-buttons">
                    <button class="btn-edit" onclick="editExpense('${expense.id}')">Edit</button>
                    <button class="btn-delete" onclick="deleteExpense('${expense.id}')">Delete</button>
                </td>
            `;
            expenseList.appendChild(row);
        });
    }
}