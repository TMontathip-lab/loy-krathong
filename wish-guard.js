'use strict';
// Lightweight visitor-side guidance. The separate Firestore Rules enforce core
// checks on the server; neither layer is a complete content moderation service.
(() => {
  const COOLDOWN_MS = 60 * 1000;
  const STORAGE_KEY = 'loyKrathong:lastSuccessfulRelease:v1';
  const BLOCKED_PHRASES = [
    'เหี้ย', 'ควย', 'เย็ด', 'สัส', 'แม่ง', 'ไอ้สัด', 'ไอ้เวร', 'อีดอก', 'fuck', 'shit', 'bitch'
  ];
  const PRIVATE_PATTERN = /https?:\/\/|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:0[689](?:[\s-]?\d){8})|(?:\+66(?:[\s-]?\d){9})|บ้านเลขที่\s*\d+/i;
  const normalize = value => String(value || '').normalize('NFKC').trim();
  const fold = value => normalize(value).toLowerCase().replace(/[\u200b-\u200d\ufeff\s._*\-]+/g, '');
  const seconds = ms => Math.max(1, Math.ceil(ms / 1000));
  let lastRelease = 0;
  try { lastRelease = Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (_) {}

  function check(nameInput, wishInput) {
    const name = normalize(nameInput), wish = normalize(wishInput);
    if (!name || name.length > 28) {
      return { ok: false, field: 'nickname', message: 'กรุณาใช้ชื่อเล่นหรือนามแฝง ความยาวไม่เกิน 28 ตัวอักษร' };
    }
    if (!wish || wish.length > 160) {
      return { ok: false, field: 'wishText', message: 'กรุณาเขียนคำอธิษฐานไม่เกิน 160 ตัวอักษร' };
    }
    if (PRIVATE_PATTERN.test(name + ' ' + wish)) {
      return { ok: false, field: 'wishText', message: 'กรุณาลบลิงก์ อีเมล เบอร์โทรศัพท์ หรือบ้านเลขที่ออก และใช้ชื่อเล่นเท่านั้น' };
    }
    if (BLOCKED_PHRASES.some(word => fold(name).includes(word) || fold(wish).includes(word))) {
      return { ok: false, field: 'wishText', message: 'พบถ้อยคำที่ไม่เหมาะสม กรุณาปรับเป็นคำอธิษฐานที่สุภาพ' };
    }
    return { ok: true, name, wish };
  }

  function remainingMs() {
    return Math.max(0, COOLDOWN_MS - (Date.now() - lastRelease));
  }

  function recordSuccess() {
    lastRelease = Date.now();
    try { localStorage.setItem(STORAGE_KEY, String(lastRelease)); } catch (_) {}
  }

  window.krathongGuard = { check, remainingMs, recordSuccess, seconds, COOLDOWN_MS };
})();
