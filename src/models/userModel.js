// src/models/userModel.js
const pool = require('../config/database');

const createUser = async ({ email, passwordHash }) => {
  const [result] = await pool.execute(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, passwordHash]
  );
  return result.insertId;
};

const findUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT id, email, password FROM users WHERE email = ?`,
    [email]
  );
  return rows[0];
};

module.exports = { createUser, findUserByEmail };
