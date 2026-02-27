import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getInstance } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function MissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: instance, isLoading } = useQuery({
    queryKey: ['instance', id],
    queryFn: () => getInstance(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!instance) return <div className="p-8 text-muted-foreground">Instance not found</div>;

  const { config } = instance;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Missions</h1>

      {(!config.missions || config.missions.length === 0) ? (
        <p className="text-muted-foreground">No missions configured.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Inputs</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.missions.map((m) => (
                <TableRow
                  key={m.name}
                  className="cursor-pointer"
                  onClick={() => navigate(`/instances/${id}/missions/${m.name}`)}
                >
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    {m.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.tasks?.length ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{m.inputs?.length ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      asChild
                      size="sm"
                      variant={instance.connected ? 'default' : 'secondary'}
                      disabled={!instance.connected}
                    >
                      <Link
                        to={`/instances/${id}/missions/${m.name}/run`}
                        className={!instance.connected ? 'pointer-events-none' : ''}
                      >
                        Run
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
