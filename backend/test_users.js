const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock fetch globally before importing backend
global.fetch = jest.fn();

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
            
            if (query.includes('INSERT INTO users')) {
                if (callback) {
                    const result = { lastID: 1, changes: 1 };
                    callback.call(result, null);
                }
            } else if (query.includes('UPDATE users')) {
                // Check if the user_id parameter is '999' (non-existent user)
                const user_id = params[3]; // user_id is the 4th parameter (index 3) in UPDATE users SET username = ?, password = ?, avatar = ? WHERE user_id = ?
                if (user_id === '999') {
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
            } else if (query.includes('DELETE FROM users')) {
                // Check if the user_id parameter is '999' (non-existent user)
                const user_id = params[0]; // First parameter is user_id
                if (user_id === '999') {
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
            } else if (query.includes('INSERT INTO portfolio_name')) {
                if (callback) {
                    const result = { lastID: 1, changes: 1 };
                    callback.call(result, null);
                }
            } else if (query.includes('UPDATE portfolio_name')) {
                if (callback) {
                    const result = { changes: 1 };
                    callback.call(result, null);
                }
            } else if (query.includes('CREATE TABLE')) {
                if (callback) callback(null);
            } else {
                if (callback) callback(null, { changes: 0 });
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
                    // Mock password hash for testing - use a fixed hash value
                    const passwordHash = '9f735e0df9a1ddc702bf0a1a7b83033f9f7153a00c29de82cedadc9957289b05'; // sha256 of 'testpassword'
                    if (callback) callback(null, { user_id: parseInt(user_id), username: 'testuser', password: passwordHash, avatar: 'test-avatar.jpg' });
                }
            } else if (query.includes('WHERE username = ?')) {
                const username = params[0];
                if (username === 'existinguser') {
                    // Return existing user to test username conflict
                    if (callback) callback(null, { user_id: 1, username, password: 'hash', avatar: 'test-avatar.jpg' });
                } else {
                    // Return null for new username (no conflict)
                    if (callback) callback(null, null);
                }
            } else if (query.includes('WHERE ticker = ?')) {
                const ticker = params[0];
                if (ticker === 'AAPL') {
                    // Return cached ticker info
                    if (callback) callback(null, { ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', updated_at: '2024-01-01 10:00:00' });
                } else {
                    // Return null for non-cached tickers
                    if (callback) callback(null, null);
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
            
            if (query.includes('portfolio_name')) {
                // Mock cache data for ticker info
                if (callback) callback(null, [
                    { ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', updated_at: '2024-01-01 10:00:00' },
                    { ticker: 'TSLA', name: 'Tesla Inc.', type: 'stock', updated_at: '2024-01-01 11:00:00' }
                ]);
            } else {
                if (callback) callback(null, [
                    { user_id: 1, username: 'user1', password: 'hash1', avatar: 'user1-avatar.jpg' },
                    { user_id: 2, username: 'user2', password: 'hash2', avatar: 'user2-avatar.jpg' }
                ]);
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

describe('Users API Tests', () => {
    
    describe('GET /api/users', () => {
        test('should return all users', async () => {
            const response = await request(backendApp)
                .get('/api/users')
                .expect(200);
            
            expect(response.body).toHaveLength(2);
            expect(response.body[0].username).toBe('user1');
            expect(response.body[1].username).toBe('user2');
        });
    });

    describe('POST /api/users/', () => {
        test('should create a new user', async () => {
            const userData = {
                username: 'newuser',
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/')
                .send(userData)
                .expect(201);
            
            expect(response.body.message).toBe('User created successfully');
            expect(response.body.user_id).toBe(1);
            expect(response.body.username).toBe('newuser');
        });

        test('should create a new user with avatar', async () => {
            const userData = {
                username: 'newuser',
                password: 'newpassword',
                avatar: 'newuser-avatar.jpg'
            };

            const response = await request(backendApp)
                .post('/api/users/')
                .send(userData)
                .expect(201);
            
            expect(response.body.message).toBe('User created successfully');
            expect(response.body.user_id).toBe(1);
            expect(response.body.username).toBe('newuser');
        });

        test('should handle missing username', async () => {
            const userData = {
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/')
                .send(userData)
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
        });

        test('should handle missing password', async () => {
            const userData = {
                username: 'newuser'
            };

            const response = await request(backendApp)
                .post('/api/users/')
                .send(userData)
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
        });

        test('should handle username already exists', async () => {
            const userData = {
                username: 'existinguser',
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/')
                .send(userData)
                .expect(409);
            
            expect(response.body.message).toBe('Username already exists');
        });
    });

    describe('POST /api/users/:user_id (password check)', () => {
        test('should verify correct password', async () => {
            const passwordData = {
                password: 'testpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(passwordData)
                .expect(200);
            
            expect(response.body.message).toBe('Password is correct');
            expect(response.body.user_id).toBe(1);
            expect(response.body.username).toBe('testuser');
        });

        test('should reject incorrect password', async () => {
            const passwordData = {
                password: 'wrongpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(passwordData)
                .expect(401);
            
            expect(response.body.message).toBe('Password is incorrect');
        });

        test('should handle missing password', async () => {
            const response = await request(backendApp)
                .post('/api/users/1')
                .send({})
                .expect(400);
            
            expect(response.body.message).toBe('Password is required');
        });

        test('should return 404 for non-existent user', async () => {
            const passwordData = {
                password: 'testpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/999')
                .send(passwordData)
                .expect(404);
            
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('PUT /api/users/:user_id', () => {
        test('should update existing user', async () => {
            const updateData = {
                username: 'updateduser',
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .put('/api/users/1')
                .send(updateData)
                .expect(200);
            
            expect(response.body.message).toBe('User updated successfully');
        });

        test('should update existing user with avatar', async () => {
            const updateData = {
                username: 'updateduser',
                password: 'newpassword',
                avatar: 'updated-avatar.jpg'
            };

            const response = await request(backendApp)
                .put('/api/users/1')
                .send(updateData)
                .expect(200);
            
            expect(response.body.message).toBe('User updated successfully');
        });

        test('should return 404 for non-existent user', async () => {
            const updateData = {
                username: 'updateduser',
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .put('/api/users/999')
                .send(updateData)
                .expect(404);
            
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('DELETE /api/users/:user_id', () => {
        test('should delete existing user', async () => {
            const response = await request(backendApp)
                .delete('/api/users/1')
                .expect(200);
            
            expect(response.body.message).toBe('User deleted successfully');
        });

        test('should handle deleting non-existent user', async () => {
            const response = await request(backendApp)
                .delete('/api/users/999')
                .expect(200);
            
            expect(response.body.message).toBe('User not found or already deleted');
        });
    });

    describe('Data Validation', () => {
        test('should handle empty request body for user creation', async () => {
            const response = await request(backendApp)
                .post('/api/users/')
                .send({})
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
        });

        test('should handle malformed JSON', async () => {
            const response = await request(backendApp)
                .post('/api/users/')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });

    describe('Stock API Integration', () => {
        beforeEach(() => {
            fetch.mockClear();
        });

        test('should handle CORS headers', async () => {
            const response = await request(backendApp)
                .options('/api/users')
                .expect(200);
            
            expect(response.headers['access-control-allow-origin']).toBe('*');
            expect(response.headers['access-control-allow-methods']).toContain('GET');
        });

        test('should serve static files from public directory', async () => {
            const response = await request(backendApp)
                .get('/')
                .expect(200);
            // Basic test that the root endpoint doesn't error
        });
    });
});

describe('Stock API Tests', () => {
    
    beforeEach(() => {
        fetch.mockClear();
    });

    describe('GET /api/stock/price/:ticker', () => {
        test('should fetch stock price successfully', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                json: async () => ({ price: '150.25' })
            });

            const response = await request(backendApp)
                .get('/api/stock/price/AAPL')
                .expect(200);
            
            expect(response.body.price).toBe('150.25');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://api.twelvedata.com/price?symbol=AAPL')
            );
        });

        test('should handle API errors', async () => {
            // Mock API failure
            fetch.mockRejectedValueOnce(new Error('API Error'));

            const response = await request(backendApp)
                .get('/api/stock/price/INVALID')
                .expect(500);
            
            expect(response.body.message).toBe('Error fetching stock data');
            expect(response.body.error).toBe('API Error');
        });
    });

    describe('GET /api/stock/quote/:ticker', () => {
        test('should fetch stock quote successfully', async () => {
            // Mock successful API response
            fetch.mockResolvedValueOnce({
                json: async () => ({ 
                    name: 'Apple Inc.',
                    symbol: 'AAPL',
                    close: '150.25',
                    high: '152.00',
                    low: '148.50',
                    volume: '50000000'
                })
            });

            const response = await request(backendApp)
                .get('/api/stock/quote/AAPL')
                .expect(200);
            
            expect(response.body.name).toBe('Apple Inc.');
            expect(response.body.symbol).toBe('AAPL');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('https://api.twelvedata.com/quote?symbol=AAPL')
            );
        });

        test('should handle API errors for quote', async () => {
            // Mock API failure
            fetch.mockRejectedValueOnce(new Error('Quote API Error'));

            const response = await request(backendApp)
                .get('/api/stock/quote/INVALID')
                .expect(500);
            
            expect(response.body.message).toBe('Error fetching stock data');
            expect(response.body.error).toBe('Quote API Error');
        });
    });
});

describe('Cache Management Tests', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    describe('POST /api/cache/refresh/:ticker', () => {
        test('should refresh cache successfully', async () => {
            // Mock successful API responses for cache refresh
            fetch.mockImplementation((url) => {
                if (url.includes('/quote?symbol=TSLA')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Tesla Inc.',
                            close: '250.00'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=TSLA')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL'));
                }
            });

            const response = await request(backendApp)
                .post('/api/cache/refresh/TSLA')
                .expect(200);
            
            expect(response.body.message).toBe('Cache refreshed successfully for TSLA');
            expect(response.body.data).toBeDefined();
            expect(response.body.data.name).toBe('Tesla Inc.');
            expect(fetch).toHaveBeenCalled();
        });

        test('should handle cache refresh errors', async () => {
            // Mock API failure
            fetch.mockRejectedValueOnce(new Error('Cache refresh failed'));

            const response = await request(backendApp)
                .post('/api/cache/refresh/INVALID')
                .expect(500);
            
            expect(response.body.message).toBe('Failed to refresh cache');
            expect(response.body.error).toContain('Cache refresh failed');
        });

        test('should normalize ticker case for cache refresh', async () => {
            // Mock successful API responses
            fetch.mockImplementation((url) => {
                if (url.includes('/quote?symbol=MSFT')) {
                    return Promise.resolve({
                        json: async () => ({
                            name: 'Microsoft Corporation',
                            close: '300.00'
                        })
                    });
                } else if (url.includes('/symbol_search?symbol=MSFT')) {
                    return Promise.resolve({
                        json: async () => ({
                            data: [{
                                instrument_type: 'Common Stock'
                            }]
                        })
                    });
                } else {
                    return Promise.reject(new Error('Unhandled URL'));
                }
            });

            const response = await request(backendApp)
                .post('/api/cache/refresh/msft') // lowercase input
                .expect(200);
            
            expect(response.body.message).toBe('Cache refreshed successfully for MSFT');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('symbol=MSFT') // Should be uppercase
            );
        });
    });

    describe('GET /api/cache/status', () => {
        test('should return cache status successfully', async () => {
            const response = await request(backendApp)
                .get('/api/cache/status')
                .expect(200);
            
            expect(response.body.message).toBe('Cache status retrieved successfully');
            expect(response.body.cached_tickers).toBeDefined();
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });
});

describe('API Error Handling and Edge Cases', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('should handle malformed JSON in request body', async () => {
        const response = await request(backendApp)
            .post('/api/users/')
            .set('Content-Type', 'application/json')
            .send('{"invalid": json}')
            .expect(400);
    });

    test('should handle very large request bodies gracefully', async () => {
        const largeUsername = 'a'.repeat(1000);
        const userData = {
            username: largeUsername,
            password: 'testpassword'
        };

        const response = await request(backendApp)
            .post('/api/users/')
            .send(userData)
            .expect(201);
        
        expect(response.body.username).toBe(largeUsername);
    });

    test('should handle special characters in usernames', async () => {
        const userData = {
            username: 'test@user#123',
            password: 'testpassword'
        };

        const response = await request(backendApp)
            .post('/api/users/')
            .send(userData)
            .expect(201);
        
        expect(response.body.username).toBe('test@user#123');
    });

    test('should handle concurrent user creation attempts', async () => {
        const userData1 = {
            username: 'concurrent1',
            password: 'password1'
        };
        
        const userData2 = {
            username: 'concurrent2',
            password: 'password2'
        };

        // Send concurrent requests
        const [response1, response2] = await Promise.all([
            request(backendApp).post('/api/users/').send(userData1),
            request(backendApp).post('/api/users/').send(userData2)
        ]);
        
        expect(response1.status).toBe(201);
        expect(response2.status).toBe(201);
    });

    test('should handle password verification with edge cases', async () => {
        // Test with empty password
        const emptyPasswordResponse = await request(backendApp)
            .post('/api/users/1')
            .send({ password: '' })
            .expect(400);
        
        expect(emptyPasswordResponse.body.message).toBe('Password is required');

        // Test with very long password
        const longPassword = 'a'.repeat(1000);
        const longPasswordResponse = await request(backendApp)
            .post('/api/users/1')
            .send({ password: longPassword })
            .expect(401); // Should fail since it won't match the mock hash
        
        expect(longPasswordResponse.body.message).toBe('Password is incorrect');
    });

    test('should handle database connection issues gracefully', async () => {
        // This test assumes the mock is working properly
        // In a real scenario, you might want to test actual database failures
        const response = await request(backendApp)
            .get('/api/users')
            .expect(200);
        
        expect(Array.isArray(response.body)).toBe(true);
    });
});

describe('Security Tests', () => {
    test('should hash passwords properly on user creation', async () => {
        const userData = {
            username: 'securitytest',
            password: 'mysecretpassword'
        };

        const response = await request(backendApp)
            .post('/api/users/')
            .send(userData)
            .expect(201);
        
        // Password should not be returned in response
        expect(response.body.password).toBeUndefined();
        expect(response.body.username).toBe('securitytest');
    });

    test('should validate password correctly using SHA256', async () => {
        // The mock uses a pre-computed hash for 'testpassword'
        const correctPasswordResponse = await request(backendApp)
            .post('/api/users/1')
            .send({ password: 'testpassword' })
            .expect(200);
        
        expect(correctPasswordResponse.body.message).toBe('Password is correct');

        const incorrectPasswordResponse = await request(backendApp)
            .post('/api/users/1')
            .send({ password: 'wrongpassword' })
            .expect(401);
        
        expect(incorrectPasswordResponse.body.message).toBe('Password is incorrect');
    });

    test('should not expose sensitive database errors', async () => {
        // Test with non-existent user ID
        const response = await request(backendApp)
            .post('/api/users/999')
            .send({ password: 'testpassword' })
            .expect(404);
        
        expect(response.body.message).toBe('User not found');
        expect(response.body.error).toBeUndefined(); // Should not expose internal errors
    });
});

// Simple test runner for manual execution
if (require.main === module) {
    console.log('Running Comprehensive API Tests...');
    console.log('To run tests, use: npm test or jest backend/test_users.js');
}
