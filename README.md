# 🌿 FoodShare — Community Food Sharing Platform

> A web application built for the University of Northampton BSc Computer Science module.  
> **Team:** Poor Guys | **Members:** Pawan Gnyawali, Sachin, Rakesh, Upendra, Dinesh

---

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Method 1: Run Locally with XAMPP](#method-1-run-locally-with-xampp)
- [Method 2: Run with Docker](#method-2-run-with-docker)
- [MySQL Database Setup](#mysql-database-setup)
- [Environment Variables](#environment-variables)
- [Pages & Routes](#pages--routes)
- [DevOps & CI/CD](#devops--cicd)

---

## 📖 About the Project

FoodShare is a community-driven platform that allows residents of Greenwich to share surplus food with their neighbours, reducing food waste and promoting sustainability. Users can post available food items, request items from others, and track the community's environmental impact.

---

## ✨ Features

| Feature           | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| 🔐 Auth           | Secure signup & login with bcrypt password hashing            |
| 🍎 Post Food      | Share food with name, category, quantity, expiry date & photo |
| 🤝 Request System | Request food items from other users                           |
| 📊 Dashboard      | Live sustainability stats — CO₂ saved, meals shared           |
| 📥 Inbox          | See who has requested your food items                         |
| 🏆 Leaderboard    | Top food sharers in the community                             |
| 👥 Members        | View all registered community members                         |
| 🛡️ Safety         | Food safety guidelines and allergen information               |

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express.js
- **Templating:** Pug
- **Database:** MySQL (via XAMPP or Docker)
- **Auth:** express-session, bcryptjs
- **File Uploads:** Multer
- **DevOps:** Docker, Docker Compose, GitHub Actions

---

## 📁 Project Structure

```
food-share-project/
├── .github/
│   └── workflows/
│       └── main.yml          ← GitHub Actions CI/CD
├── public/
│   └── css/
│       └── style.css
├── routes/
│   ├── auth.js               ← Login, Signup, Logout
│   └── food.js               ← All food-related routes
├── uploads/                  ← Uploaded food images
├── views/
│   ├── layout.pug
│   ├── index.pug
│   ├── login.pug
│   ├── signup.pug
│   ├── post-food.pug
│   ├── edit-post.pug
│   ├── profile.pug
│   ├── dashboard.pug
│   ├── inbox.pug
│   ├── leaderboard.pug
│   ├── users.pug
│   └── safety.pug
├── .env                      ← Environment variables (not committed)
├── .gitignore
├── docker-compose.yml        ← Docker orchestration
├── Dockerfile                ← Docker image definition
├── package.json
└── server.js                 ← Main entry point
```

---

## Method 1: Run Locally with XAMPP

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [XAMPP](https://www.apachefriends.org/) with MySQL

### Step 1 — Start XAMPP MySQL

```bash
sudo /opt/lampp/lampp startmysql
```

### Step 2 — Set Up the Database

Open the MySQL shell:

```bash
/opt/lampp/bin/mysql -u root -pYOUR_PASSWORD -h 127.0.0.1 -P 3306
```

Then run the full schema:

```sql
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
```

To exit the MySQL shell:

```sql
EXIT;
```

### Step 3 — Configure Environment

Create a `.env` file in the root folder:

```
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=food_db
PORT=3000
```

### Step 4 — Install Dependencies

```bash
npm install
```

### Step 5 — Run the App

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Visit: **http://localhost:3000**

---

## Method 2: Run with Docker

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### Step 1 — Build and Start Containers

```bash
docker-compose up --build
```

This will automatically:

- Build the Node.js app container
- Pull and start a MySQL 8.0 container
- Link them together on the same network

### Step 2 — Set Up the Database (first time only)

Wait for the containers to start (about 20 seconds), then run:

```bash
docker exec -it food-share-project-db-1 mysql -u root -psecret food_db
```

Then paste the SQL schema from the [MySQL Database Setup](#mysql-database-setup) section above and run it.

### Step 3 — Visit the App

Visit: **http://localhost:3000**

### Useful Docker Commands

```bash
#To run the whole app Mysql and frontend run this :

docker-compose up -d --build

#Then visit :http://localhost:3000

# Start containers in background
docker-compose up -d

# Stop containers
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild after code changes
docker-compose up --build

# Remove containers and volumes (full reset)
docker-compose down -v
```

---

## MySQL Database Setup

### Full Schema (copy and run this)

```sql
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
```

### Add Missing Columns (if upgrading from an older version)

```sql
ALTER TABLE food_posts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other';
ALTER TABLE food_posts ADD COLUMN IF NOT EXISTS image VARCHAR(255) DEFAULT NULL;
ALTER TABLE food_posts ADD COLUMN IF NOT EXISTS posted_by INT DEFAULT NULL;
```

---

## Environment Variables

| Variable  | Description    | Example     |
| --------- | -------------- | ----------- |
| `DB_HOST` | MySQL host     | `127.0.0.1` |
| `DB_USER` | MySQL username | `root`      |
| `DB_PASS` | MySQL password | `dinesh`    |
| `DB_NAME` | Database name  | `food_db`   |
| `PORT`    | App port       | `3000`      |

> ⚠️ Never commit your `.env` file to GitHub. It is listed in `.gitignore`.

---

## 📄 Pages & Routes

| Method | Route              | Description            | Auth Required |
| ------ | ------------------ | ---------------------- | ------------- |
| GET    | `/`                | Home — food listings   | No            |
| GET    | `/dashboard`       | Sustainability stats   | No            |
| GET    | `/leaderboard`     | Top food sharers       | No            |
| GET    | `/safety`          | Food safety guidelines | No            |
| GET    | `/users`           | All community members  | Yes           |
| GET    | `/login`           | Login page             | No            |
| GET    | `/signup`          | Signup page            | No            |
| POST   | `/auth/login`      | Handle login           | No            |
| POST   | `/auth/signup`     | Handle signup          | No            |
| GET    | `/logout`          | Logout                 | Yes           |
| GET    | `/post-food`       | Post food form         | Yes           |
| POST   | `/add-post`        | Submit food post       | Yes           |
| GET    | `/edit-post/:id`   | Edit food form         | Yes           |
| POST   | `/edit-post/:id`   | Save food edit         | Yes           |
| POST   | `/delete-post/:id` | Delete food post       | Yes           |
| POST   | `/request/:id`     | Request a food item    | Yes           |
| GET    | `/profile`         | User profile & posts   | Yes           |
| GET    | `/inbox`           | Requests on my posts   | Yes           |

---

## 🚀 DevOps & CI/CD

### GitHub Actions

Every push to the `main` branch automatically:

1. Checks out the code
2. Installs Node.js 18
3. Runs `npm install`
4. Runs `node --check server.js` to verify no syntax errors

To see the pipeline: Go to your GitHub repo → **Actions** tab → look for a ✅ green checkmark.

### Docker Architecture

```
┌─────────────────────────────────┐
│         docker-compose          │
│                                 │
│  ┌──────────┐   ┌────────────┐  │
│  │  app     │──▶│   db       │  │
│  │ Node:18  │   │ MySQL:8.0  │  │
│  │ port 3000│   │ port 3306  │  │
│  └──────────┘   └────────────┘  │
└─────────────────────────────────┘
```

---

## 👥 Team — Poor Guys

| Name           | Role                     |
| -------------- | ------------------------ | --- | -------------------- |
| Pawan Gnyawali | Team Lead & Backend      |     | UI/CSS & Integration |
| Sachin         | Frontend & Pug Templates |
| Rakesh         | Database & Routes        |
| Upendra        | DevOps & Testing         |

|

---

_BSc Computer Science — University of Northampton © 2026_
