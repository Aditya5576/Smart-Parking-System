const mysql = require('mysql2');

const pool = mysql.createPool({

    host: process.env.DB_HOST || 'localhost',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || 'root123',

    database: process.env.DB_NAME || 'smart_parking',

    port: process.env.DB_PORT || 3306,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined
});

// Test connection
pool.getConnection((err, connection) => {

    if (err) {

        console.error('MySQL Connection Error:', err);

    } else {

        console.log('MySQL Connected Successfully!');

        connection.release();
    }

});

module.exports = pool.promise();