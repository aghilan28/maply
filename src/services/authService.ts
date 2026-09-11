import { AuthUser, LoginCredentials, RegisterCredentials } from '../types/authTypes';

const USERS_STORAGE_KEY = 'maply_registered_users';
const SESSION_STORAGE_KEY = 'maply_active_session';

const DEFAULT_USERS: (AuthUser & { passwordHash: string })[] = [
  {
    id: 'user-default-1',
    username: 'aghilan',
    email: 'aghilan@maply.com',
    name: 'AGHILAN M',
    passwordHash: 'password123',
    createdAt: new Date().toISOString(),
  },
];

class AuthService {
  private getUsers(): (AuthUser & { passwordHash: string })[] {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      return JSON.parse(stored);
    } catch {
      return DEFAULT_USERS;
    }
  }

  private saveUsers(users: (AuthUser & { passwordHash: string })[]) {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users to localStorage', e);
    }
  }

  public register(credentials: RegisterCredentials): { success: boolean; user?: AuthUser; error?: string } {
    const { name, email, password } = credentials;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const username = trimmedEmail.split('@')[0] || trimmedName.toLowerCase().replace(/\s+/g, '');

    if (!trimmedEmail || !password || !trimmedName) {
      return { success: false, error: 'Please enter your Name, Email, and Password.' };
    }

    const users = this.getUsers();

    const existingUser = users.find(
      (u) => u.email.toLowerCase() === trimmedEmail
    );

    if (existingUser) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const newUser: AuthUser & { passwordHash: string } = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      username,
      email: trimmedEmail,
      name: trimmedName,
      passwordHash: password,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    const { passwordHash, ...userSession } = newUser;
    this.setSession(userSession);

    return { success: true, user: userSession };
  }

  public login(credentials: LoginCredentials): { success: boolean; user?: AuthUser; error?: string } {
    const { usernameOrEmail, password } = credentials;
    const query = usernameOrEmail.trim().toLowerCase();

    if (!query || !password) {
      return { success: false, error: 'Please enter your Email/Username and Password.' };
    }

    const users = this.getUsers();

    const matchedUser = users.find(
      (u) => u.email.toLowerCase() === query || u.username.toLowerCase() === query || u.name.toLowerCase() === query
    );

    if (!matchedUser) {
      return { success: false, error: 'Invalid Email/Username or Password.' };
    }

    if (matchedUser.passwordHash !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const { passwordHash, ...userSession } = matchedUser;
    this.setSession(userSession);

    return { success: true, user: userSession };
  }

  public getSession(): AuthUser | null {
    try {
      const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionStr) return null;
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  }

  public setSession(user: AuthUser) {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to set session', e);
    }
  }

  public logout() {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session', e);
    }
  }
}

export const authService = new AuthService();
