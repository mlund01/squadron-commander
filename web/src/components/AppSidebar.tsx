import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { listInstances } from '@/api/client';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Rocket, Bot, Puzzle, History } from 'lucide-react';

const navItems = [
  { label: 'Missions', path: 'missions', icon: Rocket },
  { label: 'Agents', path: 'agents', icon: Bot },
  { label: 'Plugins', path: 'plugins', icon: Puzzle },
  { label: 'History', path: 'history', icon: History },
];

export function AppSidebar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: instances } = useQuery({
    queryKey: ['instances'],
    queryFn: listInstances,
    refetchInterval: 5000,
  });

  const connectedInstances = instances?.filter((i) => i.connected) ?? [];
  const currentInstance = instances?.find((i) => i.id === id);

  const handleInstanceChange = (instanceId: string) => {
    navigate(`/instances/${instanceId}/missions`);
  };

  // Determine active nav item from URL
  const activePath = location.pathname.split('/').at(-1) ?? '';
  // Handle nested paths like /missions/:name/run
  const activeSection = location.pathname.includes('/missions/') && location.pathname.includes('/run')
    ? 'missions'
    : activePath;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="text-sm font-semibold text-muted-foreground mb-2">Squadron</div>
        <Select value={id ?? ''} onValueChange={handleInstanceChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select instance..." />
          </SelectTrigger>
          <SelectContent>
            {connectedInstances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span>{instance.name}</span>
                </div>
              </SelectItem>
            ))}
            {connectedInstances.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No instances connected
              </div>
            )}
          </SelectContent>
        </Select>
        {currentInstance && (
          <div className="mt-2 text-xs text-muted-foreground">
            v{currentInstance.version}
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = activeSection === item.path;
                const count = getNavCount(item.path, currentInstance?.config);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      disabled={!id}
                    >
                      <Link to={id ? `/instances/${id}/${item.path}` : '#'}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                        {count !== undefined && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {count}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function getNavCount(path: string, config?: { missions?: unknown[]; agents?: unknown[]; plugins?: unknown[] }): number | undefined {
  if (!config) return undefined;
  switch (path) {
    case 'missions': return config.missions?.length;
    case 'agents': return config.agents?.length;
    case 'plugins': return config.plugins?.length;
    default: return undefined;
  }
}
