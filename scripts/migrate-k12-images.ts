import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import pool from '../lib/db';
import { uploadQuestionImageBuffer } from '../lib/question-image-storage';

async function migrateImages() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting migration... Dry run: ${isDryRun}`);

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, slug, content FROM k12_documents');
    let totalUpdated = 0;

    for (const row of result.rows) {
      let content = row.content;
      if (!content) continue;

      let changed = false;

      // Extract all local URLs that point to /k12-docs/...
      // This will match ![](/k12-docs/...) and <img src="/k12-docs/...">
      const urlRegex = /\/k12-docs\/[a-zA-Z0-9\-_./%]+/g;
      const localUrls = new Set<string>();
      
      let m;
      while ((m = urlRegex.exec(content)) !== null) {
          localUrls.add(m[0]);
      }

      for (const url of localUrls) {
        const decodedUrl = decodeURIComponent(url);
        const filePath = path.join(process.cwd(), 'public', decodedUrl);

        try {
          const buffer = await fs.readFile(filePath);
          console.log(`[Doc ${row.id}: ${row.slug}] Found local image: ${url}`);
          
          if (!isDryRun) {
            // Determine content type
            const ext = path.extname(decodedUrl).toLowerCase();
            let contentType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            if (ext === '.gif') contentType = 'image/gif';
            if (ext === '.svg') contentType = 'image/svg+xml';
            if (ext === '.webp') contentType = 'image/webp';

            const uploaded = await uploadQuestionImageBuffer(buffer, contentType, path.basename(decodedUrl));
            console.log(`  -> Uploaded to Cloud Storage: ${uploaded.url}`);

            // Replace all occurrences of this exact local URL with the new cloud URL
            content = content.split(url).join(uploaded.url);
            changed = true;
          }
        } catch (error: any) {
           console.log(`[Doc ${row.id}: ${row.slug}] Warning: File not found or error reading ${url} - ${error.message}`);
        }
      }

      if (changed && !isDryRun) {
        await client.query('UPDATE k12_documents SET content = $1 WHERE id = $2', [content, row.id]);
        totalUpdated++;
        console.log(`[Doc ${row.id}: ${row.slug}] Updated database.`);
      }
    }

    console.log(`\nMigration completed. ${totalUpdated} documents updated.`);

  } finally {
    client.release();
  }
}

migrateImages().catch(console.error).finally(() => process.exit(0));
