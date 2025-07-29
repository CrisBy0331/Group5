const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// Create database connection
const db = new sqlite3.Database('database.db');

console.log('Generating test data...');

// Sample data for holdings
const holdingsData = [
    { type: 'stock', ticker: 'AAPL', name: 'Apple Inc.', buyin_price: 150.25, quantity: 10 },
    { type: 'stock', ticker: 'GOOGL', name: 'Alphabet Inc.', buyin_price: 2750.00, quantity: 5 },
    { type: 'stock', ticker: 'MSFT', name: 'Microsoft Corporation', buyin_price: 320.50, quantity: 15 },
    { type: 'stock', ticker: 'TSLA', name: 'Tesla Inc.', buyin_price: 850.75, quantity: 8 },
    { type: 'fund', ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', buyin_price: 245.30, quantity: 25 },
    { type: 'fund', ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', buyin_price: 420.15, quantity: 12 },
    { type: 'bond', ticker: 'BOND001', name: 'US Treasury Bond 10Y', buyin_price: 1000.00, quantity: 3 },
    { type: 'bond', ticker: 'BOND002', name: 'Corporate Bond Fund', buyin_price: 950.50, quantity: 7 },
    { type: 'gold', ticker: 'GLD', name: 'SPDR Gold Shares', buyin_price: 185.75, quantity: 20 },
    { type: 'cash', ticker: 'CASH', name: 'Cash Reserve', buyin_price: 1.00, quantity: 5000 }
];

db.serialize(() => {
    // Create tables if they don't exist
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
            type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'cash')) NOT NULL,
            ticker TEXT NOT NULL,
            name TEXT NOT NULL,
            buyin_price REAL NOT NULL,
            quantity REAL NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);

    // Generate user
    const username = 'testuser';
    const password = 'testpassword123';
    const hash = crypto.createHash('sha256').update(password).digest('hex');

    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
        if (err) {
            console.error('Error creating user:', err);
            return;
        }
        
        const userId = this.lastID;
        console.log(`Created user: ${username} (ID: ${userId})`);
        console.log(`Password: ${password}`);
        
        // Generate holdings for the user
        let completedHoldings = 0;
        
        holdingsData.forEach((holding, index) => {
            db.run(
                'INSERT INTO holding (user_id, type, ticker, name, buyin_price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, holding.type, holding.ticker, holding.name, holding.buyin_price, holding.quantity],
                function(err) {
                    if (err) {
                        console.error(`Error creating holding ${index + 1}:`, err);
                    } else {
                        console.log(`Created holding ${index + 1}: ${holding.ticker} - ${holding.name}`);
                    }
                    
                    completedHoldings++;
                    if (completedHoldings === holdingsData.length) {
                        console.log('\nTest data generation completed!');
                        console.log(`Generated 1 user and ${holdingsData.length} holdings.`);
                        console.log('\nYou can now test the API with:');
                        console.log(`- User ID: ${userId}`);
                        console.log(`- Username: ${username}`);
                        console.log(`- Password: ${password}`);
                        db.close();
                    }
                }
            );
        });
    });
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nData generation interrupted');
    db.close();
    process.exit(0);
});