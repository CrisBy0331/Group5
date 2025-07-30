const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock fetch globally before importing backend
global.fetch = jest.fn();

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
        Database: mockDatabase
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
        // Reset fetch mock before each test
        beforeEach(() => {
            fetch.mockClear();
            
            // Set up comprehensive mocking for all TwelveData API endpoints
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=')) {
                    // Mock price endpoint
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    // Mock quote endpoint for name and price
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    // Mock symbol search for type detection
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    // Default fallback for any other URLs
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });
        });

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
            expect(response.body.used_price).toBe(250.00);
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
            expect(response.body.used_price).toBe(200.00);
        });

        test('should require ticker, type, name, and quantity only', async () => {
            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send({
                    ticker: 'MSFT',
                    // missing other required fields
                })
                .expect(400);
            
            expect(response.body.message).toBe('Ticker and quantity are required');
        });

        test('should fetch current price when price is empty', async () => {
            // Mock the fetch response for current price - override default for this test
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=MSFT')) {
                    return Promise.resolve({
                        json: async () => ({ price: '300.50' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            const buyData = {
                ticker: 'MSFT',
                type: 'stock',
                name: 'Microsoft Corp.',
                quantity: 5
                // price is omitted - should fetch current price
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.used_price).toBe(300.50);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://api.twelvedata.com/price?symbol=MSFT')
            );
        });

        test('should fetch current price when price is null', async () => {
            // Mock the fetch response for current price
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=NVDA')) {
                    return Promise.resolve({
                        json: async () => ({ price: '150.75' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            const buyData = {
                ticker: 'NVDA',
                type: 'stock',
                name: 'NVIDIA Corp.',
                price: null,
                quantity: 3
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.used_price).toBe(150.75);
            expect(fetch).toHaveBeenCalled();
        });

        test('should fetch current price when price is empty string', async () => {
            // Mock the fetch response for current price
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=AMD')) {
                    return Promise.resolve({
                        json: async () => ({ price: '75.25' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            const buyData = {
                ticker: 'AMD',
                type: 'stock',
                name: 'Advanced Micro Devices Inc.',
                price: '',
                quantity: 8
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.used_price).toBe(75.25);
        });

        test('should fetch current price when price is 0', async () => {
            // Mock the fetch response for current price
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=INTC')) {
                    return Promise.resolve({
                        json: async () => ({ price: '45.80' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            const buyData = {
                ticker: 'INTC',
                type: 'stock',
                name: 'Intel Corp.',
                price: 0,
                quantity: 12
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.used_price).toBe(45.80);
        });

        test('should handle API error when fetching current price', async () => {
            // Override the default mock to simulate API failure
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=FAIL')) {
                    return Promise.reject(new Error('API Error'));
                } else {
                    // Default fallback for other endpoints (should not be called in this test)
                    return Promise.reject(new Error('Unexpected API call'));
                }
            });

            const buyData = {
                ticker: 'FAIL',
                type: 'stock',
                name: 'Failing Stock',
                quantity: 1
                // price omitted - will try to fetch
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Unable to auto-detect price. Please provide the price field manually.');
        });

        test('should handle invalid API response when fetching current price', async () => {
            // Override the default mock to simulate invalid response
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=INVALID')) {
                    return Promise.resolve({
                        json: async () => ({ error: 'Invalid symbol' })
                    });
                } else {
                    // Default fallback for other endpoints
                    return Promise.reject(new Error('Unexpected API call'));
                }
            });

            const buyData = {
                ticker: 'INVALID',
                type: 'stock',
                name: 'Invalid Stock',
                quantity: 1
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Unable to auto-detect price. Please provide the price field manually.');
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

        test('should reject negative price when provided', async () => {
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
            expect(response.body.used_price).toBe(150.00);
        });
    });

    describe('POST /api/holdings/:user_id/sell', () => {
        // Reset fetch mock before each test
        beforeEach(() => {
            fetch.mockClear();
        });

        test('should partially sell holding with specified price', async () => {
            // Sell 5 out of 10 AAPL shares at $160
            const sellData = {
                ticker: 'AAPL',
                quantity: 5,
                price: 160.00
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.message).toBe('Holdings sold successfully');
            expect(response.body.sold_quantity).toBe(5);
            expect(response.body.remaining_quantity).toBe(5);
            expect(response.body.sell_price).toBe(160.00);
            expect(response.body.sell_value).toBe(800.00); // 5 * 160
        });

        test('should partially sell holding without price (fetch current)', async () => {
            // Mock fetch for current price
            fetch.mockResolvedValueOnce({
                json: async () => ({ price: '155.50' })
            });

            // Sell 3 out of 10 AAPL shares at current price
            const sellData = {
                ticker: 'AAPL',
                quantity: 3
                // price omitted - should fetch current price
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.message).toBe('Holdings sold successfully');
            expect(response.body.sold_quantity).toBe(3);
            expect(response.body.remaining_quantity).toBe(7);
            expect(response.body.sell_price).toBe(155.50);
            expect(response.body.sell_value).toBe(466.50); // 3 * 155.50
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://api.twelvedata.com/price?symbol=AAPL')
            );
        });

        test('should completely sell holding when selling all shares', async () => {
            // Sell all 5 BOND001 shares at $1050
            const sellData = {
                ticker: 'BOND001',
                quantity: 5,
                price: 1050.00
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.message).toBe('Holding sold completely and removed');
            expect(response.body.sold_quantity).toBe(5);
            expect(response.body.remaining_quantity).toBe(0);
            expect(response.body.sell_price).toBe(1050.00);
            expect(response.body.sell_value).toBe(5250.00); // 5 * 1050
        });

        test('should fetch current price when price is null', async () => {
            fetch.mockResolvedValueOnce({
                json: async () => ({ price: '148.75' })
            });

            const sellData = {
                ticker: 'AAPL',
                quantity: 2,
                price: null
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.sell_price).toBe(148.75);
            expect(response.body.sell_value).toBe(297.50);
        });

        test('should fetch current price when price is empty string', async () => {
            fetch.mockResolvedValueOnce({
                json: async () => ({ price: '152.25' })
            });

            const sellData = {
                ticker: 'AAPL',
                quantity: 1,
                price: ''
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.sell_price).toBe(152.25);
        });

        test('should fetch current price when price is 0', async () => {
            fetch.mockResolvedValueOnce({
                json: async () => ({ price: '159.90' })
            });

            const sellData = {
                ticker: 'AAPL',
                quantity: 1,
                price: 0
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(response.body.sell_price).toBe(159.90);
        });

        test('should handle API error when fetching current price for sell', async () => {
            fetch.mockRejectedValueOnce(new Error('API Error'));

            const sellData = {
                ticker: 'AAPL',
                quantity: 1
                // price omitted - will try to fetch
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Unable to auto-detect price. Please provide the price field manually.');
        });

        test('should reject selling more than available', async () => {
            const sellData = {
                ticker: 'AAPL',
                quantity: 50, // More than the 10 available
                price: 150.00
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
                quantity: 1,
                price: 100.00
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
                quantity: -5,
                price: 150.00
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
                quantity: 0,
                price: 150.00
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Quantity must be positive');
        });

        test('should reject negative price when provided', async () => {
            const sellData = {
                ticker: 'AAPL',
                quantity: 1,
                price: -150.00
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(400);
            
            expect(response.body.message).toBe('Price must be positive');
        });
    });

    describe('Buy/Sell Integration Tests', () => {
        beforeEach(() => {
            fetch.mockClear();
        });

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
            expect(buyResponse.body.used_price).toBe(120.00);

            // Sell part of it
            const sellData = {
                ticker: 'AMZN',
                quantity: 8,
                price: 125.00
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(7);
            expect(sellResponse.body.sell_price).toBe(125.00);
            expect(sellResponse.body.sell_value).toBe(1000.00); // 8 * 125

            // Sell the rest
            const sellAllData = {
                ticker: 'AMZN',
                quantity: 7,
                price: 130.00
            };

            const sellAllResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellAllData)
                .expect(200);
            
            expect(sellAllResponse.body.message).toBe('Holding sold completely and removed');
            expect(sellAllResponse.body.sell_price).toBe(130.00);
            expect(sellAllResponse.body.sell_value).toBe(910.00); // 7 * 130
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
            expect(buyResponse.body.used_price).toBe(200.00);

            // Sell 7 shares
            const sellData = {
                ticker: 'GOOGL',
                quantity: 7,
                price: 180.00
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(8);
            expect(sellResponse.body.sell_price).toBe(180.00);
            expect(sellResponse.body.sell_value).toBe(1260.00); // 7 * 180
        });

        test('should handle buy with fetched price then sell with specified price', async () => {
            // Mock fetch for buy operation
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=META')) {
                    return Promise.resolve({
                        json: async () => ({ price: '95.25' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            // Buy with fetched current price
            const buyData = {
                ticker: 'META',
                type: 'stock',
                name: 'Meta Platforms Inc.',
                quantity: 20
                // price omitted - will fetch current
            };

            const buyResponse = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(buyResponse.body.used_price).toBe(95.25);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://api.twelvedata.com/price?symbol=META')
            );

            // Sell with specified price
            const sellData = {
                ticker: 'META',
                quantity: 8,
                price: 98.50
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(12);
            expect(sellResponse.body.sell_price).toBe(98.50);
            expect(sellResponse.body.sell_value).toBe(788.00); // 8 * 98.50
        });

        test('should handle buy and sell both with fetched prices', async () => {
            // Mock fetch for buy operation
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=SNAP')) {
                    return Promise.resolve({
                        json: async () => ({ price: '75.80' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            // Buy with fetched current price
            const buyData = {
                ticker: 'SNAP',
                type: 'stock',
                name: 'Snap Inc.',
                quantity: 25
            };

            const buyResponse = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(buyResponse.body.used_price).toBe(75.80);

            // Mock fetch for sell operation - update mock to handle SNAP sell price
            fetch.mockImplementation((url) => {
                if (url.includes('/price?symbol=SNAP')) {
                    return Promise.resolve({
                        json: async () => ({ price: '78.25' })
                    });
                } else if (url.includes('/price?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({ price: '100.50' })
                    });
                } else if (url.includes('/quote?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Mock Company Name',
                            close: '100.50'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL in mock'));
                }
            });

            // Sell with fetched current price
            const sellData = {
                ticker: 'SNAP',
                quantity: 10
                // price omitted - will fetch current
            };

            const sellResponse = await request(backendApp)
                .post('/api/holdings/1/sell')
                .send(sellData)
                .expect(200);
            
            expect(sellResponse.body.remaining_quantity).toBe(15);
            expect(sellResponse.body.sell_price).toBe(78.25);
            expect(sellResponse.body.sell_value).toBe(782.50); // 10 * 78.25
            expect(fetch).toHaveBeenCalled(); // Verify fetch was called (may be called multiple times for type detection)
        });
    });

    describe('Currency and Gold Type Handling', () => {
        beforeEach(() => {
            fetch.mockClear();
        });

        test('should create gold holding without fetching name or price', async () => {
            const buyData = {
                ticker: 'GLD',
                type: 'gold',
                name: 'Gold ETF',
                price: 185.50,
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.quantity).toBe(5);
            expect(response.body.price).toBe(185.50);
            expect(response.body.used_price).toBe(185.50);
            expect(response.body.detected_type).toBe('gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should create currency holding without fetching name or price', async () => {
            const buyData = {
                ticker: 'EUR',
                type: 'currency',
                name: 'Euro Currency',
                price: 1.08,
                quantity: 1000
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.quantity).toBe(1000);
            expect(response.body.price).toBe(1.08);
            expect(response.body.used_price).toBe(1.08);
            expect(response.body.detected_type).toBe('currency');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should use ticker as name for gold when name not provided', async () => {
            const buyData = {
                ticker: 'GOLD',
                type: 'gold',
                price: 2000.00,
                quantity: 2
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.quantity).toBe(2);
            expect(response.body.price).toBe(2000.00);
            expect(response.body.used_price).toBe(2000.00);
            expect(response.body.detected_type).toBe('gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should use ticker as name for currency when name not provided', async () => {
            const buyData = {
                ticker: 'JPY',
                type: 'currency',
                price: 0.0067,
                quantity: 50000
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(201);
            
            expect(response.body.message).toBe('New holding created successfully');
            expect(response.body.quantity).toBe(50000);
            expect(response.body.price).toBe(0.0067);
            expect(response.body.used_price).toBe(0.0067);
            expect(response.body.detected_type).toBe('currency');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should require manual price for gold transactions', async () => {
            const buyData = {
                ticker: 'GLD',
                type: 'gold',
                name: 'Gold ETF',
                quantity: 5
                // price omitted
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price is required for currency and gold transactions. Please provide the price field manually.');
            expect(response.body.error).toBe('Manual price input required for currency/gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should require manual price for currency transactions', async () => {
            const buyData = {
                ticker: 'EUR',
                type: 'currency',
                name: 'Euro Currency',
                quantity: 1000
                // price omitted
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price is required for currency and gold transactions. Please provide the price field manually.');
            expect(response.body.error).toBe('Manual price input required for currency/gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should require manual price when price is 0 for gold', async () => {
            const buyData = {
                ticker: 'GLD',
                type: 'gold',
                name: 'Gold ETF',
                price: 0,
                quantity: 5
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price is required for currency and gold transactions. Please provide the price field manually.');
            expect(response.body.error).toBe('Manual price input required for currency/gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should require manual price when price is empty string for currency', async () => {
            const buyData = {
                ticker: 'EUR',
                type: 'currency',
                name: 'Euro Currency',
                price: '',
                quantity: 1000
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(buyData)
                .expect(400);
            
            expect(response.body.message).toBe('Price is required for currency and gold transactions. Please provide the price field manually.');
            expect(response.body.error).toBe('Manual price input required for currency/gold');
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });

        test('should update existing gold holding when buying more', async () => {
            // First, create an initial gold holding
            const firstBuy = {
                ticker: 'GOLD',
                type: 'gold',
                name: 'Physical Gold',
                price: 1950.00,
                quantity: 1
            };

            await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(firstBuy)
                .expect(201);

            // Buy more of the same gold
            const secondBuy = {
                ticker: 'GOLD',
                type: 'gold',
                name: 'Physical Gold',
                price: 2050.00,
                quantity: 1
            };

            const response = await request(backendApp)
                .post('/api/holdings/1/buy')
                .send(secondBuy)
                .expect(200);
            
            expect(response.body.message).toBe('Holdings updated successfully');
            expect(response.body.new_quantity).toBe(2);
            expect(response.body.new_avg_price).toBe(2000.00); // (1*1950 + 1*2050) / 2
            expect(response.body.used_price).toBe(2050.00);
            
            // Verify no API calls were made
            expect(fetch).not.toHaveBeenCalled();
        });
    });
});

// Simple test runner for manual execution
if (require.main === module) {
    console.log('Running Holdings API Tests...');
    console.log('To run tests, use: npm test or jest backend/test_holdings.js');
}