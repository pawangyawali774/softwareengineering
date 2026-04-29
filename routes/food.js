const express = require('express');
const multer = require('multer');
const path = require('path');
const https = require('https');
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

// Fetch weather from OpenWeatherMap (free tier)
function getWeather(city) {
    return new Promise((resolve) => {
        const apiKey = process.env.WEATHER_API_KEY || '';
        if (!apiKey) { console.log('No weather API key set'); return resolve(null); }
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        console.log('Fetching weather for:', city);
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log('Weather response:', json.main ? 'OK' : json.message);
                    if (json.main) resolve({ temp: json.main.temp, desc: json.weather[0].description, city: json.name });
                    else resolve(null);
                } catch (e) { console.log('Weather parse error:', e); resolve(null); }
            });
        }).on('error', (e) => { console.log('Weather fetch error:', e.message); resolve(null); });
    });
}

module.exports = (db) => {

    // Home
    router.get('/', (req, res) => {
        db.query('SELECT food_posts.*, users.name AS poster_name FROM food_posts LEFT JOIN users ON food_posts.posted_by = users.id WHERE status = "available" ORDER BY food_posts.id DESC', (err, posts) => {
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
                // Award 5 points for sharing food
                db.query('UPDATE users SET points = points + 5 WHERE id = ?', [posted_by], () => {
                    req.session.user.points = (req.session.user.points || 0) + 5;
                    res.redirect('/');
                });
            });
    });

    // Request a food item
    router.post('/request/:id', authGuard, (req, res) => {
        const requested_by = req.session.user.id;
        const food_post_id = req.params.id;
        // Block self-requests
        db.query('SELECT posted_by FROM food_posts WHERE id = ?', [food_post_id], (err, rows) => {
            if (err || !rows || rows.length === 0) return res.redirect('/');
            if (rows[0].posted_by == requested_by) return res.redirect('/');
            
            // Check if already requested
            db.query('SELECT * FROM requests WHERE food_post_id = ? AND requested_by = ?', [food_post_id, requested_by], (err2, existing) => {
                if (existing && existing.length > 0) return res.redirect('/');
                
                // Create request
                db.query('INSERT INTO requests (food_post_id, requested_by) VALUES (?, ?)', [food_post_id, requested_by], (err3) => {
                    if (err3) return res.send('Error processing request.');
                    // Award 2 points for requesting food
                    db.query('UPDATE users SET points = points + 2 WHERE id = ?', [requested_by], () => {
                        req.session.user.points = (req.session.user.points || 0) + 2;
                        db.query('UPDATE food_posts SET status = "requested" WHERE id = ?', [food_post_id], () => res.redirect('/'));
                    });
                });
            });
        });
    });

    // ── BASIC MATCHING ──────────────────────────────────────────────
    // Match posts by categories the user has previously requested
    router.get('/matches', authGuard, (req, res) => {
        const userId = req.session.user.id;
        // Get categories the user has requested before
        const categorySql = `
            SELECT DISTINCT fp.category FROM requests r
            JOIN food_posts fp ON r.food_post_id = fp.id
            WHERE r.requested_by = ?`;
        db.query(categorySql, [userId], (err, cats) => {
            if (err || cats.length === 0) {
                return res.render('matches', { basic: [], advanced: [], weather: null });
            }
            const categories = cats.map(c => c.category);
            const placeholders = categories.map(() => '?').join(',');

            // Basic match: same category, available, not posted by self
            const basicSql = `
                SELECT fp.*, users.name AS poster_name,
                       ${categories.map(c => `IF(fp.category = '${c}', 1, 0)`).join(' + ')} AS match_score
                FROM food_posts fp
                LEFT JOIN users ON fp.posted_by = users.id
                WHERE fp.status = 'available'
                  AND fp.posted_by != ?
                  AND fp.category IN (${placeholders})
                ORDER BY match_score DESC LIMIT 10`;
            db.query(basicSql, [userId, ...categories], (err2, basic) => {

                // Advanced match: category weight 0.5 + location weight 0.3 + recency weight 0.2
                const userLocation = req.session.user.location || '';
                const advancedSql = `
                    SELECT fp.*, users.name AS poster_name, users.location AS poster_location,
                        ROUND(
                            (${categories.map(c => `IF(fp.category = '${c}', 1, 0)`).join(' + ')} * 0.5) +
                            (IF(users.location = ?, 1, 0) * 0.3) +
                            (IF(fp.expiry_date >= CURDATE(), 1, 0) * 0.2)
                        , 2) AS advanced_score
                    FROM food_posts fp
                    LEFT JOIN users ON fp.posted_by = users.id
                    WHERE fp.status = 'available'
                      AND fp.posted_by != ?
                    ORDER BY advanced_score DESC LIMIT 10`;
                db.query(advancedSql, [userLocation, userId], (err3, advanced) => {
                    res.render('matches', { basic: basic || [], advanced: advanced || [], weather: null });
                });
            });
        });
    });

    // Profile
    router.get('/profile', authGuard, (req, res) => {
        const user = req.session.user;
        db.query('SELECT * FROM users WHERE id = ?', [user.id], (err, uRows) => {
            const freshUser = uRows?.[0] || user;
            req.session.user = freshUser;
            db.query('SELECT * FROM food_posts WHERE posted_by = ? ORDER BY id DESC', [user.id], (err2, myPosts) => {
                res.render('profile', { user: freshUser, myPosts: myPosts || [] });
            });
        });
    });

    // Dashboard with weather
    router.get('/dashboard', async (req, res) => {
        const city = req.session.user?.location || 'Greenwich';
        const weather = await getWeather(city);
        db.query('SELECT COUNT(*) AS total FROM food_posts', (err, total) => {
            db.query('SELECT COUNT(*) AS requested FROM food_posts WHERE status = "requested"', (err2, requested) => {
                db.query('SELECT COUNT(*) AS users FROM users', (err3, users) => {
                    res.render('dashboard', {
                        totalShared: total?.[0]?.total || 0,
                        totalRequested: requested?.[0]?.requested || 0,
                        totalUsers: users?.[0]?.users || 0,
                        co2Saved: ((total?.[0]?.total || 0) * 2.5).toFixed(1),
                        weather
                    });
                });
            });
        });
    });

    // Inbox
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

    // Leaderboard — show points
    router.get('/leaderboard', (req, res) => {
        const sql = `
            SELECT u.name, u.location, u.points, COUNT(fp.id) AS total_shared
            FROM users u
            LEFT JOIN food_posts fp ON fp.posted_by = u.id
            GROUP BY u.id
            ORDER BY u.points DESC, total_shared DESC
            LIMIT 10`;
        db.query(sql, (err, leaders) => {
            res.render('leaderboard', { leaders: leaders || [] });
        });
    });

    // Users list with avg rating
    router.get('/users', authGuard, (req, res) => {
        const sql = `
            SELECT u.id, u.name, u.email, u.location, u.points,
                   ROUND(AVG(r.score), 1) AS avg_rating,
                   COUNT(r.id) AS rating_count
            FROM users u
            LEFT JOIN ratings r ON r.rated_user = u.id
            GROUP BY u.id
            ORDER BY u.points DESC`;
        db.query(sql, (err, users) => {
            res.render('users', { users: users || [] });
        });
    });

    // Submit rating
    router.post('/rate/:id', authGuard, (req, res) => {
        const rated_user = req.params.id;
        const rated_by = req.session.user.id;
        const score = parseInt(req.body.score);
        if (rated_user == rated_by) return res.redirect('/users');
        db.query('INSERT INTO ratings (rated_user, rated_by, score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score = ?',
            [rated_user, rated_by, score, score], () => res.redirect('/users'));
    });

    // ── MESSAGING ───────────────────────────────────────────────────
    router.get('/messages', authGuard, (req, res) => {
        const userId = req.session.user.id;
        // Get all users except self for the user list
        db.query('SELECT id, name FROM users WHERE id != ?', [userId], (err, users) => {
            const toId = req.query.to || (users[0]?.id);
            if (!toId) return res.render('messages', { users, messages: [], toUser: null });
            db.query('SELECT id, name FROM users WHERE id = ?', [toId], (err2, toRows) => {
                const sql = `
                    SELECT m.*, u.name AS sender_name FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE (m.sender_id = ? AND m.receiver_id = ?)
                       OR (m.sender_id = ? AND m.receiver_id = ?)
                    ORDER BY m.created_at ASC`;
                db.query(sql, [userId, toId, toId, userId], (err3, messages) => {
                    res.render('messages', { users, messages: messages || [], toUser: toRows[0] || null });
                });
            });
        });
    });

    router.post('/messages/send', authGuard, (req, res) => {
        const { receiver_id, content } = req.body;
        const sender_id = req.session.user.id;
        db.query('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [sender_id, receiver_id, content], () => {
                res.redirect(`/messages?to=${receiver_id}`);
            });
    });

    // Accept / Cancel request
    router.post('/request/:id/accept', authGuard, (req, res) => {
        db.query('SELECT food_post_id FROM requests WHERE id = ?', [req.params.id], (err, rows) => {
            if (err || !rows || rows.length === 0) return res.redirect('/inbox');
            const food_post_id = rows[0].food_post_id;
            db.query('UPDATE requests SET status = "accepted" WHERE id = ?', [req.params.id], () => {
                db.query('UPDATE food_posts SET status = "accepted" WHERE id = ?', [food_post_id], () => {
                    res.redirect('/inbox');
                });
            });
        });
    });

    router.post('/request/:id/cancel', authGuard, (req, res) => {
        db.query('SELECT food_post_id FROM requests WHERE id = ?', [req.params.id], (err, rows) => {
            if (err || !rows || rows.length === 0) return res.redirect('/inbox');
            const food_post_id = rows[0].food_post_id;
            db.query('UPDATE requests SET status = "cancelled" WHERE id = ?', [req.params.id], () => {
                db.query('UPDATE food_posts SET status = "available" WHERE id = ?', [food_post_id], () => {
                    res.redirect('/inbox');
                });
            });
        });
    });

    // Edit food post
    router.get('/edit-post/:id', authGuard, (req, res) => {
        db.query('SELECT * FROM food_posts WHERE id = ? AND posted_by = ?', [req.params.id, req.session.user.id], (err, results) => {
            if (err || results.length === 0) return res.redirect('/profile');
            res.render('edit-post', { post: results[0] });
        });
    });

    router.post('/edit-post/:id', authGuard, upload.single('image'), (req, res) => {
        const { food_name, quantity, expiry_date, category } = req.body;
        const image = req.file ? req.file.filename : req.body.existing_image;
        db.query('UPDATE food_posts SET food_name=?, quantity=?, expiry_date=?, category=?, image=? WHERE id=? AND posted_by=?',
            [food_name, quantity, expiry_date, category, image, req.params.id, req.session.user.id], (err) => {
                if (err) return res.send('Error updating post.');
                res.redirect('/profile');
            });
    });

    router.post('/delete-post/:id', authGuard, (req, res) => {
        db.query('DELETE FROM food_posts WHERE id = ? AND posted_by = ?', [req.params.id, req.session.user.id], (err) => {
            if (err) return res.send('Error deleting post.');
            res.redirect('/profile');
        });
    });

    router.get('/safety', (req, res) => res.render('safety'));

    return router;
};
