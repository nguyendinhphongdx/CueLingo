/** The sign-in email, in Vietnamese: plain text for every client plus a small HTML version. */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** How long the link stays valid; keep in step with `expiresIn` of the magic link plugin. */
export const MAGIC_LINK_MINUTES = 5;

export function magicLinkEmail(url: string): EmailContent {
  const safeUrl = escapeHtml(url);
  return {
    subject: 'Đăng nhập CueLingo',
    text: [
      'Xin chào,',
      '',
      `Bấm vào liên kết dưới đây để đăng nhập CueLingo. Liên kết dùng được một lần và hết hạn sau ${MAGIC_LINK_MINUTES} phút.`,
      '',
      url,
      '',
      'Nếu không phải bạn yêu cầu, hãy bỏ qua email này, sẽ không có gì xảy ra với tài khoản của bạn.',
      '',
      'CueLingo',
    ].join('\n'),
    html: `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#16161d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:20px;font-weight:600;">Đăng nhập CueLingo</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#52525f;">Bấm nút dưới đây để đăng nhập. Liên kết dùng được một lần và hết hạn sau ${MAGIC_LINK_MINUTES} phút.</p>
          <p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Đăng nhập</a></p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52525f;">Nút không bấm được? Dán liên kết này vào trình duyệt:</p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:#4f46e5;">${safeUrl}</a></p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#52525f;">Nếu không phải bạn yêu cầu, hãy bỏ qua email này, sẽ không có gì xảy ra với tài khoản của bạn.</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`,
  };
}
