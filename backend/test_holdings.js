const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock sqlite3 before importing backend
jest.mock('sqlite3', () => {
    // Store mock data state - Reset for each test suite
    const resetMockData = () => {
        return [
            { 
                record_id: 1, 
                user_id: 1, 
                type: 'stock', 
                ticker: 'AAPL', 
                name: 'Apple Inc.', 
                buyin_price: 150.00, 
                quantity: 10,
                created_at: '2024-01-01 10:00:00',
                updated_at: '2024-01-01 10:00:00'
            },
            { 
                record_id: 2, 
                user_id: 1, 
                type: 'bond', 
                ticker: 'BOND001', 
                name: 'Treasury Bond', 
                buyin_price: 1000.00, 
                quantity: 5,
                created_at: '2024-01-01 11:00:00',
                updated_at: '2024-01-01 11:00:00'
            }
        ];
    };

    let mockHoldings = resetMockData();
    
    // Export reset function globally
    global.resetMockHoldings = () => {
        mockHoldings = resetMockData();
    };

    const mockDatabase = jest.fn().mockImplementation(() => ({
        serialize: jest.fn().mockImplementation((callback) => {
            callback();
        }),
        run: jest.fn().mockImplementation((query, params, callback) => {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            
            if (query.includes('INSERT INTO holding')) {
                // Add new holding to mock data
                const newHolding = {
                    record_id: Math.max(...mockHoldings.map(h => h.record_id), 0) + 1,
                    user_id: parseInt(params[0]),
                    type: params[1],
                    ticker: params[2],
                    name: params[3],
                    buyin_price: parseFloat(params[4]),
                    quantity: parseFloat(params[5]),
                    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                };
                mockHoldings.push(newHolding);
                
                if (callback) {
                    const result = { lastID: newHolding.record_id, changes: 1 };
                    callback.call(result, null);
                }
            } else if (query.includes('UPDATE holding SET type =')) {
                // Standard update from PUT endpoint
                const record_id = parseInt(params[6]);
                const user_id = parseInt(params[5]);
                const holdingIndex = mockHoldings.findIndex(h => h.record_id === record_id && h.user_id === user_id);
                
                if (holdingIndex !== -1) {
                    // Update the holding but preserve created_at
                    const originalCreatedAt = mockHoldings[holdingIndex].created_at;
                    mockHoldings[holdingIndex] = {
                        ...mockHoldings[holdingIndex],
                        type: params[0],
                        ticker: params[1],
                        name: params[2],
                        buyin_price: parseFloat(params[3]),
                        quantity: parseFloat(params[4]),
                        created_at: originalCreatedAt, // Preserve original created_at
                        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    };
                    
                    if (callback) {
                        const result = { changes: 1 };
                        callback.call(result, null);
                    }
                } else {
                    if (callback) {
                        const result = { changes: 0 };
                        callback.call(result, null);
                    }
                }
            } else if (query.includes('UPDATE holding SET quantity =')) {
                // Buy/Sell endpoint updates (quantity and buyin_price changes)
                let user_id, record_id, quantity, buyin_price;
                
                if (query.includes('buyin_price')) {
                    // Buy operation: UPDATE holding SET quantity = ?, buyin_price = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND record_id = ?
                    quantity = parseFloat(params[0]);
                    buyin_price = parseFloat(params[1]);
                    user_id = parseInt(params[2]);
                    record_id = parseInt(params[3]);
                } else {
                    // Sell operation: UPDATE holding SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND record_id = ?
                    quantity = parseFloat(params[0]);
                    user_id = parseInt(params[1]);
                    record_id = parseInt(params[2]);
                    buyin_price = null; // Don't change price for sell operations
                }
                
                const holdingIndex = mockHoldings.findIndex(h => h.record_id === record_id && h.user_id === user_id);
                
                if (holdingIndex !== -1) {
                    const originalCreatedAt = mockHoldings[holdingIndex].created_at;
                    const updatedHolding = {
                        ...mockHoldings[holdingIndex],
                        quantity: quantity,
                        created_at: originalCreatedAt,
                        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    };
                    
                    // Only update price if it's a buy operation
                    if (buyin_price !== null) {
                        updatedHolding.buyin_price = buyin_price;
                    }
                    
                    mockHoldings[holdingIndex] = updatedHolding;
                    
                    if (callback) {
                        const result = { changes: 1 };
                        callback.call(result, null);
                    }
                } else {
                    if (callback) {
                        const result = { changes: 0 };
                        callback.call(result, null);
                    }
                }
            } else if (query.includes('DELETE FROM holding')) {
                // Remove holding from mock data
                let record_id, user_id;
                if (params.length === 2) {
                    // DELETE FROM holding WHERE user_id = ? AND record_id = ?
                    user_id = parseInt(params[0]);
                    record_id = parseInt(params[1]);
                } else {
                    // Handle other delete patterns
                    user_id = parseInt(params[0]);
                    record_id = parseInt(params[1]);
                }
                
                const holdingIndex = mockHoldings.findIndex(h => h.record_id === record_id && h.user_id === user_id);
                
                if (holdingIndex !== -1) {
                    mockHoldings.splice(holdingIndex, 1);
                    if (callback) {
                        const result = { changes: 1 };
                        callback.call(result, null);
                    }
                } else {
                    if (callback) {
                        const result = { changes: 0 };
                        callback.call(result, null);
                    }
                }
            } else if (query.includes('CREATE TABLE')) {
                if (callback) callback(null);
            } else {
                if (callback) {
                    const result = { changes: 0 };
                    callback.call(result, null);
                }
            }
        }),
        get: jest.fn().mockImplementation((query, params, callback) => {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            
            if (query.includes('WHERE user_id = ? AND ticker = ?')) {
                // For buy/sell operations - find holding by user_id and ticker
                const user_id = parseInt(params[0]);
                const ticker = params[1];
                const holding = mockHoldings.find(h => h.user_id === user_id && h.ticker === ticker);
                if (callback) callback(null, holding || null);
            } else if (query.includes('WHERE user_id = ?')) {
                const user_id = params[0];
                if (user_id === '999') {
                    if (callback) callback(null, null);
                } else {
                    if (callback) callback(null, { user_id: parseInt(user_id), username: 'testuser', password: 'hash', avatar: 'test-avatar.jpg' });
                }
            } else {
                if (callback) callback(null, null);
            }
        }),
        all: jest.fn().mockImplementation((query, params, callback) => {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            
            if (query.includes('holding')) {
                const user_id = parseInt(params[0]);
                if (user_id === 999) {
                    if (callback) callback(null, []);
                } else {
                    const userHoldings = mockHoldings.filter(h => h.user_id === user_id);
                    if (callback) callback(null, userHoldings);
                }
            } else if (query.includes('users')) {
                if (callback) callback(null, [
                    { user_id: 1, username: 'user1', password: 'hash1', avatar: 'user1-avatar.jpg' },
                    { user_id: 2, username: 'user2', password: 'hash2', avatar: 'user2-avatar.jpg' }
                ]);
            } else {
                if (callback) callback(null, []);
            }
        }),
        close: jest.fn().mockImplementation((callback) => {
            if (callback) callback(null);
        })
    }));

    return {
        verbose: () => ({
            Database: mockDatabase
        })
    };
});

// Import the backend after mocking
const backendApp = require('./backend');

describe('Holdings API Tests', () => {

    // Reset mock data before each test
    beforeEach(() => {
        // Manually reset the mock holdings data
        jest.clearAllMocks();
        if (global.resetMockHoldings) {
            global.resetMockHoldings();
        }
    });
    
    describe('GET /api/holdings/:user_id', () => {
        test('should return all holdings for a user', async () => {
            const response = await request(backendApp)
                .get('/api/holdings/1')
                .expect(200);
            
            expect(response.body).toHaveLength(2);
            expect(response.body[0].type).toBe('stock');
            expect(response.body[0].ticker).toBe('AAPL');
            expect(response.body[0].name).toBe('Apple Inc.');
            expect(response.body[1].type).toBe('bond');
            expect(response.body[1].ticker).toBe('BOND001');
        });

        test('should return empty array for user with no holdings', async () => {
            const response = await request(backendApp)
                .get('/api/holdings/999')
                .expect(200);
            
            expect(response.body).toHaveLength(0);
        });
    });

    describe('POST /api/holdings/:user_id', () => {
        test('should create a new holding', async () => {
            const holdingData = {
                type: 'fund',
                ticker: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                buyin_price: 250.00,
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(201);
            
            expect(response.body.message).toBe('Holding added successfully');
            expect(response.body.record_id).toBe(3); // 3 because we already have 2 holdings (record_id 1 and 2)
        });

        test('should set created_at when creating new holding', async () => {
            const holdingData = {
                type: 'fund',
                ticker: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                buyin_price: 250.00,
                quantity: 20
            };

            await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(201);
            
            // Get the created holding and verify it has created_at
            const response = await request(backendApp)
                .get('/api/holdings/1')
                .expect(200);
            
            const newHolding = response.body.find(h => h.ticker === 'VTI');
            expect(newHolding).toBeDefined();
            expect(newHolding.created_at).toBeDefined();
            expect(newHolding.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // Timestamp format
        });

        test('should handle missing type', async () => {
            const holdingData = {
                ticker: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                buyin_price: 250.00,
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing ticker', async () => {
            const holdingData = {
                type: 'fund',
                name: 'Vanguard Total Stock Market ETF',
                buyin_price: 250.00,
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing name', async () => {
            const holdingData = {
                type: 'fund',
                ticker: 'VTI',
                buyin_price: 250.00,
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing buyin_price', async () => {
            const holdingData = {
                type: 'fund',
                ticker: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing quantity', async () => {
            const holdingData = {
                type: 'fund',
                ticker: 'VTI',
                name: 'Vanguard Total Stock Market ETF',
                buyin_price: 250.00
            };

            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send(holdingData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });
    });

    describe('PUT /api/holdings/:user_id/:record_id', () => {
        test('should update existing holding', async () => {
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(200);
            
            expect(response.body.message).toBe('Holding updated successfully');
        });

        test('should return 404 for non-existent holding', async () => {
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/999')
                .send(updateData)
                .expect(404);
            
            expect(response.body.message).toBe('Holding not found');
        });

        test('should handle missing type', async () => {
            const updateData = {
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing ticker', async () => {
            const updateData = {
                type: 'stock',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing name', async () => {
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                buyin_price: 2800.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing buyin_price', async () => {
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                quantity: 5
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle missing quantity', async () => {
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00
            };

            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should preserve created_at when updating holding', async () => {
            // First, get the original holding to check its created_at
            const originalResponse = await request(backendApp)
                .get('/api/holdings/1')
                .expect(200);
            
            const originalHolding = originalResponse.body.find(h => h.record_id === 1);
            const originalCreatedAt = originalHolding.created_at;
            
            // Update the holding
            const updateData = {
                type: 'stock',
                ticker: 'GOOGL',
                name: 'Alphabet Inc.',
                buyin_price: 2800.00,
                quantity: 5
            };

            await request(backendApp)
                .put('/api/holdings/1/1')
                .send(updateData)
                .expect(200);
            
            // Get the updated holding and verify created_at is unchanged
            const updatedResponse = await request(backendApp)
                .get('/api/holdings/1')
                .expect(200);
            
            const updatedHolding = updatedResponse.body.find(h => h.record_id === 1);
            expect(updatedHolding.created_at).toBe(originalCreatedAt);
            expect(updatedHolding.ticker).toBe('GOOGL'); // Verify other fields were updated
        });
    });

    describe('DELETE /api/holdings/:user_id/:record_id', () => {
        test('should delete existing holding', async () => {
            const response = await request(backendApp)
                .delete('/api/holdings/1/1')
                .expect(200);
            
            expect(response.body.message).toBe('Holding deleted successfully');
        });

        test('should handle deleting non-existent holding', async () => {
            const response = await request(backendApp)
                .delete('/api/holdings/1/999')
                .expect(200);
            
            expect(response.body.message).toBe('Holding not found or already deleted');
        });
    });

    describe('Data Validation', () => {
        test('should handle empty request body for POST', async () => {
            const response = await request(backendApp)
                .post('/api/holdings/1')
                .send({})
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle empty request body for PUT', async () => {
            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .send({})
                .expect(400);
            
            expect(response.body.message).toBe('All fields are required');
        });

        test('should handle malformed JSON for POST', async () => {
            const response = await request(backendApp)
                .post('/api/holdings/1')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });

        test('should handle malformed JSON for PUT', async () => {
            const response = await request(backendApp)
                .put('/api/holdings/1/1')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });

    describe('Type Validation', () => {
        test('should accept valid holding types', async () => {
            const validTypes = ['stock', 'bond', 'fund', 'gold', 'currency'];
            
            for (const type of validTypes) {
                const holdingData = {
                    type: type,
                    ticker: 'TEST',
                    name: 'Test Holding',
                    buyin_price: 100.00,
                    quantity: 1
                };

                const response = await request(backendApp)
                    .post('/api/holdings/1')
                    .send(holdingData)
                    .expect(201);
                
                expect(response.body.message).toBe('Holding added successfully');
            }
        });
    });

    describe('POST /api/holdings/:user_id/buy', () => {
        test('should create new holding when buying new asset', async () => {
            const buyData = {
                ticker: 'TSLA',
                type: 'stock',
                name: 'Tesla Inc.',
                price: 250.00,
                quantity: 20
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.quantity).toBe(20);
            expect(response.body.price).toBe(250.00);
        });

        test('should update existing holding when buying more of same asset', async () => {
            // First, verify AAPL exists
            const currentHoldings = await request(backendApp)
                .get('/api/holdings/1')
                .expect(200);
            
            const appleHolding = currentHoldings.body.find(h => h.ticker === 'AAPL');
            expect(appleHolding).toBeDefined();
            expect(appleHolding.quantity).toBe(10);
            expect(appleHolding.buyin_price).toBe(150.00);
            
            // Buy more AAPL (which already exists with 10 shares at $150)
            const buyData = {
                ticker: 'AAPL',
                type: 'stock',
                name: 'Apple Inc.',
                price: 200.00,
                quantity: 10
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(200);
            
            expect(response.body.message).toBe('Holdings updated successfully');
            expect(response.body.new_quantity).toBe(20); // 10 + 10
            expect(response.body.new_avg_price).toBe(175.00); // (10*150 + 10*200) / 20
        });

        test('should require all fields', async () => {
            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send({
                    ticker: 'MSFT',
                    // missing other required fields
                })
                .expect(400);
            
            expect(response.body.message).toBe('All fields (ticker, type, name, price, quantity) are required');
        });

        test('should reject negative quantity', async () => {
            const buyData = {
                ticker: 'MSFT',
                type: 'stock',
                name: 'Microsoft Corp.',
                price: 300.00,
                quantity: -5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Quantity must be positive');
        });

        test('should reject zero quantity', async () => {
            const buyData = {
                ticker: 'MSFT',
                type: 'stock',
                name: 'Microsoft Corp.',
                price: 300.00,
                quantity: 0
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Quantity must be positive');
        });

        test('should reject negative price', async () => {
            const buyData = {
                ticker: 'MSFT',
                type: 'stock',
                name: 'Microsoft Corp.',
                price: -300.00,
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price must be positive');
        });

        test('should reject zero price', async () => {
            const buyData = {
                ticker: 'MSFT',
                type: 'stock',
                name: 'Microsoft Corp.',
                price: 0,
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price must be positive');
        });

        test('should calculate weighted average correctly', async () => {
            // First buy: 5 shares at $100 = $500
            const firstBuy = {
                ticker: 'NFLX',
                type: 'stock',
                name: 'Netflix Inc.',
                price: 100.00,
                quantity: 5
            };

            await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(firstBuy)
                .expect(201);

            // Second buy: 10 shares at $150 = $1500
            // Total: 15 shares for $2000 = $133.33 average
            const secondBuy = {
                ticker: 'NFLX',
                type: 'stock',
                name: 'Netflix Inc.',
                price: 150.00,
                quantity: 10
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(secondBuy)
                .expect(200);
            
            expect(response.body.new_quantity).toBe(15);
            expect(Math.round(response.body.new_avg_price * 100) / 100).toBe(133.33);
        });
    });

    describe('POST /api/holdings/:user_id/sell', () => {
        test('should partially sell holding', async () => {
            // Sell 5 out of 10 AAPL shares
            const sellData = {
                ticker: 'AAPL',
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.message).toBe('Holdings sold successfully');
            expect(response.body.sold_quantity).toBe(5);
            expect(response.body.remaining_quantity).toBe(5);
        });

        test('should completely sell holding when selling all shares', async () => {
            // Sell all 5 BOND001 shares
            const sellData = {
                ticker: 'BOND001',
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.message).toBe('Holding sold completely and removed');
            expect(response.body.sold_quantity).toBe(5);
            expect(response.body.remaining_quantity).toBe(0);
        });

        test('should reject selling more than available', async () => {
            const sellData = {
                ticker: 'AAPL',
                quantity: 50 // More than the 10 available
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Insufficient quantity to sell');
        });

        test('should return 404 for non-existent holding', async () => {
            const sellData = {
                ticker: 'NONEXISTENT',
                quantity: 1
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(404);
            
            expect(response.body.message).toBe('Holding not found');
        });

        test('should require ticker and quantity', async () => {
            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send({
                    // missing ticker and quantity
                })
                .expect(400);
            
            expect(response.body.message).toBe('Ticker and quantity are required');
        });

        test('should reject negative quantity', async () => {
            const sellData = {
                ticker: 'AAPL',
                quantity: -5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Quantity must be positive');
        });

        test('should reject zero quantity', async () => {
            const sellData = {
                ticker: 'AAPL',
                quantity: 0
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Quantity must be positive');
        });
    });

    describe('Buy/Sell Integration Tests', () => {
        test('should handle complete buy-sell cycle', async () => {
            // Buy a new asset
            const buyData = {
                ticker: 'AMZN',
                type: 'stock',
                name: 'Amazon.com Inc.',
                price: 120.00,
                quantity: 15
            };

            const buyResponse = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(buyResponse.body.message).toBe('New holding created successfully');

            // Sell part of it
            const sellData = {
                ticker: 'AMZN',
                quantity: 8
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(7);

            // Sell the rest
            const sellAllData = {
                ticker: 'AMZN',
                quantity: 7
            };

            const sellAllResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellAllData)
                .expect(200);
            
            expect(sellAllResponse.body.message).toBe('Holding sold completely and removed');
        });

        test('should handle multiple buys then partial sell', async () => {
            // First buy: 10 shares at $100
            const firstBuy = {
                ticker: 'GOOGL',
                type: 'stock',
                name: 'Alphabet Inc.',
                price: 100.00,
                quantity: 10
            };

            await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(firstBuy)
                .expect(201);

            // Second buy: 5 shares at $200 (should average to $133.33)
            const secondBuy = {
                ticker: 'GOOGL',
                type: 'stock',
                name: 'Alphabet Inc.',
                price: 200.00,
                quantity: 5
            };

            const buyResponse = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(secondBuy)
                .expect(200);
            
            expect(buyResponse.body.new_quantity).toBe(15);

            // Sell 7 shares
            const sellData = {
                ticker: 'GOOGL',
                quantity: 7
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(8);
        });
    });
});

// Simple test runner for manual execution
if (require.main === module) {
    console.log('Running Holdings API Tests...');
    console.log('To run tests, use: npm test or jest backend/test_holdings.js');
}