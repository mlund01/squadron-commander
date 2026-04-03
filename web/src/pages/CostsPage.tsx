import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { getCostSummary } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';

const PERIODS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: 365 * 10 },
] as const;

const chartConfig = {
  output: { label: 'Output', color: 'var(--chart-1)' },
  cacheWrite: { label: 'Cache Write', color: 'var(--chart-2)' },
  input: { label: 'Input', color: 'var(--chart-3)' },
  cacheRead: { label: 'Cache Read', color: 'var(--chart-4)' },
} satisfies ChartConfig;

function fmtCost(c: number) {
  if (c <= 0) return '$0.00';
  if (c < 0.01) return `$${c.toFixed(4)}`;
  if (c < 1) return `$${c.toFixed(3)}`;
  return `$${c.toFixed(2)}`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

export function CostsPage() {
  const { id: instanceId } = useParams();
  const [periodDays, setPeriodDays] = useState(30);
  const [chartBreakdown, setChartBreakdown] = useState<'type' | 'model' | 'mission'>('type');

  const from = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - periodDays);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }, [periodDays]);
  const to = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: byDate } = useQuery({
    queryKey: ['costs', instanceId, 'date', from, to],
    queryFn: () => getCostSummary(instanceId!, from, to, 'date'),
    enabled: !!instanceId,
    refetchInterval: 5000,
  });

  const { data: byModel } = useQuery({
    queryKey: ['costs', instanceId, 'model', from, to],
    queryFn: () => getCostSummary(instanceId!, from, to, 'model'),
    enabled: !!instanceId,
    refetchInterval: 5000,
  });

  // For model/mission breakdown, fetch date × field data
  const breakdownField = chartBreakdown === 'model' ? 'model' : chartBreakdown === 'mission' ? 'mission_name' : undefined;
  const { data: breakdownData } = useQuery({
    queryKey: ['costs', instanceId, 'breakdown', breakdownField, from, to],
    queryFn: () => getCostSummary(instanceId!, from, to, 'date', breakdownField),
    enabled: !!instanceId && !!breakdownField,
    refetchInterval: 5000,
  });

  const totals = byDate?.totals;

  // Build chart data and dynamic config based on breakdown mode
  const { chartData, dynamicChartConfig, dynamicBarKeys } = useMemo(() => {
    // Fill date range
    const allDates: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      allDates.push(d.toISOString().slice(0, 10));
    }

    if (chartBreakdown === 'type') {
      // Cost type breakdown
      const dataMap = new Map<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>();
      for (const d of byDate?.byGroup ?? []) {
        dataMap.set(d.groupKey, { input: d.inputCost, output: d.outputCost, cacheRead: d.cacheReadCost ?? 0, cacheWrite: d.cacheWriteCost ?? 0 });
      }
      const data = allDates.map(date => {
        const existing = dataMap.get(date);
        return { date, output: existing?.output ?? 0, cacheWrite: existing?.cacheWrite ?? 0, input: existing?.input ?? 0, cacheRead: existing?.cacheRead ?? 0 };
      });
      return { chartData: data, dynamicChartConfig: chartConfig, dynamicBarKeys: ['output', 'cacheWrite', 'input', 'cacheRead'] };
    }

    // Model or mission breakdown — pivot date × field into chart rows
    const rows = breakdownData?.byDateAndField ?? [];
    const fieldKeys = [...new Set(rows.map(r => r.fieldKey))];

    // Build per-date map: { date → { fieldKey → cost } }
    const dateMap = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const existing = dateMap.get(row.date) ?? {};
      existing[row.fieldKey] = row.totalCost;
      dateMap.set(row.date, existing);
    }

    const data = allDates.map(date => {
      const fields = dateMap.get(date) ?? {};
      const entry: Record<string, unknown> = { date };
      for (const key of fieldKeys) {
        entry[key] = fields[key] ?? 0;
      }
      return entry;
    });

    // Build dynamic config with chart colors
    const themeColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
    const config: ChartConfig = {};
    fieldKeys.forEach((key, i) => {
      config[key] = { label: key, color: themeColors[i % themeColors.length] };
    });

    return { chartData: data, dynamicChartConfig: config, dynamicBarKeys: fieldKeys };
  }, [chartBreakdown, byDate, breakdownData, from, to]);

  const modelData = (byModel?.byGroup ?? []).sort((a, b) => b.totalCost - a.totalCost);
  const recentMissions = byDate?.recentMissions ?? [];

  // Mission type aggregation
  const missionTypeData = useMemo(() => {
    const nameMap = new Map<string, { cost: number; turns: number }>();
    for (const m of recentMissions) {
      const existing = nameMap.get(m.missionName) ?? { cost: 0, turns: 0 };
      existing.cost += m.totalCost;
      existing.turns += m.turns;
      nameMap.set(m.missionName, existing);
    }
    return [...nameMap.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cost - a.cost);
  }, [recentMissions]);

  const maxModelCost = modelData.length > 0 ? modelData[0].totalCost : 1;
  const maxMissionCost = missionTypeData.length > 0 ? missionTypeData[0].cost : 1;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Cost Management</h1>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                periodDays === p.days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setPeriodDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Total</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{fmtCost(totals?.totalCost ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtNum(totals?.totalTurns ?? 0)} turns</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Input</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{fmtCost(totals?.inputCost ?? 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cache Read</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{fmtCost(totals?.cacheReadCost ?? 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cache Write</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{fmtCost(totals?.cacheWriteCost ?? 0)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Output</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{fmtCost(totals?.outputCost ?? 0)}</p>
        </div>
      </div>

      {/* Cost breakdown chart */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Breakdown</h2>
          <div className="flex gap-1">
            {([['type', 'By Cost Type'], ['model', 'By Model'], ['mission', 'By Mission']] as const).map(([key, label]) => (
              <button
                key={key}
                className={`px-2.5 py-0.5 text-[10px] rounded-md transition-colors ${
                  chartBreakdown === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setChartBreakdown(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ChartContainer config={dynamicChartConfig} className="h-[250px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="text-muted-foreground">{(dynamicChartConfig as Record<string, { label?: React.ReactNode }>)[name as string]?.label ?? name}</span>
                        <span className="font-medium tabular-nums">{fmtCost(Number(value))}</span>
                      </div>
                    )}
                    labelFormatter={(label) => {
                      return new Date(label + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {dynamicBarKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={`var(--color-${key})`}
                  stackId="cost"
                  radius={i === dynamicBarKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No cost data for this period.</p>
        )}
      </div>

      <hr className="border-border" />

      <div className="grid grid-cols-2 gap-4">
        {/* Cost by model — horizontal bars */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Cost by Model</h2>
          {modelData.length > 0 ? (
            <div className="space-y-2">
              {modelData.map(m => (
                <div key={m.groupKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate">{m.groupKey}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground tabular-nums">{m.turns} turns</span>
                      <span className="tabular-nums font-medium w-16 text-right">{fmtCost(m.totalCost)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ backgroundColor: 'var(--chart-1)', width: `${Math.max(1, (m.totalCost / maxModelCost) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cost data for this period.</p>
          )}
        </div>

        {/* Cost by mission type — horizontal bars */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Cost by Mission Type</h2>
          {missionTypeData.length > 0 ? (
            <div className="space-y-2">
              {missionTypeData.map(m => (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono truncate">{m.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground tabular-nums">{m.turns} turns</span>
                      <span className="tabular-nums font-medium w-16 text-right">{fmtCost(m.cost)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${Math.max(1, (m.cost / maxMissionCost) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cost data for this period.</p>
          )}
        </div>
      </div>

      <hr className="border-border" />

      {/* Recent mission runs */}
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent Mission Runs</h2>
        {recentMissions.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">Mission</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium text-right">Turns</th>
                <th className="px-2 py-1.5 font-medium text-right">Est. Cost</th>
                <th className="px-2 py-1.5 font-medium text-right">Started</th>
              </tr>
            </thead>
            <tbody>
              {recentMissions.map(m => (
                <tr key={m.missionId} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="px-2 py-1.5">
                    <Link to={`/instances/${instanceId}/runs/${m.missionId}`} className="font-mono text-primary hover:underline">
                      {m.missionName}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5">
                    <Badge variant={m.status === 'completed' ? 'default' : m.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px] px-1.5 py-0">
                      {m.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.turns}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtCost(m.totalCost)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{new Date(m.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No mission runs with cost data.</p>
        )}
      </div>
    </div>
  );
}
