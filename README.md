# 🚗 Smart Parking Management System

A modern full-stack Smart Parking Management System built using:

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express.js
- Database: MySQL
- Algorithm Engine: C++ Min Heap Allocation

---

# ✨ Features

## 🚘 Vehicle Entry
- Park vehicles dynamically
- Automatic nearest-slot allocation
- Real-time slot updates

## 🚪 Vehicle Exit
- Exit parked vehicles
- Automatic bill generation
- Slot recovery system

## 💳 Billing System
- ₹20 first hour
- ₹10 additional hours

## 🧠 C++ Min Heap Allocation
- High-performance nearest-slot allocation
- O(log N) allocation complexity
- Integrated with Node.js backend

## 📊 Dashboard
- Total Slots
- Occupied Slots
- Free Slots
- Total Earnings
- Recent Parking Activity

## 🎨 Modern UI
- Glassmorphism design
- Dark premium dashboard
- Responsive layout
- Hover animations

---

# 🏗️ Project Architecture

Frontend (HTML/CSS/JS)
↓
Node.js Backend (Express)
↓
MySQL Database
↓
C++ Min Heap Engine

---

# ⚙️ Tech Stack

| Technology | Usage |
|---|---|
| HTML/CSS/JS | Frontend UI |
| Node.js | Backend APIs |
| Express.js | Server Framework |
| MySQL | Database |
| C++ | Min Heap Allocation Engine |
| GitHub | Version Control |

---

# 🚀 How To Run

## 1. Start MySQL Server

Make sure MySQL server is running.

---

## 2. Start Backend

```bash
cd backend
node server.js
```

---

## 3. Start Frontend

Open:

frontend/index.html

using VS Code Live Server.

---

## 4. Compile C++ Engine

```bash
g++ allocator.cpp -static -static-libgcc -static-libstdc++ -o allocator.exe
```

---

# 🧠 Min Heap Logic

The parking allocation engine uses a Min Heap (Priority Queue) implemented in C++ to always assign the nearest available parking slot efficiently.

Time Complexity:
- Insertion: O(log N)
- Allocation: O(log N)

---

# 👨‍💻 Author

Aditya Patil
