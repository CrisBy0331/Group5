import sqlite3pkg from 'sqlite3'; // import the sqlite3 package
const sqlite3 = sqlite3pkg.verbose(); // get the verbose class from the package
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url'; // For __dirname equivalent

// __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 连接数据库
// 假设 database.db 在 GROUP5/backend/ 目录下，而 detail_s.js 在 GROUP5/ 目录下
const db = new sqlite3.Database(path.join(__dirname, 'backend', 'database.db'), (err) => {
    if (err) {
        console.error('无法连接到 SQLite 数据库:', err.message);
    } else {
        console.log('成功连接到 SQLite 数据库。');
        // 创建表（确保用户和持仓表存在，即使您已经创建过）
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
    }
});

app.use(express.json()); // 用于解析 JSON 格式的请求体

// 添加静态文件服务
// 这将把 GROUP5/public/ 目录下的所有文件作为静态资源提供
app.use(express.static(path.join(__dirname, 'public')));

// 根路径路由指向 detail.html
// 注意：如果 GROUP5/public/ 目录下仍然有 index.html，express.static 会优先服务 index.html。
// 请务必删除或重命名 public/index.html 文件，以确保此路由生效。
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'detail.html'));
});

// 以下是您提供的用户和持仓 API 路由，其中 /api/holdings/:user_id 已修改以匹配前端期望
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

// /api/holdings/:user_id 接口的数据转换
app.get('/api/holdings/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    db.all('SELECT * FROM holding WHERE user_id = ?', [user_id], (err, rows) => {
        if (err) {
            res.status(500).json({ message: 'Database error', error: err.message });
            return;
        }

        // 将数据库查询结果转换为前端 detail.js 期望的格式
        const formattedHoldings = rows.map(row => {
            const currentPrice = row.buyin_price * (1 + (Math.random() * 0.2 - 0.1)); 
            const profit = ((currentPrice - row.buyin_price) / row.buyin_price * 100).toFixed(2);
            const amount = (row.quantity * currentPrice).toFixed(2); 
            const dummyChartData = Array.from({ length: 6 }, (_, i) => 
                (currentPrice * (1 + (Math.random() * 0.1 - 0.05))).toFixed(2)
            );
            const typeEn = row.type.charAt(0).toUpperCase() + row.type.slice(1);

            return {
                id: row.record_id,
                name: { zh: row.name, en: row.name },
                code: row.ticker,
                type: { zh: row.type === 'stock' ? '股票' : (row.type === 'bond' ? '债券' : (row.type === 'fund' ? '基金' : (row.type === 'gold' ? '黄金' : '现金'))), en: typeEn },
                logo: `logos/${row.type}.png`, 
                amount: parseFloat(amount),
                quantity: row.quantity,
                buyPrice: row.buyin_price,
                currentPrice: parseFloat(currentPrice.toFixed(2)),
                profit: parseFloat(profit),
                time: row.updated_at ? row.updated_at.split(' ')[0] : 'N/A',
                chart: {
                    labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
                    data: dummyChartData.map(Number)
                }
            };
        });
        res.status(200).json(formattedHoldings);
    });
});

app.post('/api/holdings/:user_id', (req, res) => {
    const user_id = req.params.user_id;
    const { type, ticker, name, buyin_price, quantity } = req.body;
    
    if (!type || !ticker || !name || !buyin_price || !quantity) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    db.run('INSERT INTO holding (user_id, type, ticker, name, buyin_price, quantity) VALUES (?, ?, ?, ?, ?, ?)', 
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
            res.status(200).json({ message: 'Holding not found or already deleted' });
        } else {
            res.status(200).json({ message: 'Holding deleted successfully' });
        }
    });
});

// Directly start the server since type="module" implies this is the main entry
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});