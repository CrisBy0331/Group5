// Node.js Express 后端，提供持仓详情API和静态文件服务

import express from 'express';
import path from 'path';
import sqlite3 from 'sqlite3';
import fetch from 'node-fetch';
const app = express();
const PORT = 3000;

// 引入数据库（以sqlite为例）
const db = new sqlite3.Database(path.join(process.cwd(), 'group5.db'));

// 静态文件服务
app.use(express.static(path.join(process.cwd(), 'public')));

// API: 获取持仓列表
app.get('/holdings', (req, res) => {
    db.all('SELECT * FROM holdings', (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'db error' });
        } else {
            res.json(rows);
        }
    });
});

// API: 获取单个持仓详情
app.get('/holding/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.get('SELECT * FROM holdings WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: 'db error' });
        } else if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    });
});

// 示例：调取外部API并返回结果
app.get('/external', async (req, res) => {
    try {
        // 这里以获取币价为例
        const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice.json');
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'external api error' });
    }
});

// 启动服务
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

