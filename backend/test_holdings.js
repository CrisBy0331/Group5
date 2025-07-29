const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock sqlite3 before importing backend
jest.mock('sqlite3', () => {
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
                if (callback) {
                    const result = { lastID: 1, changes: 1 };
                    callback.call(result, null);
                }
            } else if (query.includes('UPDATE holding')) {
                // Check if the record_id parameter is '999' (non-existent holding)
                const record_id = params[6]; // record_id is the 7th parameter in UPDATE holding SET type = ?, ticker = ?, name = ?, buyin_price = ?, quantity = ? WHERE user_id = ? AND record_id = ?
                if (record_id === '999') {
                    if (callback) {
                        const result = { changes: 0 };
                        callback.call(result, null);
                    }
                } else {
                    if (callback) {
                        const result = { changes: 1 };
                        callback.call(result, null);
                    }
                }
            } else if (query.includes('DELETE FROM holding')) {
                // Check if the record_id parameter is '999' (non-existent holding)
                const record_id = params[1]; // record_id is the 2nd parameter in DELETE FROM holding WHERE user_id = ? AND record_id = ?
                if (record_id === '999') {
                    if (callback) {
                        const result = { changes: 0 };
                        callback.call(result, null);
                    }
                } else {
                    if (callback) {
                        const result = { changes: 1 };
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
                const user_id = params[0];
                if (user_id === '999') {
                    if (callback) callback(null, []);
                } else {
                    if (callback) callback(null, [
                        { 
                            record_id: 1, 
                            user_id: parseInt(user_id), 
                            type: 'stock', 
                            ticker: 'AAPL', 
                            name: 'Apple Inc.', 
                            buyin_price: 150.00, 
                            quantity: 10,
                            updated_at: '2024-01-01 10:00:00'
                        },
                        { 
                            record_id: 2, 
                            user_id: parseInt(user_id), 
                            type: 'bond', 
                            ticker: 'BOND001', 
                            name: 'Treasury Bond', 
                            buyin_price: 1000.00, 
                            quantity: 5,
                            updated_at: '2024-01-01 11:00:00'
                        }
                    ]);
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
            expect(response.body.record_id).toBe(1);
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
            const validTypes = ['stock', 'bond', 'fund', 'gold', 'cash'];
            
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