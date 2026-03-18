import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { runMission } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { MissionInfo } from '@/api/types';

interface RunMissionDialogProps {
  instanceId: string;
  mission: MissionInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunMissionDialog({ instanceId, mission, open, onOpenChange }: RunMissionDialogProps) {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runMission(instanceId, mission.name, inputs);
      onOpenChange(false);
      navigate(`/instances/${instanceId}/runs/${result.missionId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const hasInputs = mission.inputs && mission.inputs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run: {mission.name}</DialogTitle>
          {mission.description && (
            <DialogDescription>{mission.description}</DialogDescription>
          )}
        </DialogHeader>

        {hasInputs ? (
          <div className="space-y-3 py-2">
            {mission.inputs!.map((inp) => (
              <div key={inp.name}>
                <label className="block text-sm font-medium mb-1">
                  {inp.name}
                  {inp.required && <span className="text-destructive ml-1">*</span>}
                </label>
                {inp.description && (
                  <p className="text-xs text-muted-foreground mb-1">{inp.description}</p>
                )}
                <Input
                  value={inputs[inp.name] || ''}
                  onChange={(e) => setInputs(prev => ({ ...prev, [inp.name]: e.target.value }))}
                  placeholder={inp.type || 'string'}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">This mission has no inputs.</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button onClick={handleRun} disabled={running}>
            {running ? 'Starting...' : 'Run Mission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
