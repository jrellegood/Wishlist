import { useState, useEffect } from 'react';
import { PasswordPrompt } from './components/PasswordPrompt';
import { GiftList } from './components/GiftList';

const AUTH_KEY = 'wishlist_authenticated';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user was previously authenticated
    const authStatus = localStorage.getItem(AUTH_KEY);
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthSuccess = () => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <PasswordPrompt onSuccess={handleAuthSuccess} />;
  }

  return <GiftList />;
}

export default App;
