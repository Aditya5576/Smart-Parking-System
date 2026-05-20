-- Smart Parking System - Database Schema
-- Run this on your local MySQL AND your Railway cloud MySQL

-- 1. Create the database (skip on Railway - it's already created for you)
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
-- NOTE: No FOREIGN KEY constraint to keep Railway MySQL compatibility simple
CREATE TABLE IF NOT EXISTS vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_no VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(20) DEFAULT NULL,
    assigned_slot VARCHAR(10) NOT NULL,
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    exit_time DATETIME DEFAULT NULL,
    bill_amount DECIMAL(10,2) DEFAULT NULL
);

-- 4. Insert slot data (only if slots table is empty)
INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT * FROM (SELECT 'A1', 'FREE', 10, NULL) AS tmp WHERE NOT EXISTS (SELECT 1 FROM slots LIMIT 1);

INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT 'A2', 'FREE', 20, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM slots WHERE slot_id = 'A2');

INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT 'A3', 'FREE', 30, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM slots WHERE slot_id = 'A3');

INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT 'A4', 'FREE', 40, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM slots WHERE slot_id = 'A4');

INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT 'B1', 'FREE', 15, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM slots WHERE slot_id = 'B1');

INSERT INTO slots (slot_id, status, distance, vehicle_type)
SELECT 'B2', 'FREE', 25, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM slots WHERE slot_id = 'B2');
