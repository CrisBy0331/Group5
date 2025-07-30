# 投资组合管理 API 文档

## 概述

此 API 提供了一个全面的投资组合管理系统，包括用户身份验证、持仓管理和实时股票数据集成。基于 Node.js 和 Express.js 构建，使用 SQLite 进行数据持久化，并与 TwelveData API 集成获取股票市场数据。

## 基础 URL
```
http://localhost:3000
```

## 数据库结构

### 用户表
```sql
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 持仓表
```sql
CREATE TABLE holding (
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
```

### 投资组合缓存表
```sql
CREATE TABLE portfolio_name (
    stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('stock', 'bond', 'fund', 'gold', 'currency')) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticker) REFERENCES holding(ticker)
)
```

## 身份验证

API 使用 SHA-256 哈希进行密码存储。未实现会话管理 - 身份验证通过用户 ID 验证在每个请求中处理。

## API 端点

### 用户管理

#### 获取所有用户
```http
GET /api/users
```

**响应：**
```json
[
    {
        "user_id": 1,
        "username": "john_doe",
        "password": "hashed_password",
        "avatar": "avatar.jpg",
        "created_at": "2024-01-01 10:00:00"
    }
]
```

**状态码：**
- `200 OK` - 成功
- `500 Internal Server Error` - 数据库错误

#### 根据 ID 获取用户
```http
GET /api/users/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**响应：**
```json
{
    "user_id": 1,
    "username": "john_doe",
    "password": "hashed_password",
    "avatar": "avatar.jpg",
    "created_at": "2024-01-01 10:00:00"
}
```

**状态码：**
- `200 OK` - 成功
- `404 Not Found` - 用户未找到
- `500 Internal Server Error` - 数据库错误

#### 创建新用户
```http
POST /api/users/
```

**请求体：**
```json
{
    "username": "new_user",
    "password": "user_password",
    "avatar": "optional_avatar.jpg"
}
```

**响应：**
```json
{
    "message": "User created successfully",
    "user_id": 1,
    "username": "new_user"
}
```

**状态码：**
- `201 Created` - 用户创建成功
- `400 Bad Request` - 缺少用户名或密码
- `409 Conflict` - 用户名已存在
- `500 Internal Server Error` - 数据库错误

#### 验证密码
```http
POST /api/users/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**请求体：**
```json
{
    "password": "user_password"
}
```

**响应（成功）：**
```json
{
    "message": "Password is correct",
    "user_id": 1,
    "username": "john_doe"
}
```

**响应（失败）：**
```json
{
    "message": "Password is incorrect"
}
```

**状态码：**
- `200 OK` - 密码正确
- `400 Bad Request` - 密码必填
- `401 Unauthorized` - 密码错误
- `404 Not Found` - 用户未找到
- `500 Internal Server Error` - 数据库错误

#### 更新用户
```http
PUT /api/users/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**请求体：**
```json
{
    "username": "updated_username",
    "password": "new_password",
    "avatar": "new_avatar.jpg"
}
```

**响应：**
```json
{
    "message": "User updated successfully"
}
```

**状态码：**
- `200 OK` - 用户更新成功
- `400 Bad Request` - 缺少用户名或密码
- `404 Not Found` - 用户未找到
- `500 Internal Server Error` - 数据库错误

#### 删除用户
```http
DELETE /api/users/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**响应：**
```json
{
    "message": "User deleted successfully"
}
```

**状态码：**
- `200 OK` - 用户删除成功或未找到
- `500 Internal Server Error` - 数据库错误

### 持仓管理

#### 获取用户持仓
```http
GET /api/holdings/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**响应：**
```json
[
    {
        "record_id": 1,
        "user_id": 1,
        "type": "stock",
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "buyin_price": 150.25,
        "quantity": 10,
        "created_at": "2024-01-01 10:00:00",
        "updated_at": "2024-01-01 10:00:00"
    }
]
```

**状态码：**
- `200 OK` - 成功
- `500 Internal Server Error` - 数据库错误

#### 添加持仓（手动）
```http
POST /api/holdings/{user_id}
```

**参数：**
- `user_id` (路径) - 用户 ID

**请求体：**
```json
{
    "type": "stock",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "buyin_price": 150.25,
    "quantity": 10
}
```

**响应：**
```json
{
    "message": "Holding added successfully",
    "record_id": 1
}
```

**状态码：**
- `201 Created` - 持仓添加成功
- `400 Bad Request` - 缺少必填字段
- `500 Internal Server Error` - 数据库错误

#### 更新持仓
```http
PUT /api/holdings/{user_id}/{record_id}
```

**参数：**
- `user_id` (路径) - 用户 ID
- `record_id` (路径) - 记录 ID

**请求体：**
```json
{
    "type": "stock",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "buyin_price": 155.50,
    "quantity": 15
}
```

**响应：**
```json
{
    "message": "Holding updated successfully"
}
```

**状态码：**
- `200 OK` - 持仓更新成功
- `400 Bad Request` - 缺少必填字段
- `404 Not Found` - 持仓未找到
- `500 Internal Server Error` - 数据库错误

#### 删除持仓
```http
DELETE /api/holdings/{user_id}/{record_id}
```

**参数：**
- `user_id` (路径) - 用户 ID
- `record_id` (路径) - 记录 ID

**响应：**
```json
{
    "message": "Holding deleted successfully"
}
```

**状态码：**
- `200 OK` - 持仓删除成功或未找到
- `500 Internal Server Error` - 数据库错误

#### 买入持仓（智能）
```http
POST /api/holdings/{user_id}/buy
```

**参数：**
- `user_id` (路径) - 用户 ID

**请求体：**
```json
{
    "ticker": "AAPL",
    "quantity": 10,
    "price": 150.25,
    "type": "stock",
    "name": "Apple Inc."
}
```

**注意：** 
- 对于股票/债券/基金，`price`、`type` 和 `name` 是可选的（通过 API 自动检测）
- 对于 `gold` 和 `currency` 类型，`price` 是必填的
- 如果持仓存在，数量会增加并重新计算平均价格
- 如果是新持仓，会创建新记录

**响应（新持仓）：**
```json
{
    "message": "New holding created successfully",
    "record_id": 1,
    "quantity": 10,
    "price": 150.25,
    "used_price": 150.25,
    "detected_type": "stock"
}
```

**响应（更新持仓）：**
```json
{
    "message": "Holdings updated successfully",
    "record_id": 1,
    "new_quantity": 20,
    "new_avg_price": 148.75,
    "used_price": 150.25,
    "detected_type": "stock"
}
```

**状态码：**
- `200 OK` - 现有持仓已更新
- `201 Created` - 新持仓已创建
- `400 Bad Request` - 无效输入或 API 检测失败
- `500 Internal Server Error` - 数据库错误

#### 卖出持仓（智能）
```http
POST /api/holdings/{user_id}/sell
```

**参数：**
- `user_id` (路径) - 用户 ID

**请求体：**
```json
{
    "ticker": "AAPL",
    "quantity": 5,
    "price": 155.75
}
```

**注意：** 
- `price` 是可选的（如果未提供会通过 API 自动检测）
- 减少数量或在数量变为零时移除持仓

**响应（部分卖出）：**
```json
{
    "message": "Holdings sold successfully",
    "record_id": 1,
    "sold_quantity": 5,
    "remaining_quantity": 5,
    "sell_price": 155.75,
    "sell_value": 778.75
}
```

**响应（完全卖出）：**
```json
{
    "message": "Holding sold completely and removed",
    "sold_quantity": 10,
    "remaining_quantity": 0,
    "sell_price": 155.75,
    "sell_value": 1557.50
}
```

**状态码：**
- `200 OK` - 卖出成功完成
- `400 Bad Request` - 无效数量或持仓不足
- `404 Not Found` - 持仓未找到
- `500 Internal Server Error` - 数据库错误

### 股票数据

#### 获取股票价格
```http
GET /api/stock/price/{ticker}
```

**参数：**
- `ticker` (路径) - 股票代码

**响应：**
```json
{
    "price": "150.25"
}
```

**状态码：**
- `200 OK` - 成功
- `500 Internal Server Error` - API 错误

#### 获取股票报价
```http
GET /api/stock/quote/{ticker}
```

**参数：**
- `ticker` (路径) - 股票代码

**响应：**
```json
{
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "exchange": "NASDAQ",
    "currency": "USD",
    "datetime": "2024-01-01",
    "timestamp": 1704067200,
    "open": "149.50",
    "high": "151.00",
    "low": "148.75",
    "close": "150.25",
    "volume": "50000000"
}
```

**状态码：**
- `200 OK` - 成功
- `500 Internal Server Error` - API 错误

### 缓存管理

#### 刷新股票代码缓存
```http
POST /api/cache/refresh/{ticker}
```

**参数：**
- `ticker` (路径) - 股票代码

**响应：**
```json
{
    "message": "Cache refreshed successfully for AAPL",
    "data": {
        "name": "Apple Inc.",
        "type": "stock"
    }
}
```

**状态码：**
- `200 OK` - 缓存刷新成功
- `500 Internal Server Error` - API 错误

#### 获取缓存状态
```http
GET /api/cache/status
```

**响应：**
```json
{
    "message": "Cache status retrieved successfully",
    "cached_tickers": 2,
    "data": [
        {
            "ticker": "AAPL",
            "name": "Apple Inc.",
            "type": "stock",
            "updated_at": "2024-01-01 10:00:00"
        }
    ]
}
```

**状态码：**
- `200 OK` - 成功
- `500 Internal Server Error` - 数据库错误

## 错误处理

所有端点都以以下格式返回 JSON 错误响应：

```json
{
    "message": "错误描述",
    "error": "详细错误信息（适用时）"
}
```

## 外部依赖

- **TwelveData API**：用于实时股票数据
- **环境变量**： 
  - `TWELVE_DATA_API_KEY` - 股票数据端点所需

## 注意事项

1. **自动检测**：买入端点智能检测股票名称和类型，使用缓存数据和外部 API
2. **缓存**：股票代码信息被缓存以减少 API 调用并提高性能
3. **平均价格计算**：买入现有持仓时，系统计算新的平均买入价格
4. **灵活输入**：大多数操作中价格和名称字段是可选的（可能时自动检测）
5. **数据验证**：所有数字输入都验证为正值
6. **大小写规范化**：股票代码自动转换为大写

## 速率限制

未实现速率限制。考虑在生产环境中实现速率限制。

## 安全考虑

- 密码使用 SHA-256 哈希
- 考虑在生产环境中实现适当的身份验证