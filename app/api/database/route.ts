import { requireBearerSuperAdminMutation } from '@/lib/auth-server';
import pool from '@/lib/db';
import { migrations, runMigrations } from '@/lib/migrations';
import { NextRequest, NextResponse } from 'next/server';

// Validate table name exists (prevent SQL injection)
async function validateTable(tableName: string): Promise<boolean> {
    const result = await pool.query(
        `SELECT 1 FROM pg_tables WHERE tablename = $1 AND schemaname = 'public'`,
        [tableName]
    );
    return result.rows.length > 0;
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
}

async function getValidColumns(tableName: string): Promise<Set<string>> {
    const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName],
    );
    return new Set(result.rows.map((row: any) => String(row.column_name)));
}

function validateColumnKeys(
    keys: string[],
    validColumns: Set<string>,
): { ok: true } | { ok: false; response: NextResponse } {
    if (keys.length === 0) {
        return { ok: false, response: NextResponse.json({ error: 'No columns provided' }, { status: 400 }) };
    }
    const invalid = keys.filter((key) => !validColumns.has(key));
    if (invalid.length > 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Invalid column name', columns: invalid },
                { status: 400 },
            ),
        };
    }
    return { ok: true };
}

function isReadOnlySql(sql: string): boolean {
    const normalized = sql.trim().replace(/;\s*$/, '');
    if (!/^(SELECT|WITH|EXPLAIN)\b/i.test(normalized)) return false;
    if (/;\s*\S/.test(normalized)) return false;
    return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|MERGE|CALL|GRANT|REVOKE|COPY|VACUUM|ANALYZE|REFRESH|COMMENT|DO)\b/i.test(normalized);
}

// GET: Lấy thông tin database — chỉ super_admin + Bearer hợp lệ
export async function GET(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdminMutation(request);
        if (!gate.ok) return gate.response;

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'overview';

        switch (action) {
            // ─── Overview: danh sách tables + stats ────────────────
            case 'overview': {
                const tablesResult = await pool.query(`
                    SELECT 
                        t.tablename as name,
                        pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))) as size,
                        (SELECT count(*) FROM information_schema.columns c 
                         WHERE c.table_name = t.tablename AND c.table_schema = 'public') as column_count
                    FROM pg_tables t
                    WHERE t.schemaname = 'public'
                    ORDER BY t.tablename;
                `);

                // Row count chính xác
                const tables = [];
                for (const t of tablesResult.rows) {
                    try {
                        const countRes = await pool.query(`SELECT count(*) as cnt FROM ${quoteIdentifier(String(t.name))}`);
                        tables.push({ ...t, row_count: parseInt(countRes.rows[0].cnt) });
                    } catch {
                        tables.push({ ...t, row_count: 0 });
                    }
                }

                // DB size tổng
                let dbSize = '0 MB';
                try {
                    const sizeRes = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
                    dbSize = sizeRes.rows[0].size;
                } catch { /* ignore */ }

                // Migration history
                let migrationHistory: any[] = [];
                try {
                    const mig = await pool.query('SELECT * FROM _migrations ORDER BY version ASC');
                    migrationHistory = mig.rows;
                } catch { /* _migrations chưa tạo */ }

                return NextResponse.json({
                    tables,
                    migrationHistory,
                    totalTables: tables.length,
                    totalMigrations: migrations.length,
                    appliedMigrations: migrationHistory.length,
                    dbSize,
                });
            }

            // ─── Columns: cấu trúc table ──────────────────────────
            case 'columns': {
                const tableName = searchParams.get('table');
                if (!tableName) return NextResponse.json({ error: 'Missing table parameter' }, { status: 400 });
                if (!(await validateTable(tableName))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }

                const columns = await pool.query(`
                    SELECT column_name, data_type, is_nullable, 
                           column_default, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_name = $1 AND table_schema = 'public'
                    ORDER BY ordinal_position;
                `, [tableName]);

                const indexes = await pool.query(`
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = $1 AND schemaname = 'public';
                `, [tableName]);

                // Primary key
                const pkResult = await pool.query(`
                    SELECT a.attname as column_name
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    JOIN pg_class c ON c.oid = i.indrelid
                    WHERE c.relname = $1 AND i.indisprimary;
                `, [tableName]);
                const primaryKeys = pkResult.rows.map((r: any) => r.column_name);

                // Foreign keys
                const fkResult = await pool.query(`
                    SELECT
                        kcu.column_name,
                        ccu.table_name AS foreign_table,
                        ccu.column_name AS foreign_column
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY';
                `, [tableName]);

                const count = await pool.query(`SELECT count(*) as total FROM ${quoteIdentifier(tableName)}`);

                return NextResponse.json({
                    table: tableName,
                    columns: columns.rows,
                    indexes: indexes.rows,
                    primaryKeys,
                    foreignKeys: fkResult.rows,
                    rowCount: parseInt(count.rows[0].total),
                });
            }

            // ─── Preview: xem data có phân trang ───────────────────
            case 'preview': {
                const tableName = searchParams.get('table');
                const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
                const offset = parseInt(searchParams.get('offset') || '0');
                const sort = searchParams.get('sort') || '';
                const order = searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
                const search = searchParams.get('search') || '';

                if (!tableName) return NextResponse.json({ error: 'Missing table' }, { status: 400 });
                if (!(await validateTable(tableName))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }

                // Get columns to validate sort field
                const colsRes = await pool.query(
                    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
                    [tableName]
                );
                const validCols = colsRes.rows.map((r: any) => String(r.column_name));

                let orderClause = '';
                if (sort && validCols.includes(sort)) {
                    orderClause = `ORDER BY ${quoteIdentifier(sort)} ${order}`;
                }

                // Search across text columns
                let whereClause = '';
                const queryParams: any[] = [limit, offset];
                if (search) {
                    const textCols = await pool.query(
                        `SELECT column_name FROM information_schema.columns 
                         WHERE table_name = $1 AND table_schema = 'public' 
                         AND data_type IN ('text', 'character varying', 'character')`,
                        [tableName]
                    );
                    if (textCols.rows.length > 0) {
                        const conditions = textCols.rows
                            .map((c: any) => `${quoteIdentifier(String(c.column_name))}::text ILIKE $3`)
                            .join(' OR ');
                        whereClause = `WHERE ${conditions}`;
                        queryParams.push(`%${search}%`);
                    }
                }

                const data = await pool.query(
                    `SELECT * FROM ${quoteIdentifier(tableName)} ${whereClause} ${orderClause} LIMIT $1 OFFSET $2`,
                    queryParams
                );

                let totalCount = 0;
                try {
                    if (search && whereClause) {
                        const countRes = await pool.query(
                            `SELECT count(*) as total FROM ${quoteIdentifier(tableName)} ${whereClause.replace('$3', '$1')}`,
                            [`%${search}%`]
                        );
                        totalCount = parseInt(countRes.rows[0].total);
                    } else {
                        const countRes = await pool.query(`SELECT count(*) as total FROM ${quoteIdentifier(tableName)}`);
                        totalCount = parseInt(countRes.rows[0].total);
                    }
                } catch { totalCount = data.rows.length; }

                return NextResponse.json({
                    table: tableName,
                    rows: data.rows,
                    columns: validCols,
                    count: data.rows.length,
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + data.rows.length < totalCount,
                });
            }

            // ─── Export: xuất data CSV/JSON ─────────────────────────
            case 'export': {
                const tableName = searchParams.get('table');
                const format = searchParams.get('format') || 'json';
                if (!tableName) return NextResponse.json({ error: 'Missing table' }, { status: 400 });
                if (!(await validateTable(tableName))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }

                const data = await pool.query(`SELECT * FROM ${quoteIdentifier(tableName)}`);

                if (format === 'csv') {
                    if (data.rows.length === 0) {
                        return new NextResponse('No data', { status: 200, headers: { 'Content-Type': 'text/csv' } });
                    }
                    const headers = Object.keys(data.rows[0]);
                    const csvRows = [
                        headers.join(','),
                        ...data.rows.map((row: any) =>
                            headers.map(h => {
                                const val = row[h];
                                if (val === null) return '';
                                const str = String(val);
                                return str.includes(',') || str.includes('"') || str.includes('\n')
                                    ? `"${str.replace(/"/g, '""')}"` : str;
                            }).join(',')
                        )
                    ];
                    return new NextResponse(csvRows.join('\n'), {
                        headers: {
                            'Content-Type': 'text/csv',
                            'Content-Disposition': `attachment; filename="${tableName}.csv"`,
                        },
                    });
                }

                return NextResponse.json({ table: tableName, rows: data.rows, total: data.rows.length });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error('Database API error:', error);
        return NextResponse.json(
            { error: 'Lỗi máy chủ khi truy vấn database' },
            { status: 500 },
        );
    }
}

// POST: SQL query, migrations, CRUD — chỉ super_admin + Bearer (không dùng secret tĩnh trên client)
export async function POST(request: NextRequest) {
    try {
        const gate = await requireBearerSuperAdminMutation(request);
        if (!gate.ok) return gate.response;

        const body = await request.json();
        const { action } = body;

        switch (action) {
            // ─── Run SQL query ──────────────────────────────────
            case 'query': {
                const { sql } = body;
                if (!sql || typeof sql !== 'string') {
                    return NextResponse.json({ error: 'Missing SQL query' }, { status: 400 });
                }

                // Safety: block dangerous keywords for non-SELECT
                if (!isReadOnlySql(sql)) {
                    return NextResponse.json({ error: 'Only read-only SELECT/WITH/EXPLAIN queries are allowed' }, { status: 403 });
                }

                const startTime = Date.now();
                const result = await pool.query(sql);
                const duration = Date.now() - startTime;

                return NextResponse.json({
                    success: true,
                    rows: result.rows || [],
                    rowCount: result.rowCount,
                    fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
                    command: result.command,
                    duration,
                    isSelect: true,
                });
            }

            // ─── Run Migrations ─────────────────────────────────
            case 'migrate': {
                const result = await runMigrations(pool);
                return NextResponse.json(result);
            }

            // ─── Delete row ─────────────────────────────────────
            case 'deleteRow': {
                const { table, where } = body;
                if (!table || !where) {
                    return NextResponse.json({ error: 'Missing table or where clause' }, { status: 400 });
                }
                if (!(await validateTable(table))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }
                const validColumns = await getValidColumns(table);
                const whereKeys = Object.keys(where);
                const validWhere = validateColumnKeys(whereKeys, validColumns);
                if (!validWhere.ok) return validWhere.response;

                const conditions = whereKeys
                    .map((key, i) => `${quoteIdentifier(key)} = $${i + 1}`)
                    .join(' AND ');
                const values = Object.values(where);

                const result = await pool.query(
                    `DELETE FROM ${quoteIdentifier(table)} WHERE ${conditions}`,
                    values
                );

                return NextResponse.json({ success: true, deletedCount: result.rowCount });
            }

            // ─── Insert row ─────────────────────────────────────
            case 'insertRow': {
                const { table, data } = body;
                if (!table || !data) {
                    return NextResponse.json({ error: 'Missing table or data' }, { status: 400 });
                }
                if (!(await validateTable(table))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }
                const validColumns = await getValidColumns(table);

                const columns = Object.keys(data);
                const validData = validateColumnKeys(columns, validColumns);
                if (!validData.ok) return validData.response;
                const values = Object.values(data);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                const result = await pool.query(
                    `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders}) RETURNING *`,
                    values
                );

                return NextResponse.json({ success: true, row: result.rows[0] });
            }

            // ─── Update row ─────────────────────────────────────
            case 'updateRow': {
                const { table, data: updateData, where: updateWhere } = body;
                if (!table || !updateData || !updateWhere) {
                    return NextResponse.json({ error: 'Missing table, data, or where clause' }, { status: 400 });
                }
                if (!(await validateTable(table))) {
                    return NextResponse.json({ error: 'Table not found' }, { status: 404 });
                }
                const validColumns = await getValidColumns(table);
                const updateKeys = Object.keys(updateData);
                const whereKeys = Object.keys(updateWhere);
                const validUpdate = validateColumnKeys(updateKeys, validColumns);
                if (!validUpdate.ok) return validUpdate.response;
                const validWhere = validateColumnKeys(whereKeys, validColumns);
                if (!validWhere.ok) return validWhere.response;

                const setClauses = updateKeys
                    .map((key, i) => `${quoteIdentifier(key)} = $${i + 1}`)
                    .join(', ');
                const whereIdx = updateKeys.length;
                const whereClauses = whereKeys
                    .map((key, i) => `${quoteIdentifier(key)} = $${whereIdx + i + 1}`)
                    .join(' AND ');

                const allValues = [...Object.values(updateData), ...Object.values(updateWhere)];

                const result = await pool.query(
                    `UPDATE ${quoteIdentifier(table)} SET ${setClauses} WHERE ${whereClauses} RETURNING *`,
                    allValues
                );

                return NextResponse.json({ success: true, row: result.rows[0], updatedCount: result.rowCount });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: unknown) {
        console.error('Database API POST error:', error);
        return NextResponse.json(
            { error: 'Lỗi máy chủ khi thao tác database' },
            { status: 500 },
        );
    }
}
