import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listInstances } from '@/api/client';

export function RootRedirect() {
  const navigate = useNavigate();
  const { data: instances, isLoading } = useQuery({
    queryKey: ['instances'],
    queryFn: listInstances,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!instances) return;
    const connected = instances.find((i) => i.connected);
    if (connected) {
      navigate(`/instances/${connected.id}/missions`, { replace: true });
    }
  }, [instances, navigate]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;
  }

  const hasConnected = instances?.some((i) => i.connected);
  if (hasConnected) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Redirecting...</div>;
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Squadron Commander</h1>
        <p className="text-muted-foreground">
          No instances connected. Start a squadron instance with{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">squadron serve</code>.
        </p>
      </div>
    </div>
  );
}
