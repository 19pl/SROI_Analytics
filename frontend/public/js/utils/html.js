const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** แปลงข้อความจากผู้ใช้ให้ปลอดภัยก่อนใส่ใน template HTML (ทั้งในเนื้อหาและใน attribute) */
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
