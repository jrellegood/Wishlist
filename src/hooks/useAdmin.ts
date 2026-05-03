import { useState, useCallback } from 'react';

const STORAGE_KEY = 'wishlist_admin_code';

export function useAdmin() {
  const [adminCode, setAdminCode] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  const isAdmin = adminCode !== null;

  const unlockAdmin = useCallback(async (code: string): Promise<boolean> => {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${code}` },
    });
    if (response.ok) {
      localStorage.setItem(STORAGE_KEY, code);
      setAdminCode(code);
      return true;
    }
    return false;
  }, []);

  const lockAdmin = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAdminCode(null);
  }, []);

  return { isAdmin, adminCode, unlockAdmin, lockAdmin };
}
