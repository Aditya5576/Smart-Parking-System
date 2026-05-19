# Smart Parking System - Starter App

A basic starter application to verify the tech stack connections (Frontend → Node.js → MySQL).

## Project Structure
- `/frontend` - HTML/CSS/Vanilla JS (Modern Dark UI)
- `/backend` - Node.js Express Server + MySQL DB Connection

## Step 1: Database Setup
1. Make sure you have MySQL installed and running.
2. Open MySQL Workbench (or command line).
3. Open and run the `backend/database.sql` script to create the `smart_parking` database and insert dummy data.
4. Ensure your credentials in `backend/db.js` match your local MySQL setup (Default: root / root123).

## Step 1.5: Compile the C++ Engine (CRITICAL)
Because this project uses a C++ Min Heap for allocation, you **must** compile the C++ file before starting the server.
1. Make sure you have a C++ compiler installed (like **MinGW-w64** for Windows).
2. Open a terminal and navigate to the `engine` folder:
   ```bash
   cd engine
   ```
3. Compile the file into an executable named `allocator.exe`:
   ```bash
   g++ allocator.cpp -o allocator.exe
   ```
   *(If you get a "command not found" error, you need to install MinGW and add it to your system PATH).*

## Step 2: Start the Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. You should see:
   - "Server running on port 5000"
   - "MySQL Connected Successfully!"

## Step 3: Run the Frontend
1. Open the `/frontend/index.html` file in your browser. (Using VS Code Live Server is recommended).
2. Click the **"Load Parking Slots"** button.
3. Verify that the UI successfully fetches and displays the data from your MySQL database!
