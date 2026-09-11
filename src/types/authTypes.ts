export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}
