const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const authGuard = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

module.exports = (db) => {
    // Home — listings + stats for dashboard counter
    router.get('/', (req, res) => {
        db.query('SELECT * FROM food_posts WHERE status = "available" ORDER BY id DESC', (err, posts) => {
            if (err) throw err;
            db.query('SELECT COUNT(*) AS total FROM food_posts', (err2, stats) => {
                res.render('index', { posts, totalSaved: stats?.[0]?.total || 0 });
            });
        });
    });

    // Post food form
    router.get('/post-food', authGuard, (req, res) => res.render('post-food'));

    router.post('/add-post', authGuard, upload.single('image'), (req, res) => {
        const { food_name, quantity, expiry_date, category } = req.body;
        const image = req.file ? req.file.filename : null;
        const posted_by = req.session.user.id;
        db.query('INSERT INTO food_posts (food_name, quantity, expiry_date, category, image, posted_by) VALUES (?, ?, ?, ?, ?, ?)',
            [food_name, quantity, expiry_date, category, image, posted_by], (err) => {
                if (err) throw err;
                res.redirect('/');
            });
    });

    // Request a food item
    router.post('/request/:id', authGuard, (req, res) => {
        const requested_by = req.session.user.id;
        const food_post_id = req.params.id;
        db.query('SELECT * FROM requests WHERE food_post_id = ? AND requested_by = ?', [food_post_id, requested_by], (err, existing) => {
            if (existing && existing.length > 0) return res.redirect('/');
            db.query('INSERT INTO requests (food_post_id, requested_by) VALUES (?, ?)', [food_post_id, requested_by], (err2) => {
                if (err2) return res.send('Error processing request.');
                db.query('UPDATE food_posts SET status = "requested" WHERE id = ?', [food_post_id], () => res.redirect('/'));
            });
        });
    });

    // Profile
    router.get('/profile', authGuard, (req, res) => {
        const user = req.session.user;
        db.query('SELECT * FROM food_posts WHERE posted_by = ? ORDER BY id DESC', [user.id], (err, myPosts) => {
            res.render('profile', { user, myPosts: myPosts || [] });
        });
    });

    // Dashboard
    router.get('/dashboard', (req, res) => {
        db.query('SELECT COUNT(*) AS total FROM food_posts', (err, total) => {
            db.query('SELECT COUNT(*) AS requested FROM food_posts WHERE status = "requested"', (err2, requested) => {
                db.query('SELECT COUNT(*) AS users FROM users', (err3, users) => {
                    res.render('dashboard', {
                        totalShared: total?.[0]?.total || 0,
                        totalRequested: requested?.[0]?.requested || 0,
                        totalUsers: users?.[0]?.users || 0,
                        co2Saved: ((total?.[0]?.total || 0) * 2.5).toFixed(1)
                    });
                });
            });
        });
    });

    // Inbox — requests on my food posts
    router.get('/inbox', authGuard, (req, res) => {
        const sql = `
            SELECT r.id, r.status, r.created_at, fp.food_name, u.name AS requester_name, u.email AS requester_email
            FROM requests r
            JOIN food_posts fp ON r.food_post_id = fp.id
            JOIN users u ON r.requested_by = u.id
            WHERE fp.posted_by = ?
            ORDER BY r.created_at DESC`;
        db.query(sql, [req.session.user.id], (err, inbox) => {
            res.render('inbox', { inbox: inbox || [] });
        });
    });

    // Leaderboard
    router.get('/leaderboard', (req, res) => {
        const sql = `
            SELECT u.name, u.location, COUNT(fp.id) AS total_shared
            FROM users u
            LEFT JOIN food_posts fp ON fp.posted_by = u.id
            GROUP BY u.id
            ORDER BY total_shared DESC
            LIMIT 10`;
        db.query(sql, (err, leaders) => {
            res.render('leaderboard', { leaders: leaders || [] });
        });
    });

    // Users list (admin view)
    router.get('/users', authGuard, (req, res) => {
        db.query('SELECT id, name, email, location FROM users ORDER BY id DESC', (err, users) => {
            res.render('users', { users: users || [] });
        });
    });

    // Edit food post — show form
    router.get('/edit-post/:id', authGuard, (req, res) => {
        db.query('SELECT * FROM food_posts WHERE id = ? AND posted_by = ?', [req.params.id, req.session.user.id], (err, results) => {
            if (err || results.length === 0) return res.redirect('/profile');
            res.render('edit-post', { post: results[0] });
        });
    });

    // Edit food post — handle form submission
    router.post('/edit-post/:id', authGuard, upload.single('image'), (req, res) => {
        const { food_name, quantity, expiry_date, category } = req.body;
        const image = req.file ? req.file.filename : req.body.existing_image;
        db.query('UPDATE food_posts SET food_name=?, quantity=?, expiry_date=?, category=?, image=? WHERE id=? AND posted_by=?',
            [food_name, quantity, expiry_date, category, image, req.params.id, req.session.user.id], (err) => {
                if (err) return res.send('Error updating post.');
                res.redirect('/profile');
            });
    });

    // Delete food post
    router.post('/delete-post/:id', authGuard, (req, res) => {
        db.query('DELETE FROM food_posts WHERE id = ? AND posted_by = ?', [req.params.id, req.session.user.id], (err) => {
            if (err) return res.send('Error deleting post.');
            res.redirect('/profile');
        });
    });

    // Safety guidelines
    router.get('/safety', (req, res) => res.render('safety'));

    return router;
};
