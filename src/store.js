// Lưu trạng thái hội thoại trong bộ nhớ.
// Đủ dùng cho shop nhỏ; khi bot khởi động lại thì khách chỉ mất ngữ cảnh cũ, không mất tin nhắn.
class MemoryStore {
  constructor({ historyTurns = 12, historyTtlHours = 24 } = {}) {
    this.users = new Map();
    this.historyTurns = historyTurns;
    this.ttlMs = historyTtlHours * 3600 * 1000;
    this.seen = new Map(); // chống xử lý trùng tin nhắn (Facebook có thể gửi lại)
  }

  get(psid) {
    let u = this.users.get(psid);
    const now = Date.now();
    if (u && now - u.lastActive > this.ttlMs) {
      u.history = [];
      u.step = null;
    }
    if (!u) {
      u = { history: [], step: null, pausedUntil: 0, aiCalls: [], lastActive: now };
      this.users.set(psid, u);
    }
    u.lastActive = now;
    return u;
  }

  addHistory(psid, role, text) {
    const u = this.get(psid);
    u.history.push({ role, content: text });
    if (u.history.length > this.historyTurns) u.history = u.history.slice(-this.historyTurns);
  }

  pause(psid, hours) {
    this.get(psid).pausedUntil = Date.now() + hours * 3600 * 1000;
  }

  resume(psid) {
    const u = this.get(psid);
    u.pausedUntil = 0;
  }

  isPaused(psid) {
    const u = this.users.get(psid);
    return !!u && u.pausedUntil > Date.now();
  }

  // true nếu còn trong hạn mức gọi AI trong 1 giờ
  allowAi(psid, limit) {
    const u = this.get(psid);
    const hourAgo = Date.now() - 3600 * 1000;
    u.aiCalls = u.aiCalls.filter((t) => t > hourAgo);
    if (u.aiCalls.length >= limit) return false;
    u.aiCalls.push(Date.now());
    return true;
  }

  markSeen(mid) {
    if (!mid) return false;
    if (this.seen.has(mid)) return true;
    this.seen.set(mid, Date.now());
    if (this.seen.size > 5000) {
      const first = this.seen.keys().next().value;
      this.seen.delete(first);
    }
    return false;
  }
}

module.exports = { MemoryStore };
