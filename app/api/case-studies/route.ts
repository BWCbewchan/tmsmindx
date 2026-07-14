import {
  requireBearerAdminOrSuperMutation,
} from '@/lib/auth-server'
import { requireBearerSession } from '@/lib/datasource-api-auth'
import pool from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const CASE_CATEGORIES = new Set([
  'Quản lý lớp học',
  'Tương tác học sinh',
  'Kỹ thuật giảng dạy',
  'Xử lý tình huống đặc biệt',
])

type CaseStudyRow = {
  id: number | string
  category: string
  title: string
  directions: unknown
  notes: string | null
  created_at: string | Date
}

type CaseStudyInput = {
  category: string
  title: string
  directions: string[]
  notes: string | null
}

function serializeCaseStudy(row: CaseStudyRow) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    directions: Array.isArray(row.directions)
      ? row.directions.map((step) => String(step))
      : [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}

function validateInput(body: unknown):
  | { ok: true; data: CaseStudyInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }
  }

  const value = body as Record<string, unknown>
  const category = String(value.category ?? '').trim()
  const title = String(value.title ?? '').trim()
  const notesText = String(value.notes ?? '').trim()

  const directions = Array.isArray(value.directions)
    ? value.directions
        .map((step) => String(step).trim())
        .filter(Boolean)
    : []

  if (!CASE_CATEGORIES.has(category)) {
    return { ok: false, error: 'Danh mục tình huống không hợp lệ' }
  }

  if (!title) {
    return { ok: false, error: 'Tên tình huống là bắt buộc' }
  }

  if (directions.length === 0) {
    return { ok: false, error: 'Cần có ít nhất một hướng xử lý' }
  }

  return {
    ok: true,
    data: {
      category,
      title,
      directions,
      notes: notesText || null,
    },
  }
}

// User và admin đã đăng nhập đều có thể xem.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireBearerSession(request)
    if (!auth.ok) return auth.response

    const result = await pool.query<CaseStudyRow>(`
      select id, category, title, directions, notes, created_at
      from public.xu_ly_tinh_huong
      order by created_at desc, id desc
    `)

    return NextResponse.json({
      success: true,
      studies: result.rows.map(serializeCaseStudy),
    })
  } catch (error) {
    console.error('Error fetching case studies:', error)

    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách tình huống' },
      { status: 500 },
    )
  }
}

// Chỉ admin/super_admin được tạo tình huống.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireBearerAdminOrSuperMutation(request)
    if (!auth.ok) return auth.response

    const validation = validateInput(await request.json())
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      )
    }

    const { category, title, directions, notes } = validation.data

    const result = await pool.query<CaseStudyRow>(
      `
        insert into public.xu_ly_tinh_huong
          (category, title, directions, notes, created_by, updated_by)
        values ($1, $2, $3::jsonb, $4, $5, $5)
        returning id, category, title, directions, notes, created_at
      `,
      [
        category,
        title,
        JSON.stringify(directions),
        notes,
        auth.sessionEmail,
      ],
    )

    return NextResponse.json(
      {
        success: true,
        study: serializeCaseStudy(result.rows[0]),
        message: 'Đã thêm tình huống mới',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating case study:', error)

    return NextResponse.json(
      { success: false, error: 'Không thể thêm tình huống' },
      { status: 500 },
    )
  }
}

// Chỉ admin/super_admin được sửa tình huống.
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireBearerAdminOrSuperMutation(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const id = Number(body?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID tình huống không hợp lệ' },
        { status: 400 },
      )
    }

    const validation = validateInput(body)
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 },
      )
    }

    const { category, title, directions, notes } = validation.data

    const result = await pool.query<CaseStudyRow>(
      `
        update public.xu_ly_tinh_huong
        set
          category = $2,
          title = $3,
          directions = $4::jsonb,
          notes = $5,
          updated_by = $6
        where id = $1
        returning id, category, title, directions, notes, created_at
      `,
      [
        id,
        category,
        title,
        JSON.stringify(directions),
        notes,
        auth.sessionEmail,
      ],
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tình huống' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      study: serializeCaseStudy(result.rows[0]),
      message: 'Đã cập nhật tình huống',
    })
  } catch (error) {
    console.error('Error updating case study:', error)

    return NextResponse.json(
      { success: false, error: 'Không thể cập nhật tình huống' },
      { status: 500 },
    )
  }
}

// Chỉ admin/super_admin được xóa tình huống.
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireBearerAdminOrSuperMutation(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const id = Number(body?.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'ID tình huống không hợp lệ' },
        { status: 400 },
      )
    }

    const result = await pool.query<{ id: number }>(
      `
        delete from public.xu_ly_tinh_huong
        where id = $1
        returning id
      `,
      [id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tình huống' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa tình huống',
    })
  } catch (error) {
    console.error('Error deleting case study:', error)

    return NextResponse.json(
      { success: false, error: 'Không thể xóa tình huống' },
      { status: 500 },
    )
  }
}