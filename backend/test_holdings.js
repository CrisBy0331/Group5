const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock sqlite3 before importing backend
jest.mock('sqlite3', () => {
    // Store mock data state
    let mockHoldings = [
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
                    record_id: mockHoldings.length + 1,
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
            } else if (query.includes('UPDATE holding')) {
                // Update existing holding in mock data
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
            } else if (query.includes('DELETE FROM holding')) {
                // Remove holding from mock data
                const record_id = parseInt(params[1]);
                const user_id = parseInt(params[0]);
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
            
            if (query.includes('WHERE user_id = ?')) {
                const user_id = params[0];
                if (user_id === '999') {
                    if (callback) callback(null, null);
                } else {
                    if (callback) callback(null, { user_id: parseInt(user_id), username: 'testuser', password: 'hash' });
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
                    { user_id: 1, username: 'user1', password: 'hash1' },
                    { user_id: 2, username: 'user2', password: 'hash2' }
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
});

// Simple test runner for manual execution
if (require.main === module) {
    console.log('Running Holdings API Tests...');
    console.log('To run tests, use: npm test or jest backend/test_holdings.js');
}