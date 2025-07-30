# Portfolio Management API Documentation

## Overview

This API provides a comprehensive portfolio management system with user authentication, holdings management, and real-time stock data integration. Built with Node.js and Express.js, it uses SQLite for data persistence and integrates with TwelveData API for stock market data.

## Base URL
```
http://localhost:3000
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Holdings Table
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

### Portfolio Cache Table
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

## Authentication

The API uses SHA-256 hashing for password storage. No session management is implemented - authentication is handled per request via user ID verification.

## API Endpoints

### User Management

#### Get All Users
```http
GET /api/users
```

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

#### Get User by ID
```http
GET /api/users/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Response:**
```json
{
    "user_id": 1,
    "username": "john_doe",
    "password": "hashed_password",
    "avatar": "avatar.jpg",
    "created_at": "2024-01-01 10:00:00"
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - User not found
- `500 Internal Server Error` - Database error

#### Create New User
```http
POST /api/users/
```

**Request Body:**
```json
{
    "username": "new_user",
    "password": "user_password",
    "avatar": "optional_avatar.jpg"
}
```

**Response:**
```json
{
    "message": "User created successfully",
    "user_id": 1,
    "username": "new_user"
}
```

**Status Codes:**
- `201 Created` - User created successfully
- `400 Bad Request` - Missing username or password
- `409 Conflict` - Username already exists
- `500 Internal Server Error` - Database error

#### Verify Password
```http
POST /api/users/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Request Body:**
```json
{
    "password": "user_password"
}
```

**Response (Success):**
```json
{
    "message": "Password is correct",
    "user_id": 1,
    "username": "john_doe"
}
```

**Response (Failure):**
```json
{
    "message": "Password is incorrect"
}
```

**Status Codes:**
- `200 OK` - Password correct
- `400 Bad Request` - Password required
- `401 Unauthorized` - Password incorrect
- `404 Not Found` - User not found
- `500 Internal Server Error` - Database error

#### Update User
```http
PUT /api/users/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Request Body:**
```json
{
    "username": "updated_username",
    "password": "new_password",
    "avatar": "new_avatar.jpg"
}
```

**Response:**
```json
{
    "message": "User updated successfully"
}
```

**Status Codes:**
- `200 OK` - User updated successfully
- `400 Bad Request` - Missing username or password
- `404 Not Found` - User not found
- `500 Internal Server Error` - Database error

#### Delete User
```http
DELETE /api/users/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Response:**
```json
{
    "message": "User deleted successfully"
}
```

**Status Codes:**
- `200 OK` - User deleted or not found
- `500 Internal Server Error` - Database error

### Holdings Management

#### Get User Holdings
```http
GET /api/holdings/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

#### Add Holdings (Manual)
```http
POST /api/holdings/{user_id}
```

**Parameters:**
- `user_id` (path) - User ID

**Request Body:**
```json
{
    "type": "stock",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "buyin_price": 150.25,
    "quantity": 10
}
```

**Response:**
```json
{
    "message": "Holding added successfully",
    "record_id": 1
}
```

**Status Codes:**
- `201 Created` - Holding added successfully
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Database error

#### Update Holdings
```http
PUT /api/holdings/{user_id}/{record_id}
```

**Parameters:**
- `user_id` (path) - User ID
- `record_id` (path) - Record ID

**Request Body:**
```json
{
    "type": "stock",
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "buyin_price": 155.50,
    "quantity": 15
}
```

**Response:**
```json
{
    "message": "Holding updated successfully"
}
```

**Status Codes:**
- `200 OK` - Holding updated successfully
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Holding not found
- `500 Internal Server Error` - Database error

#### Delete Holdings
```http
DELETE /api/holdings/{user_id}/{record_id}
```

**Parameters:**
- `user_id` (path) - User ID
- `record_id` (path) - Record ID

**Response:**
```json
{
    "message": "Holding deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Holding deleted or not found
- `500 Internal Server Error` - Database error

#### Buy Holdings (Smart)
```http
POST /api/holdings/{user_id}/buy
```

**Parameters:**
- `user_id` (path) - User ID

**Request Body:**
```json
{
    "ticker": "AAPL",
    "quantity": 10,
    "price": 150.25,
    "type": "stock",
    "name": "Apple Inc."
}
```

**Note:** 
- `price`, `type`, and `name` are optional for stocks/bonds/funds (auto-detected via API)
- `price` is required for `gold` and `currency` types
- If holding exists, quantity is added and average price recalculated
- If new holding, creates new record

**Response (New Holding):**
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

**Response (Updated Holding):**
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

**Status Codes:**
- `200 OK` - Existing holding updated
- `201 Created` - New holding created
- `400 Bad Request` - Invalid input or API detection failed
- `500 Internal Server Error` - Database error

#### Sell Holdings (Smart)
```http
POST /api/holdings/{user_id}/sell
```

**Parameters:**
- `user_id` (path) - User ID

**Request Body:**
```json
{
    "ticker": "AAPL",
    "quantity": 5,
    "price": 155.75
}
```

**Note:** 
- `price` is optional (auto-detected via API if not provided)
- Reduces quantity or removes holding if quantity becomes zero

**Response (Partial Sale):**
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

**Response (Complete Sale):**
```json
{
    "message": "Holding sold completely and removed",
    "sold_quantity": 10,
    "remaining_quantity": 0,
    "sell_price": 155.75,
    "sell_value": 1557.50
}
```

**Status Codes:**
- `200 OK` - Sale completed successfully
- `400 Bad Request` - Invalid quantity or insufficient holdings
- `404 Not Found` - Holding not found
- `500 Internal Server Error` - Database error

### Stock Data

#### Get Stock Price
```http
GET /api/stock/price/{ticker}
```

**Parameters:**
- `ticker` (path) - Stock ticker symbol

**Response:**
```json
{
    "price": "150.25"
}
```

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - API error

#### Get Stock Quote
```http
GET /api/stock/quote/{ticker}
```

**Parameters:**
- `ticker` (path) - Stock ticker symbol

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - API error

### Cache Management

#### Refresh Ticker Cache
```http
POST /api/cache/refresh/{ticker}
```

**Parameters:**
- `ticker` (path) - Stock ticker symbol

**Response:**
```json
{
    "message": "Cache refreshed successfully for AAPL",
    "data": {
        "name": "Apple Inc.",
        "type": "stock"
    }
}
```

**Status Codes:**
- `200 OK` - Cache refreshed successfully
- `500 Internal Server Error` - API error

#### Get Cache Status
```http
GET /api/cache/status
```

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Database error

## Error Handling

All endpoints return JSON error responses in the following format:

```json
{
    "message": "Error description",
    "error": "Detailed error message (when applicable)"
}
```

## External Dependencies

- **TwelveData API**: Used for real-time stock data
- **Environment Variables**: 
  - `TWELVE_DATA_API_KEY` - Required for stock data endpoints

## Notes

1. **Auto-Detection**: The buy endpoint intelligently detects stock names and types using cached data and external APIs
2. **Caching**: Ticker information is cached to reduce API calls and improve performance
3. **Average Price Calculation**: When buying existing holdings, the system calculates a new average buy-in price
4. **Flexible Input**: Price and name fields are optional for most operations (auto-detected when possible)
5. **Data Validation**: All numeric inputs are validated for positive values
6. **Case Normalization**: Ticker symbols are automatically converted to uppercase

## Rate Limiting

No rate limiting is implemented. Consider implementing rate limiting for production use.

## Security Considerations

- Passwords are hashed using SHA-256
- Consider implementing proper authentication for production use