# 💰 Daily Expense Pro

🔗 **Live Demo:** https://dailyexpensepro.vercel.app/

A modern, responsive web application that helps users track daily expenses effortlessly with real-time analytics, secure cloud storage, and an intuitive user interface.

---

## 📌 Problem Statement

Managing personal finances and tracking daily expenses is often neglected due to the tedious nature of manual spreadsheet entries or the complexity of traditional accounting software. Many individuals struggle to visualize their spending habits in real time, leading to poor budgeting decisions and month-end financial stress.

There is a strong need for a lightweight, accessible, and secure web application that simplifies expense tracking, provides instant visual feedback on financial health, and ensures data accessibility across devices without requiring a dedicated backend server.

---

## 🧾 Abstract

**Daily Expense Pro** is a responsive, full-stack web application designed to streamline personal finance management. It leverages **Firebase** for secure authentication and real-time data synchronization, and **Chart.js** for dynamic data visualization.

The platform supports Google Authentication, instant budget calculations, category-wise and monthly analytics, and a clean mobile-first interface. By eliminating traditional server-side complexity, the application delivers a fast, scalable, and user-friendly experience suitable for everyday expense tracking.

---

## 🚀 Features

### 🔐 Authentication & Security
- Google Sign-In using Firebase Authentication
- Persistent login sessions (remains logged in after refresh)
- Secure user-based data isolation (each user sees only their own data)

---

### 📊 Data Management (Firebase Firestore)
- Real-time cloud synchronization
- Full CRUD operations (Create, Read, Update, Delete expenses)
- Undo Delete feature with a **5-second recovery window**
- Visual progress timer for undo action

---

### 💰 Financial Tools
- Smart monthly budget setting
- Real-time remaining balance calculation
- Summary dashboard cards:
  - Today’s Spending
  - This Month’s Total
  - Total Entries
  - Highest Single Expense
- Automatic recalculation on every add, edit, or delete

---

### 📈 Data Visualization (Chart.js)
- 📊 Pie Chart: Category-wise expense breakdown
- 📉 Bar Chart: Monthly spending trends

---

### 🔍 Filtering & Organization
- Search expenses by purpose/name
- Filter expenses by:
  - Month
  - Category
- Custom user-defined expense categories

---

### 🎨 User Interface & Experience (UI/UX)
- Fully responsive design (mobile-first approach)
- Touch-friendly inputs and buttons
- Toast notifications for success and delete actions
- Automatic date & time logging for every expense
- Clean, minimal, and modern UI

---

## 🛠️ Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Authentication | Firebase Google Auth |
| Database | Firebase Firestore |
| Charts | Chart.js |
| Hosting | Vercel |

---

## 📱 Responsive Design

- **Mobile:** Stacked layout with optimized controls
- **Desktop:** Side-by-side dashboard and charts
- Works seamlessly across all screen sizes

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/daily-expense-pro.git
cd daily-expense-pro

👨‍💻 Author

Kotti Satyanarayana (Satya)
B.Tech – Computer Science & Engineering
RGUKT Srikakulam

🔗 Live Project: https://dailyexpensepro.vercel.app/
