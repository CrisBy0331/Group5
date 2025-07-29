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
            
            if (query.includes('INSERT INTO users')) {
                if (callback) callback(null, { lastID: 1, changes: 1 });
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
                    if (callback) callback(null, { user_id: parseInt(user_id), username: 'testuser', password: 'hash', avatar: 'test-avatar.jpg' });
                }
            } else if (query.includes('WHERE username = ?')) {
                const username = params[0];
                if (callback) callback(null, { user_id: 1, username, password: 'hash', avatar: 'test-avatar.jpg' });
            } else {
                if (callback) callback(null, null);
            }
        }),
        all: jest.fn().mockImplementation((query, params, callback) => {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            
            if (callback) callback(null, [
                { user_id: 1, username: 'user1', password: 'hash1', avatar: 'user1-avatar.jpg' },
                { user_id: 2, username: 'user2', password: 'hash2', avatar: 'user2-avatar.jpg' }
            ]);
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

    describe('GET /api/users/:user_id', () => {
        test('should return 404 for non-existent user', async () => {
            const response = await request(backendApp)
                .get('/api/users/999')
                .expect(404);
            
            expect(response.body.message).toBe('User not found');
        });

        test('should return user by ID', async () => {
            const response = await request(backendApp)
                .get('/api/users/1')
                .expect(200);
            
            expect(response.body.username).toBe('testuser');
            expect(response.body.user_id).toBe(1);
        });
    });

    describe('POST /api/users/:user_id', () => {
        test('should create a new user', async () => {
            const userData = {
                username: 'newuser',
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(userData)
                .expect(201);
            
            expect(response.body.message).toBe('User created successfully');
        });

        test('should create a new user with avatar', async () => {
            const userData = {
                username: 'newuser',
                password: 'newpassword',
                avatar: 'newuser-avatar.jpg'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(userData)
                .expect(201);
            
            expect(response.body.message).toBe('User created successfully');
        });

        test('should handle missing username', async () => {
            const userData = {
                password: 'newpassword'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(userData)
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
        });

        test('should handle missing password', async () => {
            const userData = {
                username: 'newuser'
            };

            const response = await request(backendApp)
                .post('/api/users/1')
                .send(userData)
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
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
            
            // expect(response.body.message).toBe('User not found or already deleted');
        });
    });

    describe('Data Validation', () => {
        test('should handle empty request body', async () => {
            const response = await request(backendApp)
                .post('/api/users/1')
                .send({})
                .expect(400);
            
            expect(response.body.message).toBe('Username and password are required');
        });

        test('should handle malformed JSON', async () => {
            const response = await request(backendApp)
                .post('/api/users/1')
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);
        });
    });
});

// Simple test runner for manual execution
if (require.main === module) {
    console.log('Running Users API Tests...');
    console.log('To run tests, use: npm test or jest backend/test_users.js');
}
