const DISPLAY_NAME_KEY = "kanban_display_name";
const USER_TOKEN_KEY = "kanban_user_token";
const IDEAS_KEY = "kanban_ideas";
const THRESHOLDS_KEY = "kanban_thresholds";

function scopedKey(base: string, slug?: string) {
  return slug ? `${base}:${slug}` : base;
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const val = localStorage.getItem(key);
      return val ? (JSON.parse(val) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  getRaw(key: string) {
    return localStorage.getItem(key);
  },
  setRaw(key: string, value: string) {
    localStorage.setItem(key, value);
  },
};


export function getDisplayName(): string | null {
  return storage.getRaw(DISPLAY_NAME_KEY);
}
export function setDisplayName(name: string) {
  storage.setRaw(DISPLAY_NAME_KEY, name);
}

export function getUserEmail(): string | null {
  return storage.getRaw("kanban_user_email");
}
export function setUserEmail(email: string) {
  storage.setRaw("kanban_user_email", email);
}

export function getUserToken(): string {
  let token = storage.getRaw(USER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    storage.setRaw(USER_TOKEN_KEY, token);
  }
  return token;
}


export function saveIdeas(data: unknown, boardSlug?: string) {
  storage.set(scopedKey(IDEAS_KEY, boardSlug), data);
}
export function loadIdeas<T>(fallback: T, boardSlug?: string): T {
  return storage.get(scopedKey(IDEAS_KEY, boardSlug), fallback);
}

export function saveThresholds(data: unknown, boardSlug?: string) {
  storage.set(scopedKey(THRESHOLDS_KEY, boardSlug), data);
}
export function loadThresholds<T>(fallback: T, boardSlug?: string): T {
  return storage.get(scopedKey(THRESHOLDS_KEY, boardSlug), fallback);
}
