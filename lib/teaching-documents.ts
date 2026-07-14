import crypto from 'crypto'

import { GetObjectCommand, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

import pool from '@/lib/db'
import { createSupabaseS3Client } from '@/lib/supabase-s3'

export const TEACHING_DOCUMENT_BUCKET = process.env.TEACHING_DOCUMENTS_BUCKET || 'teaching-documents'
export const TEACHING_DOCUMENT_LEVELS = ['Basic', 'Advance', 'Intensive'] as const
export const TEACHING_DOCUMENT_STATUSES = ['published', 'draft', 'disabled'] as const
export const TEACHING_DOCUMENT_SOURCE_TYPES = ['file', 'material_link'] as const
export const TEACHING_DOCUMENT_FOLDERS = [
  'Lesson Plan',
  'Slide',
  'Homework',
  'Assigment Barem',
  'Sample',
  'Material',
] as const

export type TeachingDocumentLevel = (typeof TEACHING_DOCUMENT_LEVELS)[number]
export type TeachingDocumentStatus = (typeof TEACHING_DOCUMENT_STATUSES)[number]
export type TeachingDocumentSourceType = (typeof TEACHING_DOCUMENT_SOURCE_TYPES)[number]
export type TeachingDocumentFolder = (typeof TEACHING_DOCUMENT_FOLDERS)[number]

export type TeachingDocument = {
  id: number
  title: string
  description: string | null
  s3_bucket: string
  s3_key: string
  file_name: string
  file_size: number
  file_type: string
  subject_name: string
  course_name: string | null
  document_level: TeachingDocumentLevel
  folder_name: TeachingDocumentFolder
  source_type: TeachingDocumentSourceType
  material_url: string | null
  lesson_number: string
  document_status: TeachingDocumentStatus
  is_secure_view: boolean
  watermark_config: Record<string, unknown>
  created_by_email: string
  created_at: string
  updated_at: string
}

export function isTeachingDocumentLevel(value: string): value is TeachingDocumentLevel {
  return TEACHING_DOCUMENT_LEVELS.includes(value as TeachingDocumentLevel)
}

export function isTeachingDocumentStatus(value: string): value is TeachingDocumentStatus {
  return TEACHING_DOCUMENT_STATUSES.includes(value as TeachingDocumentStatus)
}

export function isTeachingDocumentFolder(value: string): value is TeachingDocumentFolder {
  return TEACHING_DOCUMENT_FOLDERS.includes(value as TeachingDocumentFolder)
}

export function classifyTeachingDocument(fileType: string, fileName: string) {
  const lower = fileName.toLowerCase()
  if (fileType.includes('wordprocessingml') || lower.endsWith('.docx')) return 'docx'
  if (fileType.includes('presentationml') || lower.endsWith('.pptx')) return 'pptx'
  if (fileType.includes('pdf') || lower.endsWith('.pdf')) return 'pdf'
  if (fileType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower)) return 'image'
  return 'file'
}

export function sanitizeFileStem(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'tai-lieu'
}

export async function ensureTeachingDocumentBucket() {
  const client = createSupabaseS3Client()
  try {
    await client.send(new HeadBucketCommand({ Bucket: TEACHING_DOCUMENT_BUCKET }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: TEACHING_DOCUMENT_BUCKET }))
  }
}

export async function uploadTeachingDocumentObject(file: File, key: string) {
  const client = createSupabaseS3Client()
  const buffer = Buffer.from(await file.arrayBuffer())
  await client.send(
    new PutObjectCommand({
      Bucket: TEACHING_DOCUMENT_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    }),
  )
}

export async function getTeachingDocumentObject(bucket: string, key: string) {
  const client = createSupabaseS3Client()
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const chunks: Buffer[] = []
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk))
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: object.ContentType || 'application/octet-stream',
  }
}

export async function listTeachingDocuments(options: { publishedOnly?: boolean } = {}): Promise<TeachingDocument[]> {
  const result = await pool.query(
    `
      SELECT *
      FROM teaching_documents
      ${options.publishedOnly ? `WHERE COALESCE(document_status, 'published') = 'published'` : ''}
      ORDER BY subject_name ASC,
        course_name ASC,
        folder_name ASC,
        CASE document_level
          WHEN 'Basic' THEN 1
          WHEN 'Advance' THEN 2
          WHEN 'Intensive' THEN 3
          ELSE 4
        END ASC,
        lesson_number ASC,
        created_at DESC
    `,
  )
  return result.rows
}

export async function findTeachingDocument(id: number): Promise<TeachingDocument | null> {
  const result = await pool.query('SELECT * FROM teaching_documents WHERE id = $1 LIMIT 1', [id])
  return result.rows[0] ?? null
}

export async function updateTeachingDocumentFolder(id: number, folderName: TeachingDocumentFolder) {
  const result = await pool.query(
    `
      UPDATE teaching_documents
      SET folder_name = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [id, folderName],
  )
  return (result.rows[0] as TeachingDocument | undefined) ?? null
}

export async function createTeachingDocumentRecord(input: {
  title: string
  description: string | null
  s3Key: string
  fileName: string
  fileSize: number
  fileType: string
  subjectName: string
  courseName?: string | null
  documentLevel: TeachingDocumentLevel
  folderName: TeachingDocumentFolder
  lessonNumber: string
  documentStatus?: TeachingDocumentStatus
  sourceType?: TeachingDocumentSourceType
  materialUrl?: string | null
  createdByEmail: string
}) {
  const result = await pool.query(
    `
      INSERT INTO teaching_documents (
        title, description, s3_bucket, s3_key, file_name, file_size, file_type,
        subject_name, course_name, document_level, folder_name, lesson_number, document_status,
        source_type, material_url, created_by_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `,
    [
      input.title,
      input.description,
      TEACHING_DOCUMENT_BUCKET,
      input.s3Key,
      input.fileName,
      input.fileSize,
      input.fileType,
      input.subjectName,
      input.courseName || null,
      input.documentLevel,
      input.folderName,
      input.lessonNumber,
      input.documentStatus || 'published',
      input.sourceType || 'file',
      input.materialUrl || null,
      input.createdByEmail,
    ],
  )
  return result.rows[0] as TeachingDocument
}

function tokenSecret() {
  return process.env.TEACHING_DOCUMENT_TOKEN_SECRET || process.env.JWT_SECRET || 'teaching-document-dev-secret'
}

export function signDocumentToken(payload: { documentId: number; email: string; page?: number; expiresAt: number }) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifyDocumentToken(token: string) {
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url')
  if (signature.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    documentId: number
    email: string
    page?: number
    expiresAt: number
  }
  if (!payload.expiresAt || Date.now() > payload.expiresAt) return null
  return payload
}
