const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

module.exports = (db) => {
    router.get('/login', (req, res) => res.render('login'));
    router.get('/signup', (req, res) => res.render('signup'));

    router.post('/auth/signup', async (req, res) => {
        const { name, email, location, password } = req.body;
        const hash = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (name, email, location, password) VALUES (?, ?, ?, ?)',
            [name, email, location, hash], (err) => {
                if (err) return res.render('signup', { error: 'Email already exists.' });
                res.redirect('/login');
            });
    });

    router.post('/auth/login', (req, res) => {
        const { email, password } = req.body;
        db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email], async (err, results) => {
            if (err || results.length === 0) return res.render('login', { error: 'Invalid email or password.' });
            const match = await bcrypt.compare(password, results[0].password);
            if (!match) return res.render('login', { error: 'Invalid email or password.' });
            req.session.user = results[0];
            res.redirect('/');
        });
    });

    router.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/');
    });

    return router;
};
