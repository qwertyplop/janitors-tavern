import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function TestFirebase() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/test-storage');
  }, [setLocation]);

  return (
    <div className="p-6 text-center text-muted-foreground">
      <p>Redirecting to Storage Diagnostics...</p>
    </div>
  );
}
