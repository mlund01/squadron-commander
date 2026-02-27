import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getInstance, runMission } from '@/api/client';
import { subscribeMissionEvents } from '@/api/sse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { MissionEvent, MissionInfo } from '@/api/types';

type RunState = 'idle' | 'running' | 'completed' | 'failed';

export function MissionRun() {
  const { id, name } = useParams<{ id: string; name: string }>();
  const { data: instance } = useQuery({
    queryKey: ['instance', id],
    queryFn: () => getInstance(id!),
    enabled: !!id,
  });

  const mission = instance?.config.missions?.find((m: MissionInfo) => m.name === name);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [runState, setRunState] = useState<RunState>('idle');
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  const eventLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  const updateTaskStatus = useCallback((event: MissionEvent) => {
    const data = event.data as Record<string, string>;
    const taskName = data?.taskName;
    if (!taskName) return;

    switch (event.eventType) {
      case 'task_started':
        setTaskStatuses(prev => ({ ...prev, [taskName]: 'running' }));
        break;
      case 'task_completed':
        setTaskStatuses(prev => ({ ...prev, [taskName]: 'completed' }));
        break;
      case 'task_failed':
        setTaskStatuses(prev => ({ ...prev, [taskName]: 'failed' }));
        break;
    }
  }, []);

  const handleRun = async () => {
    if (!id || !name) return;

    setRunState('running');
    setEvents([]);
    setError(null);
    setTaskStatuses({});

    try {
      const result = await runMission(id, name, inputs);
      const missionId = result.missionId;

      if (!missionId) {
        setError('No mission ID returned');
        setRunState('failed');
        return;
      }

      subscribeMissionEvents(
        id,
        missionId,
        (event) => {
          setEvents(prev => [...prev, event]);
          updateTaskStatus(event);
        },
        () => {
          setRunState(prev => prev === 'running' ? 'completed' : prev);
        },
        (err) => {
          setError(err);
          setRunState('failed');
        },
      );
    } catch (err) {
      setError((err as Error).message);
      setRunState('failed');
    }
  };

  if (!instance || !mission) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Run: {name}</h1>
      <p className="text-sm text-muted-foreground mb-6">{instance.name}</p>

      {/* Input Form */}
      {runState === 'idle' && (
        <div className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Mission Inputs</h2>

          {(!mission.inputs || mission.inputs.length === 0) ? (
            <p className="text-sm text-muted-foreground mb-4">This mission has no inputs.</p>
          ) : (
            <div className="space-y-4 mb-4">
              {mission.inputs.map((inp) => (
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
          )}

          <Button onClick={handleRun} disabled={!instance.connected}>
            {instance.connected ? 'Run Mission' : 'Instance Disconnected'}
          </Button>
        </div>
      )}

      {/* Task Status */}
      {runState !== 'idle' && mission.tasks && mission.tasks.length > 0 && (
        <div className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Tasks</h2>
          <div className="space-y-2">
            {mission.tasks.map((task) => {
              const status = taskStatuses[task.name] || 'pending';
              return (
                <div key={task.name} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    status === 'completed' ? 'bg-green-500' :
                    status === 'running' ? 'bg-blue-500 animate-pulse' :
                    status === 'failed' ? 'bg-red-500' :
                    'bg-muted-foreground/30'
                  }`} />
                  <span className="text-sm font-medium">{task.name}</span>
                  {task.dependsOn && task.dependsOn.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      depends on: {task.dependsOn.join(', ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Log */}
      {events.length > 0 && (
        <div className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">
            Event Log
            {runState === 'running' && (
              <Badge variant="secondary" className="ml-2 animate-pulse">streaming</Badge>
            )}
          </h2>
          <div
            ref={eventLogRef}
            className="max-h-96 overflow-y-auto space-y-1 font-mono text-xs"
          >
            {events.map((event, i) => (
              <div key={i} className={`p-1.5 rounded ${getEventColor(event.eventType)}`}>
                <span className="text-muted-foreground">[{event.eventType}]</span>{' '}
                {formatEventData(event)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Banner */}
      {runState === 'completed' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Mission completed successfully.
        </div>
      )}
      {runState === 'failed' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          Mission failed{error ? `: ${error}` : '.'}
        </div>
      )}
    </div>
  );
}

function getEventColor(eventType: string): string {
  if (eventType.includes('failed')) return 'bg-red-50';
  if (eventType.includes('completed')) return 'bg-green-50';
  if (eventType.includes('started')) return 'bg-blue-50';
  if (eventType.includes('tool')) return 'bg-yellow-50';
  return 'bg-muted/50';
}

function formatEventData(event: MissionEvent): string {
  const d = event.data;
  switch (event.eventType) {
    case 'mission_started':
      return `Mission "${d.missionName}" started (${d.taskCount} tasks)`;
    case 'mission_completed':
      return `Mission "${d.missionName}" completed`;
    case 'mission_failed':
      return `Mission failed: ${d.error}`;
    case 'task_started':
      return `Task "${d.taskName}" started`;
    case 'task_completed':
      return `Task "${d.taskName}" completed: ${d.summary || ''}`;
    case 'task_failed':
      return `Task "${d.taskName}" failed: ${d.error}`;
    case 'agent_started':
      return `Agent "${d.agentName}" started for task "${d.taskName}"`;
    case 'agent_completed':
      return `Agent "${d.agentName}" completed`;
    case 'agent_calling_tool':
      return `Agent "${d.agentName}" calling tool "${d.toolName}"`;
    case 'agent_tool_complete':
      return `Agent "${d.agentName}" tool "${d.toolName}" complete`;
    case 'commander_calling_tool':
      return `Commander calling tool "${d.toolName}" for task "${d.taskName}"`;
    case 'commander_tool_complete':
      return `Commander tool "${d.toolName}" complete`;
    case 'iteration_started':
      return `Iteration ${d.index} started for "${d.taskName}"`;
    case 'iteration_completed':
      return `Iteration ${d.index} completed for "${d.taskName}"`;
    case 'iteration_failed':
      return `Iteration ${d.index} failed for "${d.taskName}": ${d.error}`;
    case 'summary_aggregation':
      return `Aggregating ${d.summaryCount} summaries for "${d.taskName}"`;
    default:
      return JSON.stringify(d);
  }
}
