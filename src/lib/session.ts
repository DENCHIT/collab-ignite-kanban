const TEAM_PASSCODE_KEY = "kanban_team_passcode";
const ADMIN_PASSCODE_KEY = "kanban_admin_passcode";
const DISPLAY_NAME_KEY = "kanban_display_name";
const USER_TOKEN_KEY = "kanban_user_token";
const ADMIN_FLAG_KEY = "kanban_is_admin";
const IDEAS_KEY = "kanban_ideas";
const THRESHOLDS_KEY = "kanban_thresholds";

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

export function getTeamPasscode(): string | null {
  return storage.getRaw(TEAM_PASSCODE_KEY);
}
export function setTeamPasscode(code: string) {
  storage.setRaw(TEAM_PASSCODE_KEY, code);
}

export function getAdminPasscode(): string | null {
  return storage.getRaw(ADMIN_PASSCODE_KEY);
}
export function setAdminPasscode(code: string) {
  storage.setRaw(ADMIN_PASSCODE_KEY, code);
}

export function getDisplayName(): string | null {
  return storage.getRaw(DISPLAY_NAME_KEY);
}
export function setDisplayName(name: string) {
  storage.setRaw(DISPLAY_NAME_KEY, name);
}

export function getUserToken(): string {
  let token = storage.getRaw(USER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    storage.setRaw(USER_TOKEN_KEY, token);
  }
  return token;
}

export function setIsAdmin(flag: boolean) {
  storage.setRaw(ADMIN_FLAG_KEY, flag ? "true" : "false");
}
export function isAdmin(): boolean {
  return storage.getRaw(ADMIN_FLAG_KEY) === "true";
}

export function saveIdeas(data: unknown) {
  storage.set(IDEAS_KEY, data);
}
export function loadIdeas<T>(fallback: T): T {
  return storage.get(IDEAS_KEY, fallback);
}

export function saveThresholds(data: unknown) {
  storage.set(THRESHOLDS_KEY, data);
}
export function loadThresholds<T>(fallback: T): T {
  return storage.get(THRESHOLDS_KEY, fallback);
}
