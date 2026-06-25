import { renderTemplate } from '@/app/api/emails/render';
import { sendMail, type MailSendResult } from '@/app/api/emails/transporter';
import { recordEmailDelivery } from '@/lib/email-delivery-log';

const LEAVE_EMAIL_SOURCE = 'app/api/leave-requests';

export type LeaveApprovedSubstituteConfirmedData = {
  teacher_name: string;
  teacher_email: string;
  campus?: string;
  campus_bu_email?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  substitute_teacher?: string;
  substitute_email?: string;
  reason?: string;
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
  substitute_confirmed_at?: string;
};

export type LeaveAdminRejectedData = {
  request_id: string;
  teacher_name: string;
  teacher_email?: string;
  campus?: string;
  campus_bu_email?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  reason?: string;
  admin_note?: string;
  admin_name?: string;
  admin_email?: string;
};

export type LeaveEmailSendResult = {
  ok: boolean;
  sent: boolean;
  warning?: string;
  error?: string;
  recipients?: { to: string[]; cc?: string[] };
  messageId?: string;
  senderEmail?: string;
  durationMs?: number;
};

export type LeaveRequestSubmittedData = {
  request_id: string;
  teacher_name: string;
  teacher_email: string;
  campus?: string;
  campus_bu_email?: string;
  email_subject?: string;
  class_code?: string;
  leave_date?: string;
  class_time?: string;
  leave_session?: string;
  student_count?: string;
  reason?: string;
  class_status?: string;
  substitute_teacher?: string;
  substitute_email?: string;
};

function createLeaveEmailError(code: string, message: string): Error & {
  code: string;
} {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

async function recordSubmittedEmailSkipped(
  data: LeaveRequestSubmittedData,
  subject: string,
  code: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const buEmail = String(data.campus_bu_email ?? '').trim();
  await recordEmailDelivery({
    status: 'skipped',
    toRecipients: buEmail ? [buEmail] : [],
    ccRecipients: uniqueRecipientEmails(
      data.teacher_email,
      data.substitute_email,
    ),
    subject,
    emailType: 'leave_request_submitted',
    source: LEAVE_EMAIL_SOURCE,
    durationMs: 0,
    error: createLeaveEmailError(code, message),
    metadata: {
      requestId: data.request_id,
      campus: data.campus,
      campusBuEmail: buEmail || null,
      ...metadata,
    },
  });
}

function buildLeaveSubmittedClosingMessage(data: LeaveRequestSubmittedData): string {
  if (data.substitute_teacher?.trim()) {
    return 'Trên đây là thông tin lớp xin nghỉ. Mong phía chuyên môn cơ sở xem xét và xác nhận. Xin cảm ơn!';
  }
  return 'Trên đây là thông tin lớp xin nghỉ. Vì chưa có giáo viên thay, nhờ phía chuyên môn hỗ trợ tìm giáo viên dạy thay cho buổi học trên. Xin cảm ơn!';
}

function formatDateTime(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString('vi-VN');
}

function formatDate(input?: string) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('vi-VN');
}

function uniqueRecipientEmails(
  ...raw: Array<string | undefined | null>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = String(r ?? '').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function ccExcludingTo(
  ccCandidates: Array<string | undefined | null>,
  toList: string[],
): string[] {
  const toSet = new Set(toList.map((e) => e.trim().toLowerCase()).filter(Boolean));
  return uniqueRecipientEmails(...ccCandidates).filter(
    (e) => !toSet.has(e.toLowerCase()),
  );
}

/** CC luôn gồm BU/CS cơ sở (trừ khi đã nằm trong To). */
function buildLeaveMailRecipients(
  toCandidates: Array<string | undefined | null>,
  ccCandidates: Array<string | undefined | null>,
  campusBuEmail?: string,
): { to: string[]; cc: string[] } {
  const to = uniqueRecipientEmails(...toCandidates);
  const cc = ccExcludingTo([...ccCandidates, campusBuEmail], to);
  return { to, cc };
}

function toLeaveEmailResult(
  sendResult: MailSendResult,
  recipients: { to: string[]; cc?: string[] },
): LeaveEmailSendResult {
  return {
    ok: true,
    sent: sendResult.sent,
    warning: sendResult.warning,
    recipients,
    messageId: sendResult.messageId,
    senderEmail: sendResult.senderEmail,
    durationMs: sendResult.durationMs,
  };
}

function logLeaveEmailOutcome(
  action: string,
  result: LeaveEmailSendResult,
  context: Record<string, unknown>,
) {
  const payload = { action, ...context, ...result };
  if (result.sent) {
    console.info('[leave-request-emails] sent', payload);
    return;
  }
  if (result.error) {
    console.error('[leave-request-emails] failed', payload);
    return;
  }
  console.warn('[leave-request-emails] not sent', payload);
}

export async function sendLeaveAdminRejectedEmail(
  data: LeaveAdminRejectedData,
  metadata?: Record<string, unknown>,
): Promise<LeaveEmailSendResult> {
  const teacherTo = String(data.teacher_email ?? '').trim();
  if (!data.teacher_name || !data.request_id || !teacherTo) {
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error:
        'Missing required fields: teacher_name, request_id, teacher_email',
    };
    logLeaveEmailOutcome('leave_admin_rejected', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  }

  const html = renderTemplate('leave-admin-rejected', {
    request_id: data.request_id,
    teacher_name: data.teacher_name,
    campus: data.campus || '—',
    class_code: data.class_code || '—',
    leave_date: formatDate(data.leave_date) || '—',
    class_time: data.class_time || '—',
    leave_session: data.leave_session || '—',
    reason: data.reason?.trim() || '—',
    admin_note: data.admin_note?.trim() || '',
    admin_name: data.admin_name || '—',
    admin_email: data.admin_email || '—',
  });

  const { to, cc } = buildLeaveMailRecipients(
    [teacherTo],
    [data.admin_email],
    data.campus_bu_email,
  );
  const recipients = { to, ...(cc.length > 0 ? { cc } : {}) };

  try {
    const sendResult = await sendMail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `[MindX | Xin nghỉ 1 buổi] Yêu cầu không được duyệt — ${data.teacher_name}`,
      html,
      emailType: 'leave_admin_rejected',
      source: LEAVE_EMAIL_SOURCE,
      metadata: {
        requestId: data.request_id,
        classCode: data.class_code,
        leaveDate: data.leave_date,
        campusBuEmail: data.campus_bu_email,
        ...metadata,
      },
    });
    const result = toLeaveEmailResult(sendResult, recipients);
    logLeaveEmailOutcome('leave_admin_rejected', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error: message,
      recipients,
    };
    logLeaveEmailOutcome('leave_admin_rejected', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  }
}

export async function sendLeaveSubstituteConfirmedEmail(
  data: LeaveApprovedSubstituteConfirmedData,
  metadata?: Record<string, unknown>,
): Promise<LeaveEmailSendResult> {
  if (!data.teacher_name || !data.teacher_email || !data.substitute_email) {
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error:
        'Missing required fields: teacher_name, teacher_email, substitute_email',
    };
    logLeaveEmailOutcome('leave_approved_substitute_confirmed', result, metadata ?? {});
    return result;
  }

  const html = renderTemplate('leave-approved-substitute-confirmed', {
    teacher_name: data.teacher_name,
    teacher_email: data.teacher_email,
    campus: data.campus,
    class_code: data.class_code,
    leave_date: formatDate(data.leave_date),
    class_time: data.class_time,
    leave_session: data.leave_session,
    substitute_teacher: data.substitute_teacher,
    substitute_email: data.substitute_email,
    reason: data.reason,
    admin_note: data.admin_note,
    admin_name: data.admin_name,
    admin_email: data.admin_email,
    substitute_confirmed_at: formatDateTime(data.substitute_confirmed_at),
  });

  const { to, cc } = buildLeaveMailRecipients(
    [data.admin_email, data.substitute_email],
    [data.teacher_email],
    data.campus_bu_email,
  );
  if (to.length === 0) {
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error:
        'Không có địa chỉ nhận: cần email TC/duyệt hoặc email GV thay.',
    };
    logLeaveEmailOutcome('leave_approved_substitute_confirmed', result, metadata ?? {});
    return result;
  }

  const recipients = { to, ...(cc.length > 0 ? { cc } : {}) };

  try {
    const sendResult = await sendMail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `[MindX | THÔNG BÁO XIN NGHỈ 1 BUỔI] Đã duyệt & GV thay đã xác nhận — ${data.teacher_name}`,
      html,
      emailType: 'leave_approved_substitute_confirmed',
      source: LEAVE_EMAIL_SOURCE,
      metadata: {
        classCode: data.class_code,
        leaveDate: data.leave_date,
        substituteEmail: data.substitute_email,
        campusBuEmail: data.campus_bu_email,
        ...metadata,
      },
    });
    const result = toLeaveEmailResult(sendResult, recipients);
    logLeaveEmailOutcome('leave_approved_substitute_confirmed', result, metadata ?? {});
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error: message,
      recipients,
    };
    logLeaveEmailOutcome('leave_approved_substitute_confirmed', result, metadata ?? {});
    return result;
  }
}

export async function sendLeaveRequestSubmittedEmail(
  data: LeaveRequestSubmittedData,
  metadata?: Record<string, unknown>,
): Promise<LeaveEmailSendResult> {
  const buTo = String(data.campus_bu_email ?? '').trim();
  const teacherEmail = String(data.teacher_email ?? '').trim();
  const subject =
    String(data.email_subject ?? '').trim() ||
    `[MindX - ${data.campus || 'Cơ sở'}] V/v xin nghỉ 1 buổi dạy`;

  if (!data.teacher_name || !data.request_id || !teacherEmail) {
    const errorMessage =
      'Missing required fields: teacher_name, request_id, teacher_email';
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error: errorMessage,
    };
    await recordSubmittedEmailSkipped(
      data,
      subject,
      'MISSING_REQUIRED_FIELDS',
      errorMessage,
      metadata,
    );
    logLeaveEmailOutcome('leave_request_submitted', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  }

  if (!buTo) {
    const errorMessage = 'Không có email BU/CS cơ sở để gửi mail xin nghỉ.';
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      warning: 'MISSING_CAMPUS_BU_EMAIL',
      error: errorMessage,
    };
    await recordSubmittedEmailSkipped(
      data,
      subject,
      'MISSING_CAMPUS_BU_EMAIL',
      errorMessage,
      metadata,
    );
    logLeaveEmailOutcome('leave_request_submitted', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  }

  const html = renderTemplate('leave-request-submitted', {
    request_id: data.request_id,
    teacher_name: data.teacher_name,
    teacher_email: data.teacher_email,
    campus: data.campus || '—',
    class_code: data.class_code || '—',
    leave_date: formatDate(data.leave_date) || '—',
    class_time: data.class_time || '—',
    leave_session: data.leave_session || '—',
    student_count: data.student_count || '—',
    reason: data.reason?.trim() || '—',
    class_status: data.class_status?.trim() || '—',
    substitute_teacher: data.substitute_teacher?.trim() || '',
    substitute_email: data.substitute_email?.trim() || '',
    closing_message: buildLeaveSubmittedClosingMessage(data),
  });

  const { to, cc } = buildLeaveMailRecipients(
    [buTo],
    [teacherEmail, data.substitute_email],
    buTo,
  );
  const recipients = { to, ...(cc.length > 0 ? { cc } : {}) };

  try {
    const sendResult = await sendMail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      html,
      emailType: 'leave_request_submitted',
      source: LEAVE_EMAIL_SOURCE,
      metadata: {
        requestId: data.request_id,
        campus: data.campus,
        campusBuEmail: buTo,
        ...metadata,
      },
    });
    const result = toLeaveEmailResult(sendResult, recipients);
    logLeaveEmailOutcome('leave_request_submitted', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: LeaveEmailSendResult = {
      ok: false,
      sent: false,
      error: message,
      recipients,
    };
    logLeaveEmailOutcome('leave_request_submitted', result, {
      requestId: data.request_id,
      ...metadata,
    });
    return result;
  }
}
