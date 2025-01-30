const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',  // Change if using a different user
    password: '',  // Change to your MySQL password
    database: 'users_itransition'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Connected to MySQL Database');
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Serve Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/dashboard', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.redirect('/');
    }
});

//Register User & Save to Database

app.post('/register', async (req, res) => {
    const { email, password, name, address } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO users (email, password, name, address, `Added In`, `Last login`, Status) VALUES (?, ?, ?, ?, NOW(), NOW(), ?)', 
    [email, hashedPassword, name, address, 'active'], (err) => {
                if (err && err.code === 'ER_DUP_ENTRY') {
                    // Handle duplicate entry error
                    return res.json({ 
                        success: false, 
                        message: "This email is already registered. Please use a different one.",
                        error: true
                    });}

                else{

                    return res.json({ 
                        success: true, 
                        message: "Successfully registered. Go to the login",
                        error: false
                    });}              
    });
});


app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (err) {
            return res.json({ success: false, message: "Database error!" });
        }

        if (result.length === 0) {
            return res.json({ success: false, message: "Email is not registered." });
        }

        const user = result[0];

        if (user.Status === 'blocked') {
            return res.json({ success: false, message: "Account is Blocked." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: "Incorrect Password." });
        }


        req.session.user = email;
        res.json({ success: true, redirect: "/dashboard" });
    });
});




app.post('/blockUsers', (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const placeholders = userIds.map(() => '?').join(',');
    db.query(`UPDATE users SET status = 'blocked' WHERE email IN (${placeholders})`, userIds, (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

// Unblock selected users
app.post('/unblockUsers', (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const placeholders = userIds.map(() => '?').join(',');
    db.query(`UPDATE users SET status = 'active' WHERE email IN (${placeholders})`, userIds, (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

// Delete selected users (Fixed Syntax Error)
app.post('/deleteUsers', (req, res) => {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "Invalid request" });
    }

    const placeholders = userIds.map(() => '?').join(',');
    db.query(`DELETE FROM users WHERE email IN (${placeholders})`, userIds, (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

// Fetch all users for dashboard (Optimized)
app.get('/getUsers', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    db.query('SELECT email, name, address, `Added In`, `Last Login`, status FROM users', (err, results) => {
        if (err) throw err;

                // Format the date fields before sending
                const formattedResults = results.map(user => ({
                    ...user,
                    'Added In': user['Added In'].toISOString(),
                    'Last Login': user['Last Login'].toISOString(),
                }));
        
                res.json(formattedResults);

        // Format the date fields before sending

        //res.json(formattedResults);
    });
});

// Check Session for Dashboard
app.get('/user', (req, res) => {
    if (!req.session.user) {
        return res.json({});
    }

    db.query('SELECT name FROM users WHERE email = ?', [req.session.user], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (result.length === 0) {
            return res.json({});
        }
        res.json({ email: req.session.user, name: result[0].name });
    });
});

// Logout
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));








