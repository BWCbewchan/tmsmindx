const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

require('dotenv').config()

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'add_teaching_document_folders.sql'),
    'utf8',
  )

  await pool.query(sql)

  const result = await pool.query(`
    SELECT folder_name, COUNT(*)::integer AS document_count
    FROM teaching_documents
    GROUP BY folder_name
    ORDER BY folder_name
  `)

  console.table(result.rows)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
