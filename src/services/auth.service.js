import { CONFIG } from '../config/app.config.js';

const AUTH_KEY = `${CONFIG.STORAGE_KEY}_auth`;
const SESSION_KEY = `${CONFIG.STORAGE_KEY}_session`;

const ROLE_PERMISSIONS = {
  admin: ['*'],
  editor: [
    'patient.write',
    'clinical.write',
    'operations.write',
    'stock.write',
    'report.run',
    'data.export',
    'data.import',
  ],
  viewer: [
    'report.run',
    'data.export',
  ],
};

const ROLE_LABELS = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: [] };
  } catch {
    return { users: [] };
  }
}

function saveAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AuthService = {
  async init() {
    const auth = loadAuth();
    if (!auth.users.length) {
      auth.users.push({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        passwordHash: await sha256('admin123'),
        createdAt: new Date().toISOString(),
      });
      saveAuth(auth);
    }
  },

  getRoles() {
    return Object.keys(ROLE_PERMISSIONS);
  },

  getRoleLabel(role) {
    return ROLE_LABELS[role] || role;
  },

  getUsers() {
    return loadAuth().users.map(({ passwordHash, ...user }) => user);
  },

  currentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      return loadAuth().users.find(u => u.id === session.userId) || null;
    } catch {
      return null;
    }
  },

  hasPermission(permission) {
    const user = this.currentUser();
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  },

  async login(username, password) {
    const user = loadAuth().users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) return null;
    const passwordHash = await sha256(password);
    if (passwordHash !== user.passwordHash) return null;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: user.id,
      loginAt: new Date().toISOString(),
    }));
    return user;
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  async createUser({ username, password, role }) {
    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (!ROLE_PERMISSIONS[role]) {
      throw new Error('Invalid role');
    }

    const auth = loadAuth();
    if (auth.users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('Username already exists');
    }

    const user = {
      id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      username: cleanUsername,
      role,
      passwordHash: await sha256(password),
      createdAt: new Date().toISOString(),
    };
    auth.users.push(user);
    saveAuth(auth);
    return user;
  },

  async updateUser(id, { username, password, role }) {
    const auth = loadAuth();
    const user = auth.users.find(u => u.id === id);
    if (!user) throw new Error('ไม่พบผู้ใช้');

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (!ROLE_PERMISSIONS[role]) {
      throw new Error('Invalid role');
    }
    if (auth.users.some(u => u.id !== id && u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error('Username already exists');
    }
    if (user.role === 'admin' && role !== 'admin' && auth.users.filter(u => u.role === 'admin').length <= 1) {
      throw new Error('ต้องมี Admin อย่างน้อย 1 คน');
    }

    user.username = cleanUsername;
    user.role = role;
    if (password) {
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      user.passwordHash = await sha256(password);
    }
    saveAuth(auth);
    return user;
  },

  deleteUser(id) {
    const auth = loadAuth();
    const user = auth.users.find(u => u.id === id);
    if (!user) throw new Error('ไม่พบผู้ใช้');
    if (this.currentUser()?.id === id) {
      throw new Error('ไม่สามารถลบผู้ใช้ที่กำลังเข้าสู่ระบบ');
    }
    if (user.role === 'admin' && auth.users.filter(u => u.role === 'admin').length <= 1) {
      throw new Error('ต้องมี Admin อย่างน้อย 1 คน');
    }
    auth.users = auth.users.filter(u => u.id !== id);
    saveAuth(auth);
  },
};
