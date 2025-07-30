// const sqlite3 = require('sqlite3').verbose();
const sqlite3 = require('sqlite3')
const express = require('express');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const PORT = 3000;

// console.log(process.env.TWELVE_DATA_API_KEY);

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

    db.run(`
        CREATE TABLE IF NOT EXISTS portfolio_name (
            stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'currency')) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticker) REFERENCES holding(ticker)
        )    
    `)
});

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

app.get('/', (req, res) => {
    // res.send('Hello World');
    res.sendFile(__dirname, '..', 'public', 'index.html');
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

// app.get('/api/users/:user_id', (req, res) => {
//     const user_id = req.params.user_id;
//     db.get('SELECT * FROM users WHERE user_id = ?', [user_id], (err, row) => {
//         if (err) {
//             res.status(500).json({ message: 'Database error', error: err.message });
//         } else if (!row) {
//             res.status(404).json({ message: 'User not found' });
//         } else {
//             res.json(row);
//         }
//     });
// });

// Create a new user
app.post('/api/users/', (req, res) => {
    const { username, password, avatar } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Check if username already exists
    db.get('SELECT user_id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (row) {
            return res.status(409).json({ message: 'Username already exists' });
        }
        
        // Hash the password
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        
        // Create new user
        db.run('INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)', [username, hash, avatar || null], function(err) {
            if (err) {
                res.status(500).json({ message: 'Database error', error: err.message });
            } else {
                res.status(201).json({ 
                    message: 'User created successfully', 
                    user_id: this.lastID,
                    username: username
                });
            }
        });
    });
});

// Check password correctness for a specific user
app.post('/api/users/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ message: 'Password is required' });
    }
    
    // Get user from database
    db.get('SELECT user_id, username, password FROM users WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        
        if (!row) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Hash the provided password and compare
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        
        if (hash === row.password) {
            res.status(200).json({ 
                message: 'Password is correct',
                user_id: row.user_id,
                username: row.username
            });
        } else {
            res.status(401).json({ message: 'Password is incorrect' });
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

app.get('/api/stock/quote/:ticker', (req, res) => {
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
        const url = `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
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

// Helper function to get cached ticker info from database
async function getCachedTickerInfo(ticker) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM portfolio_name WHERE ticker = ?', [ticker], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to save/update ticker info in cache
async function saveCachedTickerInfo(ticker, name, type) {
    return new Promise((resolve, reject) => {
        // First try to update existing record
        db.run('UPDATE portfolio_name SET name = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE ticker = ?', 
            [name, type, ticker], function(err) {
            if (err) {
                reject(err);
            } else if (this.changes === 0) {
                // No existing record, insert new one
                db.run('INSERT INTO portfolio_name (ticker, name, type, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                    [ticker, name, type], function(insertErr) {
                    if (insertErr) {
                        reject(insertErr);
                    } else {
                        resolve({ inserted: true, id: this.lastID });
                    }
                });
            } else {
                resolve({ updated: true });
            }
        });
    });
}

// Helper function to fetch ticker info from API
async function fetchTickerInfoFromAPI(ticker) {
    try {
        // Use quote endpoint to get both name and instrument type
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const quoteResponse = await fetch(quoteUrl);
        const quoteData = await quoteResponse.json();
        
        let name = null;
        let type = 'stock'; // default fallback
        
        // Get name from quote data
        if (quoteData.name) {
            name = quoteData.name;
        }
        
        // Get type from symbol search for better type detection
        try {
            const searchUrl = `https://api.twelvedata.com/symbol_search?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();
            
            if (searchData.data && searchData.data.length > 0) {
                const instrumentType = searchData.data[0].instrument_type;
                
                if (instrumentType) {
                    const typeStr = instrumentType.toLowerCase();
                    if (typeStr.includes('bond')) {
                        type = 'bond';
                    } else if (typeStr.includes('stock') || typeStr.includes('common stock')) {
                        type = 'stock';
                    } else if (typeStr.includes('fund') || typeStr.includes('etf')) {
                        type = 'fund';
                    }
                }
            }
        } catch (typeError) {
            console.warn(`Failed to get type for ${ticker}, using default 'stock':`, typeError.message);
        }
        
        if (!name) {
            throw new Error('Name not available from API');
        }
        
        return { name, type };
    } catch (error) {
        throw new Error(`Failed to fetch ticker info from API: ${error.message}`);
    }
}

async function getCurrentName(ticker) {
    try {
        ticker = ticker.toUpperCase(); // Normalize ticker case
        
        // First check cache
        const cached = await getCachedTickerInfo(ticker);
        if (cached) {
            return cached.name;
        }
        
        // Not in cache, fetch from API
        const apiData = await fetchTickerInfoFromAPI(ticker);
        
        // Save to cache
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);
        
        return apiData.name;
    } catch (error) {
        throw new Error(`Failed to fetch current name: ${error.message}`);
    }
}

async function getCurrentType(ticker) {
    try {
        ticker = ticker.toUpperCase(); // Normalize ticker case
        
        // First check cache
        const cached = await getCachedTickerInfo(ticker);
        if (cached) {
            return cached.type;
        }
        
        // Not in cache, fetch from API
        const apiData = await fetchTickerInfoFromAPI(ticker);
        
        // Save to cache
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);
        
        return apiData.type;
    } catch (error) {
        throw new Error(`Failed to fetch current type: ${error.message}`);
    }
}

// Combined function to get both name and type efficiently
// This reduces API calls by fetching both pieces of info in one go
async function getTickerInfo(ticker) {
    try {
        ticker = ticker.toUpperCase(); // Normalize ticker case
        
        // First check cache - no API call needed if data exists
        const cached = await getCachedTickerInfo(ticker);
        if (cached) {
            console.log(`Using cached data for ${ticker}`);
            return { name: cached.name, type: cached.type };
        }
        
        // Not in cache, fetch from API and cache the result
        console.log(`Fetching new data for ${ticker} from API`);
        const apiData = await fetchTickerInfoFromAPI(ticker);
        
        // Save to cache for future requests
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);
        
        return apiData;
    } catch (error) {
        throw new Error(`Failed to fetch ticker info: ${error.message}`);
    }
}

// Buy holdings - increase quantity or create new holding
app.post('/api/holdings/:user_id/buy', async (req, res) => {
    const user_id = req.params.user_id;
    let { ticker, type, name, price, quantity } = req.body;
    
    if (!ticker || quantity === undefined || quantity === null) {
        return res.status(400).json({ message: 'Ticker and quantity are required' });
    }
    
    // Normalize ticker to uppercase for consistency
    ticker = ticker.toUpperCase();
    
    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be positive' });
    }
    
    // Check if we need to fetch both name and type
    const needsType = !type || (type !== 'gold' && type !== 'currency');
    const needsName = !name || name.trim() === '';
    
    // If user selected currency or gold, don't fetch name or price - just use defaults
    if (type === 'gold' || type === 'currency') {
        // For currency/gold, use ticker as name if not provided
        if (!name || name.trim() === '') {
            name = ticker;
        }
        // For currency/gold, require manual price input
        if (price === undefined || price === null || price === '' || price === 0) {
            return res.status(400).json({ 
                message: 'Price is required for currency and gold transactions. Please provide the price field manually.',
                error: 'Manual price input required for currency/gold'
            });
        }
    } else {
        // Only fetch for stock/bond/fund types
        if (needsType && needsName) {
            // Fetch both name and type together for efficiency
            try {
                const tickerInfo = await getTickerInfo(ticker);
                name = tickerInfo.name;
                type = tickerInfo.type;
            } catch (error) {
                // If fetching both fails, try to provide fallbacks
                console.warn(`Failed to fetch ticker info for ${ticker}:`, error.message);
                if (needsType) {
                    type = 'stock'; // fallback type
                }
                if (needsName) {
                    console.warn(`Failed to fetch name for ${ticker}, requiring manual input:`, error.message);
                    return res.status(400).json({ 
                        message: 'Unable to auto-detect name. Please provide the name field manually.',
                        error: 'Name detection service unavailable'
                    });
                }
            }
        } else {
            // Fetch individually if only one is needed
            if (needsType) {
                try {
                    type = await getCurrentType(ticker);
                } catch (error) {
                    console.warn(`Failed to auto-detect type for ${ticker}, defaulting to stock:`, error.message);
                    type = 'stock';
                }
            }
            
            if (needsName) {
                try {
                    name = await getCurrentName(ticker);
                } catch (error) {
                    console.warn(`Failed to fetch name for ${ticker}, requiring manual input:`, error.message);
                    return res.status(400).json({ 
                        message: 'Unable to auto-detect name. Please provide the name field manually.',
                        error: 'Name detection service unavailable'
                    });
                }
            }
        }
        
        // If price is empty, fetch current price (only for non-currency/gold)
        if (price === undefined || price === null || price === '' || price === 0) {
            try {
                price = await getCurrentPrice(ticker);
            } catch (error) {
                console.warn(`Failed to fetch price for ${ticker}, requiring manual input:`, error.message);
                return res.status(400).json({ 
                    message: 'Unable to auto-detect price. Please provide the price field manually.',
                    error: 'Price detection service unavailable'
                });
            }
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
                        used_price: price,
                        detected_type: type
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
                        used_price: price,
                        detected_type: type
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
            console.warn(`Failed to fetch price for ${ticker}, requiring manual input:`, error.message);
            return res.status(400).json({ 
                message: 'Unable to auto-detect price. Please provide the price field manually.',
                error: 'Price detection service unavailable'
            });
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

// Endpoint to refresh cached ticker info (useful for admin or when data is stale)
app.post('/api/cache/refresh/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    
    try {
        console.log(`Manually refreshing cache for ${ticker}`);
        const apiData = await fetchTickerInfoFromAPI(ticker);
        
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);
        
        res.status(200).json({ 
            message: `Cache refreshed successfully for ${ticker}`,
            data: apiData
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Failed to refresh cache', 
            error: error.message 
        });
    }
});

// Endpoint to get cache status
app.get('/api/cache/status', (req, res) => {
    db.all('SELECT ticker, name, type, updated_at FROM portfolio_name ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            res.json({
                message: 'Cache status retrieved successfully',
                cached_tickers: rows.length,
                data: rows
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