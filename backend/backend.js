const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();
const PORT = 3000;

console.log(process.env.TWELVE_DATA_API_KEY);

// Create database connection
const db = new sqlite3.Database('database.db');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
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

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

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
    const { username, password, avatar } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.run('INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)', [username, hash, avatar || null], function(err) {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.status(201).json({ message: 'User created successfully', user_id: this.lastID });
        }
    });
});

app.put('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { username, password, avatar } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.run('UPDATE users SET username = ?, password = ?, avatar = ? WHERE user_id = ?', [username, hash, avatar || null, user_id], function(err) {
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

app.get('/api/stock/price/:ticker', (req, res) => {
    const ticker = req.params.ticker;
    const url = `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
    fetch(url).then(response => response.json()).then(data => {
        res.json(data);
    }).catch(error => {
        res.status(500).json({ message: 'Error fetching stock data', error: error.message });
    });
});

app.get('api/stock/quote/:ticker', (req, res) => {
    const ticker = req.params.ticker;
    const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
    fetch(url).then(response => response.json()).then(data => {
        res.json(data);
    }).catch(error => {
        res.status(500).json({ message: 'Error fetching stock data', error: error.message });
    });
});

// Helper function to fetch current stock price
async function getCurrentPrice(ticker) {
    try {
        const url = `https://api.twelvedata.com/price?symbol\=${ticker}&apikey\=${process.env.TWELVE_DATA_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.price) {
            return parseFloat(data.price);
        } else {
            throw new Error('Price not available');
        }
    } catch (error) {
        throw new Error(`Failed to fetch current price: ${error.message}`);
    }
}

// Buy holdings - increase quantity or create new holding
app.post('/api/holdings/:user_id/buy', async (req, res) => {
    const user_id = req.params.user_id;
    let { ticker, type, name, price, quantity } = req.body;
    
    if (!ticker || !type || !name || quantity === undefined || quantity === null) {
        return res.status(400).json({ message: 'Ticker, type, name, and quantity are required' });
    }
    
    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be positive' });
    }
    
    // If price is empty, fetch current price
    if (price === undefined || price === null || price === '' || price === 0) {
        try {
            price = await getCurrentPrice(ticker);
        } catch (error) {
            return res.status(500).json({ message: 'Unable to fetch current price', error: error.message });
        }
    }
    
    if (price <= 0) {
        return res.status(400).json({ message: 'Price must be positive' });
    }
    
    // Check if holding already exists
    db.get('SELECT * FROM holding WHERE user_id = ? AND ticker = ?', [user_id, ticker], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (row) {
            // Update existing holding - calculate new average price
            const totalValue = (row.quantity * row.buyin_price) + (quantity * price);
            const newQuantity = row.quantity + quantity;
            const newAvgPrice = totalValue / newQuantity;
            
            db.run('UPDATE holding SET quantity = ?, buyin_price = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND record_id = ?', 
                [newQuantity, newAvgPrice, user_id, row.record_id], function(updateErr) {
                if (updateErr) {
                    res.status(500).json({ message: 'Database error', error: updateErr.message });
                } else {
                    res.status(200).json({ 
                        message: 'Holdings updated successfully', 
                        record_id: row.record_id,
                        new_quantity: newQuantity,
                        new_avg_price: newAvgPrice,
                        used_price: price
                    });
                }
            });
        } else {
            // Create new holding
            db.run('INSERT INTO holding (user_id, type, ticker, name, buyin_price, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', 
                [user_id, type, ticker, name, price, quantity], function(insertErr) {
                if (insertErr) {
                    res.status(500).json({ message: 'Database error', error: insertErr.message });
                } else {
                    res.status(201).json({ 
                        message: 'New holding created successfully', 
                        record_id: this.lastID,
                        quantity: quantity,
                        price: price,
                        used_price: price
                    });
                }
            });
        }
    });
});

// Sell holdings - decrease quantity or remove holding
app.post('/api/holdings/:user_id/sell', async (req, res) => {
    const user_id = req.params.user_id;
    let { ticker, quantity, price } = req.body;
    
    if (!ticker || quantity === undefined || quantity === null) {
        return res.status(400).json({ message: 'Ticker and quantity are required' });
    }
    
    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be positive' });
    }
    
    // If price is empty, fetch current price
    if (price === undefined || price === null || price === '' || price === 0) {
        try {
            price = await getCurrentPrice(ticker);
        } catch (error) {
            return res.status(500).json({ message: 'Unable to fetch current price', error: error.message });
        }
    }
    
    if (price <= 0) {
        return res.status(400).json({ message: 'Price must be positive' });
    }
    
    // Find existing holding
    db.get('SELECT * FROM holding WHERE user_id = ? AND ticker = ?', [user_id, ticker], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ message: 'Holding not found' });
        }
        
        if (row.quantity < quantity) {
            return res.status(400).json({ message: 'Insufficient quantity to sell' });
        }
        
        const newQuantity = row.quantity - quantity;
        const sellValue = quantity * price;
        
        if (newQuantity === 0) {
            // Remove holding completely
            db.run('DELETE FROM holding WHERE user_id = ? AND record_id = ?', [user_id, row.record_id], function(deleteErr) {
                if (deleteErr) {
                    res.status(500).json({ message: 'Database error', error: deleteErr.message });
                } else {
                    res.status(200).json({ 
                        message: 'Holding sold completely and removed', 
                        sold_quantity: quantity,
                        remaining_quantity: 0,
                        sell_price: price,
                        sell_value: sellValue
                    });
                }
            });
        } else {
            // Update quantity
            db.run('UPDATE holding SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND record_id = ?', 
                [newQuantity, user_id, row.record_id], function(updateErr) {
                if (updateErr) {
                    res.status(500).json({ message: 'Database error', error: updateErr.message });
                } else {
                    res.status(200).json({ 
                        message: 'Holdings sold successfully', 
                        record_id: row.record_id,
                        sold_quantity: quantity,
                        remaining_quantity: newQuantity,
                        sell_price: price,
                        sell_value: sellValue
                    });
                }
            });
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