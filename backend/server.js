const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = 3000;

// --- 数据库初始化 ---
// 连接到 SQLite 数据库文件，如果文件不存在则会创建它
/*const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('✅ 成功连接到 database.db 数据库.');
    // 创建 users 表 (如果它不存在)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('创建 users 表失败:', err.message);
      } else {
        console.log('✅ users 表已准备就绪.');
      }
    });
  }
});*/
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    // 如果连接失败，在控制台打印错误信息
    console.error('数据库连接失败:', err.message);
  } else {
    // 连接成功，只打印成功信息
    console.log('✅ 成功连接到 database.db 数据库.');
  }
});

// --- 中间件 ---
app.use(cors());
app.use(express.json());
// 提供静态文件服务，用于访问上传的图片和前端页面
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 页面路由 ---
// 建议将 HTML 文件放在一个名为 'public' 的文件夹中
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'log_in.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// 确保 uploads 目录存在
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// --- Multer 设置 (用于文件上传) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`);
  }
});
const upload = multer({ storage });

// --- 工具函数 ---
const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = phone => /^1[3-9]\d{9}$/.test(phone);

// --- API 路由 ---

// 上传头像 (这个接口目前在注册逻辑中被调用)
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '未上传文件' });
  }
  const url = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ message: '上传成功', url });
});

// 注册
app.post('/api/register', (req, res) => {
  const { account, password, avatar } = req.body;

  if (!account || !password) {
    return res.status(400).json({ message: '账号和密码不能为空' });
  }
  if (password.length < 8) {
      return res.status(400).json({ message: '密码长度不能少于8位' });
  }
  if (!isValidEmail(account) && !isValidPhone(account)) {
    return res.status(400).json({ message: '账号格式不合法，请输入有效的邮箱或手机号' });
  }

  // 使用 bcrypt 对密码进行哈希处理
  const passwordHash = bcrypt.hashSync(password, 10);

  const sql = 'INSERT INTO users (account, passwordHash, avatar) VALUES (?, ?, ?)';
  db.run(sql, [account, passwordHash, avatar || null], function (err) {
    if (err) {
      // 'UNIQUE constraint failed' 表示账号已存在
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ message: '该账号已被注册' });
      }
      return res.status(500).json({ message: '服务器内部错误' });
    }
    res.status(201).json({ message: '注册成功', userId: this.lastID });
  });
});

// 登录
app.post('/api/login', (req, res) => {
  const { account, password } = req.body;
  if (!account || !password) {
    return res.status(400).json({ message: '账号和密码不能为空' });
  }

  const sql = 'SELECT * FROM users WHERE account = ?';
  db.get(sql, [account], (err, user) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!user) {
      // 为了安全，不明确指出是账号还是密码错误
      return res.status(401).json({ message: '账号或密码错误' });
    }

    // 验证密码
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '账号或密码错误' });
    }

    // 登录成功
    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        account: user.account,
        // 如果没有头像，可以提供一个默认头像
        avatar: user.avatar || 'https://via.placeholder.com/32'
      }
    });
  });
});

// --- 启动服务器 ---
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动，正在监听 http://localhost:${PORT}`);
});