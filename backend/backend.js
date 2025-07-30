const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
// const fetch = require('node-fetch'); // 如果您的 Node.js 版本低于 18，或者您想明确使用 node-fetch，请取消注释此行并安装 npm install node-fetch

dotenv.config();
const PORT = 3000;

// 确保您的 .env 文件中有 TWELVE_DATA_API_KEY
// console.log(process.env.TWELVE_DATA_API_KEY);

// 创建数据库连接
const db = new sqlite3.Database('database.db', (err) => {
    if (err) {
        console.error('数据库连接错误:', err.message);
    } else {
        console.log('成功连接到 SQLite 数据库。');
    }
});

// -------------------- 新增缓存配置 --------------------
const priceCache = {}; // 用于存储股票价格的内存缓存
// 缓存持续时间：5 分钟 (5 * 60 秒 * 1000 毫秒)。您可以根据需要调整这个值。
const CACHE_DURATION = 5 * 60 * 1000;
// ----------------------------------------------------

// 创建表
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
            type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'currency', 'cash')) NOT NULL,
            ticker TEXT NOT NULL,
            name TEXT NOT NULL,
            buyin_price REAL NOT NULL,
            quantity REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    `);

    // 注意：portfolio_name 表在您的代码中似乎用于缓存 ticker 的 name 和 type。
    // 这与我们新增的 priceCache 是独立的，且逻辑已在 getTickerInfo 中实现。
    // 确保这个表也是你希望有的缓存层。
    db.run(`
        CREATE TABLE IF NOT EXISTS portfolio_name (
            stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL UNIQUE, -- ticker 应该是唯一的
            name TEXT NOT NULL,
            type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'currency')) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            -- FOREIGN KEY (ticker) REFERENCES holding(ticker) - 这一行通常不推荐，因为它会限制 holding 表中 ticker 的灵活性
        )    
    `);
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
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- 用户管理路由 ---
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
    const user_id = req.params.user_id; // 这个 user_id 在 POST 新用户时通常不需要，或者表示为 path 参数是为了别的目的
    const { username, password, avatar } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.run('INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)', [username, hash, avatar || null], function(err) {
        if (err) {
            // 检查是否是唯一性约束错误 (例如 username 已经存在)
            if (err.message.includes('SQLITE_CONSTRAINT')) {
                return res.status(409).json({ message: 'Username already exists', error: err.message });
            }
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
            res.status(404).json({ message: 'User not found or already deleted' }); // 404 比 200 更准确
        } else {
            res.status(200).json({ message: 'User deleted successfully' });
        }
    });
});

// --- 持仓管理路由 ---
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

    db.run('UPDATE holding SET type = ?, ticker = ?, name = ?, buyin_price = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND record_id = ?',
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
            res.status(404).json({ message: 'Holding not found or already deleted' });
        } else {
            res.status(200).json({ message: 'Holding deleted successfully' });
        }
    });
});

// --- 股票价格和行情路由 (已添加缓存逻辑) ---
app.get('/api/stock/price/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase(); // 统一转为大写
    const now = Date.now();

    // 1. 检查缓存是否存在且未过期
    if (priceCache[ticker] && (now - priceCache[ticker].timestamp < CACHE_DURATION)) {
        console.log(`[缓存命中] 从缓存获取 ${ticker} 的价格: ${priceCache[ticker].price}`);
        return res.json({ ticker: ticker, price: priceCache[ticker].price });
    }

    // 2. 缓存过期或不存在，需要调用第三方 API
    console.log(`[缓存未命中/过期] 从第三方 API (Twelve Data) 获取 ${ticker} 的价格...`);
    let fetchedPrice = 0; // 默认价格为 0

    try {
        const url = `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        // 检查 Twelve Data API 响应中是否有价格数据或错误信息
        if (data && typeof data.price === 'string') { // Twelve Data 的 price 字段有时是字符串
            fetchedPrice = parseFloat(data.price);
        } else if (data && data.status === 'error') {
            console.error(`Twelve Data API 错误响应 (${ticker}):`, data.message);
            // 如果 API 返回错误，但缓存中有旧数据，使用旧缓存
            if (priceCache[ticker]) {
                fetchedPrice = priceCache[ticker].price;
                console.log(`API 错误，回退到 ${ticker} 的旧缓存价格: ${fetchedPrice}`);
            } else {
                fetchedPrice = 0; // 否则设置为0
            }
        } else {
            console.warn(`警告: 无法从 Twelve Data API 获取 ${ticker} 的有效价格。响应:`, data);
            if (priceCache[ticker]) { // 如果API响应结构不符合预期，但有缓存，则使用缓存
                fetchedPrice = priceCache[ticker].price;
                console.log(`API 响应异常，回退到 ${ticker} 的旧缓存价格: ${fetchedPrice}`);
            } else {
                fetchedPrice = 0;
            }
        }

        if (isNaN(fetchedPrice) || fetchedPrice <= 0) { // 如果解析后的价格无效或为0
            console.warn(`警告: ${ticker} 最终价格无效 (${fetchedPrice})。`);
            if (priceCache[ticker]) {
                fetchedPrice = priceCache[ticker].price; // 再次尝试使用旧缓存
                console.log(`已回退到 ${ticker} 的旧缓存价格: ${fetchedPrice}`);
            } else {
                fetchedPrice = 0; // 实在没有就设为0
            }
        }

        // 3. 更新缓存
        priceCache[ticker] = { price: fetchedPrice, timestamp: now };
        res.json({ ticker: ticker, price: fetchedPrice });

    } catch (error) {
        console.error(`错误: 从 Twelve Data 获取 ${ticker} 价格时发生异常:`, error);
        // API 调用失败时，尝试返回旧缓存数据
        if (priceCache[ticker]) {
            console.log(`API 调用失败，返回 ${ticker} 的旧缓存价格。`);
            return res.status(200).json({ ticker: ticker, price: priceCache[ticker].price }); // 200 OK 即使是旧数据
        }
        // 如果连旧缓存都没有，返回一个默认值0，避免前端崩溃
        res.status(500).json({ error: '无法获取股票价格', ticker: ticker, price: 0 });
    }
});

app.get('/api/stock/quote/:ticker', (req, res) => {
    const ticker = req.params.ticker;
    const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
    fetch(url).then(response => response.json()).then(data => {
        res.json(data);
    }).catch(error => {
        res.status(500).json({ message: 'Error fetching stock quote data', error: error.message });
    });
});

// Helper function to fetch current stock price (会使用我们新增的缓存机制)
async function getCurrentPrice(ticker) {
    const url = `http://localhost:${PORT}/api/stock/price/${ticker}`; // 调用自己的缓存API
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.price !== undefined && data.price !== null) {
            const price = parseFloat(data.price);
            if (!isNaN(price) && price > 0) {
                return price;
            } else {
                throw new Error(`Fetched price is invalid or zero: ${data.price}`);
            }
        } else {
            throw new Error('Price not available from API response');
        }
    } catch (error) {
        console.error(`Error in getCurrentPrice for ${ticker}: ${error.message}`);
        throw new Error(`Failed to fetch current price for ${ticker}: ${error.message}`);
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

// Helper function to save/update ticker info in cache (database)
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

// Helper function to fetch ticker info from API (Twelve Data)
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
        // 注意：symbol_search 是另一个端点，可能会有自己的速率限制，谨慎使用
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
                    } else if (typeStr.includes('gold')) { // 增加对黄金的检测
                        type = 'gold';
                    } else if (typeStr.includes('currency')) { // 增加对货币的检测
                        type = 'currency';
                    } else { // 如果没有匹配的，默认还是stock
                        type = 'stock';
                    }
                }
            }
        } catch (typeError) {
            console.warn(`Failed to get type for ${ticker} from symbol_search, using default 'stock':`, typeError.message);
        }

        if (!name) {
            throw new Error('Name not available from API');
        }

        return { name, type };
    } catch (error) {
        throw new Error(`Failed to fetch ticker info from API: ${error.message}`);
    }
}

// Combined function to get both name and type efficiently (从 database 缓存获取)
async function getTickerInfo(ticker) {
    try {
        ticker = ticker.toUpperCase(); // Normalize ticker case

        // First check database cache
        const cached = await getCachedTickerInfo(ticker);
        // 假设 portfolio_name 表的 updated_at 可以作为缓存过期判断
        // 或者直接认为只要有数据就使用，除非明确刷新
        // 更好的做法是也加一个 timestamp 和 CACHE_DURATION
        const now = Date.now();
        const dbCacheExpired = cached && (now - new Date(cached.updated_at).getTime() > CACHE_DURATION); // 使用和价格缓存一样的过期时间

        if (cached && !dbCacheExpired) {
            console.log(`Using database cached info for ${ticker}`);
            return { name: cached.name, type: cached.type };
        }

        // Not in database cache or expired, fetch from API and cache the result
        console.log(`Fetching new ticker info for ${ticker} from API (and saving to DB cache)`);
        const apiData = await fetchTickerInfoFromAPI(ticker);

        // Save to database cache for future requests
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);

        return apiData;
    } catch (error) {
        console.error(`Failed to fetch ticker info (name/type) for ${ticker}:`, error.message);
        // 如果获取失败，可以返回一个默认值
        return { name: ticker, type: 'stock' }; // 默认返回 ticker 作为名称，类型为 stock
    }
}

// Buy holdings - increase quantity or create new holding
app.post('/api/holdings/:user_id/buy', async (req, res) => {
    const user_id = req.params.user_id;
    let { ticker, type, name, price, quantity } = req.body;

    if (!ticker || quantity === undefined || quantity === null) {
        return res.status(400).json({ message: 'Ticker and quantity are required' });
    }

    ticker = ticker.toUpperCase(); // Normalize ticker to uppercase for consistency

    if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be positive' });
    }

    // --- 自动填充 name 和 type ---
    // 只有当 type 和 name 都为空时才调用 getTickerInfo，减少 API 调用
    if ((!type || type.trim() === '') || (!name || name.trim() === '')) {
        try {
            const tickerInfo = await getTickerInfo(ticker);
            if (!type || type.trim() === '') type = tickerInfo.type;
            if (!name || name.trim() === '') name = tickerInfo.name;
        } catch (error) {
            console.warn(`自动检测 ${ticker} 的名称/类型失败，请检查API或手动提供:`, error.message);
            // 如果获取失败，且前端没有提供 name，则要求手动输入
            if (!name || name.trim() === '') {
                 return res.status(400).json({
                    message: `Unable to auto-detect name for ${ticker}. Please provide the name field manually.`,
                    error: 'Name detection service unavailable'
                });
            }
            // 如果type也未提供，则默认为'stock'
            if (!type || type.trim() === '') type = 'stock';
        }
    }

    // --- 获取价格 ---
    if (price === undefined || price === null || price === '' || parseFloat(price) === 0) { // 检查 0
        try {
            price = await getCurrentPrice(ticker); // 调用我们自己的带缓存的API
        } catch (error) {
            console.warn(`自动检测 ${ticker} 的价格失败，请检查API或手动提供:`, error.message);
            return res.status(400).json({
                message: `Unable to auto-detect price for ${ticker}. Please provide the price field manually.`,
                error: 'Price detection service unavailable'
            });
        }
    } else {
        price = parseFloat(price); // 确保价格是数字
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
    if (price === undefined || price === null || price === '' || parseFloat(price) === 0) {
        try {
            price = await getCurrentPrice(ticker); // 调用我们自己的带缓存的API
        } catch (error) {
            console.warn(`Failed to fetch price for ${ticker}, requiring manual input:`, error.message);
            return res.status(400).json({
                message: 'Unable to auto-detect price. Please provide the price field manually.',
                error: 'Price detection service unavailable'
            });
        }
    } else {
        price = parseFloat(price);
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
        console.log(`手动刷新 ${ticker} 的缓存 (数据库和价格缓存)。`);
        // 刷新价格缓存
        const url = `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${process.env.TWELVE_DATA_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        let refreshedPrice = 0;
        if (data && typeof data.price === 'string') {
            refreshedPrice = parseFloat(data.price);
        }
        if (!isNaN(refreshedPrice) && refreshedPrice > 0) {
            priceCache[ticker] = { price: refreshedPrice, timestamp: Date.now() }; // 更新内存价格缓存
            console.log(`价格缓存已刷新为: ${refreshedPrice}`);
        } else {
            console.warn(`警告: 无法从 API 获取 ${ticker} 的有效价格进行刷新。`);
        }

        // 刷新 ticker 名称/类型缓存 (数据库)
        const apiData = await fetchTickerInfoFromAPI(ticker); // 这会调用并更新数据库缓存
        await saveCachedTickerInfo(ticker, apiData.name, apiData.type);

        res.status(200).json({
            message: `缓存已成功刷新 ${ticker}`,
            data: {
                name: apiData.name,
                type: apiData.type,
                price: refreshedPrice // 返回刷新的价格
            }
        });
    } catch (error) {
        res.status(500).json({
            message: '刷新缓存失败',
            error: error.message
        });
    }
});

// Endpoint to get cache status (from database)
app.get('/api/cache/status', (req, res) => {
    db.all('SELECT ticker, name, type, updated_at FROM portfolio_name ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
        } else {
            // 同时返回内存价格缓存的状态
            const livePriceCacheStatus = Object.keys(priceCache).map(ticker => ({
                ticker: ticker,
                price: priceCache[ticker].price,
                timestamp: new Date(priceCache[ticker].timestamp).toISOString(),
                is_expired: (Date.now() - priceCache[ticker].timestamp) > CACHE_DURATION
            }));

            res.json({
                message: '缓存状态已成功检索',
                database_cached_tickers: rows.length,
                database_data: rows,
                live_price_cache_status: livePriceCacheStatus
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