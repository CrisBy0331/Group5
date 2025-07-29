const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const crypto = require('crypto');
const PORT = 3000;

// Create database connection
const db = new sqlite3.Database('database.db');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS holding (
            user_id INTEGER NOT NULL,
            record_id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'currency')) NOT NULL,
            ticker TEXT NOT NULL,
            name TEXT NOT NULL,
            buyin_price REAL NOT NULL,
            quantity REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);
});

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World');
});

app.get('/api/users', (req, res) => {
    db.all('SELECT * FROM users', (err, rows) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.get('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    db.get('SELECT * FROM users WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else if (!row) {
            res.status(404).json({ message: 'User not found' });
        } else {
            res.json(row);
        }
    });
});

app.post('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.status(201).json({ message: 'User created successfully', user_id: this.lastID });
        }
    });
});

app.put('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.run('UPDATE users SET username = ?, password = ? WHERE user_id = ?', [username, hash, user_id], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ message: 'User not found' });
        } else {
            res.status(200).json({ message: 'User updated successfully' });
        }
    });
});

app.delete('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    db.run('DELETE FROM users WHERE user_id = ?', [user_id], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else if (this.changes === 0) {
            res.status(200).json({ message: 'User not found or already deleted' });
        } else {
            res.status(200).json({ message: 'User deleted successfully' });
        }
    });
});

app.get('/api/holdings/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    db.all('SELECT * FROM holding WHERE user_id = ?', [user_id], (err, rows) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.status(200).json(rows);
        }
    });
});

app.post('/api/holdings/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { type, ticker, name, buyin_price, quantity } = req.body;
    
    if (!type || !ticker || !name || !buyin_price || !quantity) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    db.run('INSERT INTO holding (user_id, type, ticker, name, buyin_price, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', 
        [user_id, type, ticker, name, buyin_price, quantity], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.status(201).json({ message: 'Holding added successfully', record_id: this.lastID });
        }
    });
});

app.put('/api/holdings/:user_id/:record_id', (req, res) => {
    const user_id = req.params.user_id;
    const record_id = req.params.record_id;
    const { type, ticker, name, buyin_price, quantity } = req.body;
    
    if (!type || !ticker || !name || !buyin_price || !quantity) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    db.run('UPDATE holding SET type = ?, ticker = ?, name = ?, buyin_price = ?, quantity = ? WHERE user_id = ? AND record_id = ?', 
        [type, ticker, name, buyin_price, quantity, user_id, record_id], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ message: 'Holding not found' });
        } else {
            res.status(200).json({ message: 'Holding updated successfully' });
        }
    });
});

app.delete('/api/holdings/:user_id/:record_id', (req, res) => {
    const user_id = req.params.user_id;
    const record_id = req.params.record_id;
    db.run('DELETE FROM holding WHERE user_id = ? AND record_id = ?', [user_id, record_id], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else if (this.changes === 0) {
            res.status(200).json({ message: 'Holding not found or already deleted' });
        } else {
            res.status(200).json({ message: 'Holding deleted successfully' });
        }
    });
});

// Only start the server if this file is run directly (not imported for testing)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;