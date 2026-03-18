import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listSharedFolders, browseDirectory, getDownloadFileUrl, getDownloadDirUrl } from '@/api/client';
import type { BrowseEntryInfo } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Folder,
  File,
  Download,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

type SortKey = 'name' | 'size' | 'modTime';
type SortDir = 'asc' | 'desc';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function FileBrowserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const browserParam = searchParams.get('browser') ?? '';
  const pathParam = searchParams.get('path') ?? '';

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: browsersData, isLoading: browsersLoading } = useQuery({
    queryKey: ['sharedFolders', id],
    queryFn: () => listSharedFolders(id!),
    enabled: !!id,
  });

  const browsers = browsersData?.folders ?? [];
  const selectedBrowser = browserParam || browsers[0]?.name || '';
  const browserInfo = browsers.find((b) => b.name === selectedBrowser);

  const { data: dirData, isLoading: dirLoading } = useQuery({
    queryKey: ['browseDirectory', id, selectedBrowser, pathParam],
    queryFn: () => browseDirectory(id!, selectedBrowser, pathParam),
    enabled: !!id && !!selectedBrowser,
  });

  // Auto-select first browser when loaded
  if (browsers.length > 0 && !browserParam) {
    // Use setTimeout to avoid updating state during render
    setTimeout(() => {
      setSearchParams({ browser: browsers[0].name, path: '' }, { replace: true });
    }, 0);
  }

  const handleBrowserChange = (name: string) => {
    setSearchParams({ browser: name, path: '' });
  };

  const handleNavigate = (entry: BrowseEntryInfo) => {
    const newPath = pathParam ? `${pathParam}/${entry.name}` : entry.name;
    if (entry.isDir) {
      setSearchParams({ browser: selectedBrowser, path: newPath });
    } else {
      navigate(`/instances/${id}/files/view?browser=${encodeURIComponent(selectedBrowser)}&path=${encodeURIComponent(newPath)}`);
    }
  };

  const handleBreadcrumb = (index: number) => {
    const parts = pathParam.split('/').filter(Boolean);
    const newPath = parts.slice(0, index).join('/');
    setSearchParams({ browser: selectedBrowser, path: newPath });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedEntries = useMemo(() => {
    if (!dirData?.entries) return [];
    const entries = [...dirData.entries];
    entries.sort((a, b) => {
      // Directories always first
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'modTime':
          cmp = new Date(a.modTime).getTime() - new Date(b.modTime).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return entries;
  }, [dirData?.entries, sortKey, sortDir]);

  const pathParts = pathParam.split('/').filter(Boolean);

  if (browsersLoading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  if (browsers.length === 0) {
    return (
      <div className="p-8 text-muted-foreground">
        No folders available. Add a <code className="text-xs bg-muted px-1 py-0.5 rounded">shared_folder</code> block or a mission <code className="text-xs bg-muted px-1 py-0.5 rounded">folder</code> block to your config.
      </div>
    );
  }

  const SortButton = ({ field, children }: { field: SortKey; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={cn('h-3 w-3', sortKey === field ? 'opacity-100' : 'opacity-30')} />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Folders</span>
          {browsers.length > 1 && (
            <Select value={selectedBrowser} onValueChange={handleBrowserChange}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {browsers.map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    <span className="flex items-center gap-2">
                      {b.label}
                      {b.isShared && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">shared</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {browsers.length === 1 && browserInfo && (
            <span className="text-xs text-muted-foreground">{browserInfo.label}</span>
          )}
          {browserInfo && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Missions:</span>
              {browserInfo.missions && browserInfo.missions.length > 0 ? (
                browserInfo.missions.map((m) => (
                  <span key={m} className="px-1.5 py-0.5 rounded bg-muted font-medium text-foreground/70">
                    {m}
                  </span>
                ))
              ) : (
                <span className="italic">none</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {pathParam && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              asChild
            >
              <a
                href={getDownloadDirUrl(id!, selectedBrowser, pathParam)}
                download
              >
                <Download className="h-3.5 w-3.5" />
                Download Folder
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b text-xs text-muted-foreground shrink-0">
        <button
          onClick={() => handleBreadcrumb(0)}
          className={cn(
            'hover:text-foreground transition-colors',
            pathParts.length === 0 && 'text-foreground font-medium',
          )}
        >
          {browserInfo?.label ?? selectedBrowser}
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => handleBreadcrumb(i + 1)}
              className={cn(
                'hover:text-foreground transition-colors',
                i === pathParts.length - 1 && 'text-foreground font-medium',
              )}
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* File listing */}
      <div className="flex-1 overflow-auto">
        {dirLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">
                  <SortButton field="name">Name</SortButton>
                </TableHead>
                <TableHead className="w-[15%]">
                  <SortButton field="size">Size</SortButton>
                </TableHead>
                <TableHead className="w-[20%]">
                  <SortButton field="modTime">Modified</SortButton>
                </TableHead>
                <TableHead className="w-[15%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Empty directory
                  </TableCell>
                </TableRow>
              )}
              {sortedEntries.map((entry) => (
                <TableRow
                  key={entry.name}
                  className="cursor-pointer"
                  onClick={() => handleNavigate(entry)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {entry.isDir ? (
                        <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate text-sm">{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.isDir ? '—' : formatFileSize(entry.size)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(entry.modTime)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const entryPath = pathParam ? `${pathParam}/${entry.name}` : entry.name;
                        const url = entry.isDir
                          ? getDownloadDirUrl(id!, selectedBrowser, entryPath)
                          : getDownloadFileUrl(id!, selectedBrowser, entryPath);
                        window.open(url, '_blank');
                      }}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
