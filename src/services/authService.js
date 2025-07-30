// src/services/authService.js
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { createUser, findUserByEmail } = require('../models/userModel');
require('dotenv').config();

const register = async ({ email, password }) => {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('이미 존재하는 이메일입니다.');

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await createUser({ email, passwordHash });
  return { id: userId, email };
};

const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);
  if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return token;
};

module.exports = { register, login };
