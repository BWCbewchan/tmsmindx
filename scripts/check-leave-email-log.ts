import 'dotenv/config'
import pool from '../lib/db'

async function main() {
  const r = await pool.query(
    `SELECT email_type, status, sender_email, to_recipients, source, error_message, created_at
     FROM email_delivery_logs
     WHERE source NOT LIKE 'scripts/%'
     ORDER BY created_at DESC
     LIMIT 20`,
  )
  console.log('Production email log (non-script, latest 20):')
  console.table(r.rows)

  const leave = await pool.query(
    `SELECT email_type, status, sender_email, to_recipients, source, created_at
     FROM email_delivery_logs
     WHERE email_type IN ('leave_admin_rejected', 'leave_approved_substitute_confirmed')
       AND source = 'app/api/emails'
     ORDER BY created_at DESC
     LIMIT 10`,
  )
  console.log('Leave flow via app/api/emails:')
  console.table(leave.rows)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
