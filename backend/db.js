// db.js - Handles the MySQL connection
const mysql = require('mysql2');

// Create a connection pool using the provided credentials
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root123',
    database: 'smart_parking',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('MySQL Connection Error:', err.message);
        console.error('Make sure MySQL is running and the credentials are correct.');
    } else {
        console.log('MySQL Connected Successfully!');
        connection.release(); // release to pool
    }
});

// Export a promise-based interface for async/await usage in routes
module.exports = pool.promise();
