import { useState, FormEvent, useRef, useEffect } from 'react';

interface AdminUnlockProps {
  unlockAdmin: (code: string) => Promise<boolean>;
  onCancel: () => void;
}

export function AdminUnlock({ unlockAdmin, onCancel }: AdminUnlockProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsChecking(true);
    setError('');

    const ok = await unlockAdmin(code);
    if (!ok) {
      setError('Incorrect code.');
      setCode('');
      setIsChecking(false);
      inputRef.current?.focus();
    }
    // on success, parent re-renders and unmounts this component
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
      <input
        ref={inputRef}
        type="password"
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Admin code"
        className="input text-sm py-1.5 w-36"
        disabled={isChecking}
      />
      <button type="submit" disabled={isChecking || !code} className="btn btn-primary text-sm py-1.5">
        {isChecking ? 'Checking…' : 'Unlock'}
      </button>
      <button type="button" onClick={onCancel} className="btn btn-secondary text-sm py-1.5">
        Cancel
      </button>
      {error && <span className="text-red-600 text-sm">{error}</span>}
    </form>
  );
}
