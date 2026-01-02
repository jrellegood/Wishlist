import { useState, FormEvent } from 'react';

interface PasswordPromptProps {
  onSuccess: () => void;
}

// SHA-256 hash of the correct password
const CORRECT_PASSWORD_HASH = 'd4db6bfa5e70dcd78367248f62f46395b8b27a8b5e59e80286bb369cae1094f1';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function PasswordPrompt({ onSuccess }: PasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setIsChecking(true);
    const hash = await hashPassword(password);

    if (hash === CORRECT_PASSWORD_HASH) {
      setError('');
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
    setIsChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          🎁 Wishlist
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Enter the password to view gift ideas
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter password"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isChecking}
          >
            {isChecking ? 'Checking...' : 'Access Wishlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
