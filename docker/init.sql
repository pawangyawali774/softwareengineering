CREATE DATABASE IF NOT EXISTS food_db;
USE food_db;

CREATE TABLE IF NOT EXISTS users (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL,
  email    VARCHAR(100) UNIQUE NOT NULL,
  location VARCHAR(100),
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS food_posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  food_name   VARCHAR(100) NOT NULL,
  quantity    VARCHAR(50),
  expiry_date DATE,
  category    VARCHAR(50) DEFAULT 'Other',
  image       VARCHAR(255) DEFAULT NULL,
  status      VARCHAR(20) DEFAULT 'available',
  posted_by   INT DEFAULT NULL,
  FOREIGN KEY (posted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS requests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  food_post_id INT NOT NULL,
  requested_by INT NOT NULL,
  status       VARCHAR(20) DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (food_post_id) REFERENCES food_posts(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);
