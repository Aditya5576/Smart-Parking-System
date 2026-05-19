-- 1. Create the database
CREATE DATABASE IF NOT EXISTS smart_parking;
USE smart_parking;

-- 2. Create the slots table
CREATE TABLE IF NOT EXISTS slots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slot_id VARCHAR(10) NOT NULL UNIQUE,
    status ENUM('FREE', 'OCCUPIED') DEFAULT 'FREE',
    distance INT NOT NULL,
    vehicle_type VARCHAR(20) DEFAULT NULL
);

-- 3. Create the vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_no VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,
    assigned_slot VARCHAR(10) NOT NULL,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME DEFAULT NULL,
    bill_amount DECIMAL(10,2) DEFAULT NULL,
    FOREIGN KEY (assigned_slot) REFERENCES slots(slot_id)
);

-- 4. Insert some dummy data for testing
INSERT INTO slots (slot_id, status, distance, vehicle_type) VALUES
('A1', 'OCCUPIED', 10, 'Car'),
('A2', 'FREE', 20, NULL),
('A3', 'FREE', 30, NULL),
('A4', 'OCCUPIED', 40, 'Bike'),
('B1', 'FREE', 15, NULL),
('B2', 'FREE', 25, NULL);
