"use client";

import { useAuth } from "./AuthProvider";

export function NavAuthControls() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <button type="button" className="nav-logout" onClick={() => signOut()}>
      🚪 Wyloguj ({user.email})
    </button>
  );
}
