// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Project Nox Contributors & Awerkori

export type AuthState = 'ANONYMOUS' | 'AUTH_PENDING' | 'AUTHENTICATED' | 'AUTH_ERROR';

export interface AppUser {
  id: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

declare global {
  namespace App {
    interface Locals {
      user: AppUser | null;
      role: string | null;
      authState: AuthState;
      authError?: string;
      sessionCache?: any;
      profile?: any;
    }
  }
}
export {};
