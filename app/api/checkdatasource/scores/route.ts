import { withApiProtection } from "@/lib/api-protection";
import {
  rejectIfDatasourceLookupForbidden,
  requireDatasourceBearer,
} from "@/lib/datasource-api-auth";
import pool from "@/lib/db";
import {
  findTeacherRowByEmailOrCode,
  loadTeacherScoresOnly,
} from "@/lib/teacher-profile-bundle";
import { NextRequest, NextResponse } from "next/server";

/** Chỉ tải chuyên sâu + trải nghiệm (tách khỏi bundle profile nhanh). */
export const GET = withApiProtection(async (request: NextRequest) => {
  try {
    const auth = await requireDatasourceBearer(request);
    if (!auth.ok) return auth.response;

    const { sessionEmail, privileged } = auth;

    const code = String(request.nextUrl.searchParams.get("code") || "").trim();
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Thiếu mã giáo viên (code)" },
        { status: 400 },
      );
    }

    const deniedLookup = await rejectIfDatasourceLookupForbidden(
      sessionEmail,
      privileged,
      "",
      code,
    );
    if (deniedLookup) return deniedLookup;

    const userNameParam = String(
      request.nextUrl.searchParams.get("userName") || "",
    ).trim();

    let alternateCodes: string[] = [];
    if (privileged && userNameParam) {
      alternateCodes = [userNameParam];
    } else if (!privileged) {
      const row = await findTeacherRowByEmailOrCode(pool, { code });
      if (row) {
        const un = String(
          (row as Record<string, unknown>).user_name ??
            (row as Record<string, unknown>)["User name"] ??
            "",
        ).trim();
        if (un) alternateCodes = [un];
        // Thêm email prefix (phần trước @) để match với dia_chi_email trong chuyen_sau_results
        const workEmail = String(
          (row as Record<string, unknown>).work_email ??
            (row as Record<string, unknown>)["Work email"] ??
            "",
        ).trim();
        const emailPrefix = workEmail.split("@")[0]?.trim().toLowerCase();
        if (emailPrefix && !alternateCodes.includes(emailPrefix)) {
          alternateCodes.push(emailPrefix);
        }
      }
      // Nếu sessionEmail có sẵn, thêm email prefix của session làm fallback
      if (sessionEmail) {
        const sessionPrefix = sessionEmail.split("@")[0]?.trim().toLowerCase();
        if (sessionPrefix && !alternateCodes.includes(sessionPrefix)) {
          alternateCodes.push(sessionPrefix);
        }
      }
    } else {
      // privileged + userNameParam
      // Vẫn thêm email prefix từ userNameParam nếu có dạng email
      if (userNameParam.includes("@")) {
        const prefix = userNameParam.split("@")[0]?.trim().toLowerCase();
        if (prefix) alternateCodes = [userNameParam, prefix];
      } else {
        alternateCodes = [userNameParam];
      }
    }

    const { expertise, experience } = await loadTeacherScoresOnly(pool, code, {
      alternateCodes,
    });
    
    console.log('📊 API Scores Response for code:', code);
    console.log('📊 Alternate codes:', alternateCodes);
    console.log('📊 Expertise data:', expertise);
    console.log('📊 Experience data:', experience);
    
    return NextResponse.json({ success: true, expertise, experience });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể tải điểm";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
