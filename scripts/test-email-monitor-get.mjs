import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../lib/jwt-secret.ts'

const token = jwt.sign(
  { email: 'hoteaching@mindx.com.vn', role: 'super_admin', ap: true },
  getJwtSecret(),
  { algorithm: 'HS256', expiresIn: '1h' },
)

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15000)

try {
  const started = Date.now()
  const res = await fetch(
    'http://localhost:3000/api/admin/email-monitor?period=24h&page=1&pageSize=25',
    {
      headers: { Cookie: `tps_session=${token}` },
      signal: controller.signal,
    },
  )
  const data = await res.json()
  console.log('ms', Date.now() - started, 'status', res.status)
  console.log('configured', data.configuration?.configured)
  console.log('sender', data.configuration?.senderEmail)
  console.log('logs', data.logs?.length)
} catch (error) {
  console.error('FAIL', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  clearTimeout(timeout)
}
