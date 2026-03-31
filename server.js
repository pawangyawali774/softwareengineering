const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();

const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'food_db'
});

db.on('error', (err) => console.error('Database error:', err.message));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'foodshare-secret', resave: false, saveUninitialized: false }));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use('/', require('./routes/auth')(db));
app.use('/', require('./routes/food')(db));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
