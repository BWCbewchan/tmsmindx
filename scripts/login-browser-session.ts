import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/jwt-secret';
import fs from 'fs';
import path from 'path';

async function createBrowserSessionState() {
  const token = jwt.sign(
    {
      userId: 1,
      email: 'hoteaching@mindx.com.vn',
      role: 'super_admin',
      purpose: 'tps_edge',
      ap: true,
    },
    getJwtSecret(),
    { expiresIn: '30d' }
  );

  const state = {
    cookies: [
      {
        name: 'tps_session',
        value: token,
        url: 'http://localhost:3000',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      },
      {
        name: 'tps_session',
        value: token,
        url: 'http://127.0.0.1:3000',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      }
    ],
    origins: []
  };

  const statePath = path.resolve(__dirname, '../auth.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log('Session state updated with token.');
}

createBrowserSessionState();
