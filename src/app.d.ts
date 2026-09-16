import type { Session, User } from "better-auth";

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      role: string | null;
      profile: any | null;
      userScans: any[];
      unread: number;
    }
    // interface Error {}
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
