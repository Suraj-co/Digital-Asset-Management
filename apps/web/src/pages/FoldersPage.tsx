import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  createAsset,
  deleteAsset,
  fetchAssetFile,
  fetchAssets,
  updateAssetTitle,
  type Asset,
} from '@/api/assets';
import { CompanyRequestError } from '@/api/companies';
import {
  createDepartment,
  fetchDepartments,
  fetchFolders,
  renameFolder,
  resolveFolder,
  type FolderCatalog,
} from '@/api/folders';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/shell/company-context';
import { useSession } from '@/shell/session-context';

const departmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a department name.')
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/,
      'Use letters, numbers, spaces, hyphens, or underscores.',
    ),
});

const resolveSchema = z.object({
  departmentId: z.string().min(1, 'Choose a department.'),
  year: z.number().int().min(2000, 'Use a year from 2000 to 2100.').max(2100),
  campaign: z
    .string()
    .trim()
    .min(1, 'Enter a campaign name.')
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/,
      'Use letters, numbers, spaces, hyphens, or underscores.',
    ),
  stage: z.enum(['working', 'approved', 'archive']),
  assetType: z.enum([
    'images',
    'videos',
    'posters',
    'banners',
    'source_files',
    'other',
  ]),
});

type DepartmentValues = z.infer<typeof departmentSchema>;
type ResolveValues = z.infer<typeof resolveSchema>;

const selectClass =
  'mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm';

const currentYear = new Date().getFullYear();

export function FoldersPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const queryClient = useQueryClient();
  const departments = useQuery({
    queryKey: ['departments', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchDepartments(selected!.id),
  });
  const folders = useQuery({
    queryKey: ['folders', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchFolders(selected!.id),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Folders"
          description="Folder paths are stored for a company you belong to. This page does not call Google Drive."
        />
        <EmptyState
          title="Sign in is required"
          description="Department and folder records are available after a server session."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (company.error) {
    return (
      <ErrorState
        title="Companies are unavailable"
        detail={company.error}
        onRetry={() => void company.reload()}
      />
    );
  }
  if (!selected) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Folders"
          description="Folder paths are stored for a company you belong to. This page does not call Google Drive."
        />
        <EmptyState
          title="No company membership"
          description="A membership is required before a department or folder path can be recorded."
        />
      </div>
    );
  }

  const departmentItems = departments.data?.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Folders"
        description={`${selected.code} is selected. Create a department, then a folder path. A file is stored only after Google Drive returns a file id.`}
        actions={
          <Button asChild variant="outline">
            <a href="/api/v1/storage/oauth/start">Connect Google Drive</a>
          </Button>
        }
      />
      {departments.isLoading || folders.isLoading ? (
        <LoadingState label="Loading departments and folder paths." />
      ) : departments.error || folders.error ? (
        <ErrorState
          title="Folders are unavailable"
          detail={messageFrom(departments.error ?? folders.error)}
          onRetry={() => {
            void departments.refetch();
            void folders.refetch();
          }}
        />
      ) : (
        <>
          <DepartmentForm
            companyId={selected.id}
            onCreated={() =>
              void queryClient.invalidateQueries({
                queryKey: ['departments', selected.id],
              })
            }
          />
          {departmentItems.length === 0 ? (
            <EmptyState
              title="No department"
              description="An admin of this company adds a department. Folder paths are not invented for a company that has none."
            />
          ) : (
            <ResolveForm
              companyId={selected.id}
              departments={departmentItems}
              onResolved={() =>
                void queryClient.invalidateQueries({ queryKey: ['folders', selected.id] })
              }
            />
          )}
          <FolderBrowser
            companyId={selected.id}
            items={folders.data?.items ?? []}
            onChanged={() =>
              void queryClient.invalidateQueries({ queryKey: ['folders', selected.id] })
            }
          />
        </>
      )}
    </div>
  );
}

function DepartmentForm({
  companyId,
  onCreated,
}: {
  companyId: string;
  onCreated: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<DepartmentValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: DepartmentValues) => createDepartment(companyId, values.name),
  });

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          setNotice(null);
          try {
            const created = await mutation.mutateAsync(values);
            form.reset();
            setNotice(`${created.name} was added.`);
            onCreated();
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Add a department</h2>
      <div>
        <Label htmlFor="department-name">Name</Label>
        <Input
          id="department-name"
          className="mt-2"
          aria-invalid={form.formState.errors.name ? true : undefined}
          {...form.register('name')}
        />
        {form.formState.errors.name ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.name.message}</p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Add department
      </Button>
    </form>
  );
}

function ResolveForm({
  companyId,
  departments,
  onResolved,
}: {
  companyId: string;
  departments: { id: string; name: string }[];
  onResolved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<FolderCatalog | null>(null);
  const form = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: {
      departmentId: departments[0]?.id ?? '',
      year: currentYear,
      campaign: '',
      stage: 'working',
      assetType: 'posters',
    },
  });
  const mutation = useMutation({ mutationFn: resolveFolder });

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          try {
            const folder = await mutation.mutateAsync({
              companyId,
              departmentId: values.departmentId,
              year: values.year,
              campaign: values.campaign,
              stage: values.stage,
              assetType: values.assetType,
            });
            setRecorded(folder);
            onResolved();
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Record a folder path</h2>
      <div>
        <Label htmlFor="folder-department">Department</Label>
        <select id="folder-department" className={selectClass} {...form.register('departmentId')}>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="folder-year">Year</Label>
        <Input
          id="folder-year"
          className="mt-2"
          type="number"
          {...form.register('year', { valueAsNumber: true })}
        />
        {form.formState.errors.year ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.year.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="folder-campaign">Campaign</Label>
        <Input id="folder-campaign" className="mt-2" {...form.register('campaign')} />
        {form.formState.errors.campaign ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.campaign.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="folder-stage">Stage</Label>
        <select id="folder-stage" className={selectClass} {...form.register('stage')}>
          <option value="working">Working</option>
          <option value="approved">Approved</option>
          <option value="archive">Archive</option>
        </select>
      </div>
      <div>
        <Label htmlFor="folder-type">Type</Label>
        <select id="folder-type" className={selectClass} {...form.register('assetType')}>
          <option value="images">Images</option>
          <option value="videos">Videos</option>
          <option value="posters">Posters</option>
          <option value="banners">Banners</option>
          <option value="source_files">Source files</option>
          <option value="other">Other</option>
        </select>
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {recorded ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium break-all">{recorded.path}</p>
          <p className="text-muted-foreground">{recorded.detail}</p>
        </div>
      ) : null}
      <Button type="submit" disabled={mutation.isPending}>
        Record folder path
      </Button>
    </form>
  );
}

type Scope = {
  departmentId?: string;
  year?: number;
  campaign?: string;
  stage?: FolderCatalog['stage'];
  assetType?: FolderCatalog['assetType'];
};

function FolderBrowser({
  companyId,
  items,
  onChanged,
}: {
  companyId: string;
  items: FolderCatalog[];
  onChanged: () => void;
}) {
  const [scope, setScope] = useState<Scope>({});
  const [opened, setOpened] = useState<FolderCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const needle = search.trim().toLowerCase();
  const matching = items.filter((item) => {
    if (scope.departmentId && item.departmentId !== scope.departmentId) return false;
    if (scope.year !== undefined && item.year !== scope.year) return false;
    if (scope.campaign && item.campaign !== scope.campaign) return false;
    if (scope.stage && item.stage !== scope.stage) return false;
    if (scope.assetType && item.assetType !== scope.assetType) return false;
    if (needle && !`${item.path} ${item.campaign}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const level = !scope.departmentId
    ? 'department'
    : scope.year === undefined
      ? 'year'
      : !scope.campaign
        ? 'campaign'
        : !scope.stage
          ? 'stage'
          : !scope.assetType
            ? 'type'
            : 'files';
  const rows = level === 'files' ? matching : uniqueRows(matching, level);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="underline" onClick={() => { setScope({}); setOpened(null); }}>
          Company
        </button>
        {scope.departmentId ? (
          <button
            type="button"
            className="underline"
            onClick={() => {
              setScope({ departmentId: scope.departmentId });
              setOpened(null);
            }}
          >
            {items.find((item) => item.departmentId === scope.departmentId)?.departmentName}
          </button>
        ) : null}
        {scope.year !== undefined ? <span>{scope.year}</span> : null}
        {scope.campaign ? <span>{scope.campaign}</span> : null}
        {scope.stage ? <span>{scope.stage}</span> : null}
        {scope.assetType ? <span>{scope.assetType}</span> : null}
      </div>
      <div className="max-w-md">
        <Label htmlFor="folder-search">Search</Label>
        <Input
          id="folder-search"
          className="mt-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No folder path"
          description="Record a folder path to create the company, department, year, campaign, and asset type folders."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folder</TableHead>
              <TableHead>Drive</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={rowKey(item, level)}>
                <TableCell>
                  <button
                    type="button"
                    className="text-left underline break-all"
                    onClick={() => openRow(item, level, setScope, setOpened)}
                  >
                    {rowLabel(item, level)}
                  </button>
                </TableCell>
                <TableCell>{item.driveFolderId ?? 'Not in Drive'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {opened ? (
        <form
          className="flex max-w-md flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            setNotice(null);
            void renameFolder(opened.id, campaignName)
              .then((folder) => {
                setOpened(folder);
                setScope({
                  departmentId: folder.departmentId,
                  year: folder.year,
                  campaign: folder.campaign,
                  stage: folder.stage,
                  assetType: folder.assetType,
                });
                setNotice(`Renamed the campaign to ${folder.campaign}.`);
                onChanged();
              })
              .catch((error: unknown) => setFormError(messageFrom(error)));
          }}
        >
          <div className="grow">
            <Label htmlFor="rename-campaign">Rename campaign</Label>
            <Input
              id="rename-campaign"
              className="mt-2"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </div>
          <Button type="submit">Rename</Button>
        </form>
      ) : null}
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {opened ? (
        <FilePanel companyId={companyId} folder={opened} search={search} />
      ) : null}
    </div>
  );
}

function uniqueRows(items: FolderCatalog[], level: string): FolderCatalog[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = rowKey(item, level);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowKey(item: FolderCatalog, level: string): string {
  if (level === 'department') return item.departmentId;
  if (level === 'year') return String(item.year);
  if (level === 'campaign') return item.campaign;
  if (level === 'stage') return item.stage;
  if (level === 'type') return item.assetType;
  return item.id;
}

function rowLabel(item: FolderCatalog, level: string): string {
  if (level === 'department') return item.departmentName;
  if (level === 'year') return String(item.year);
  if (level === 'campaign') return item.campaign;
  if (level === 'stage') return item.stage;
  if (level === 'type') return item.assetType;
  return item.path;
}

function openRow(
  item: FolderCatalog,
  level: string,
  setScope: (scope: Scope) => void,
  setOpened: (folder: FolderCatalog | null) => void,
) {
  if (level === 'department') {
    setOpened(null);
    setScope({ departmentId: item.departmentId });
    return;
  }
  if (level === 'year') {
    setOpened(null);
    setScope({ departmentId: item.departmentId, year: item.year });
    return;
  }
  if (level === 'campaign') {
    setOpened(null);
    setScope({ departmentId: item.departmentId, year: item.year, campaign: item.campaign });
    return;
  }
  if (level === 'stage') {
    setOpened(null);
    setScope({
      departmentId: item.departmentId,
      year: item.year,
      campaign: item.campaign,
      stage: item.stage,
    });
    return;
  }
  setScope({
    departmentId: item.departmentId,
    year: item.year,
    campaign: item.campaign,
    stage: item.stage,
    assetType: item.assetType,
  });
  setOpened(item);
}

function FilePanel({
  companyId,
  folder,
  search,
}: {
  companyId: string;
  folder: FolderCatalog;
  search: string;
}) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const files = useQuery({
    queryKey: ['folder-files', folder.id, search],
    queryFn: () => fetchAssets(companyId, search, folder.id),
  });
  const items = files.data?.items ?? [];

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFormError(null);
    setNotice(null);
    const chosen = [...list];
    const failures: string[] = [];
    for (let index = 0; index < chosen.length; index += 1) {
      const file = chosen[index];
      if (!file) continue;
      setProgress(`Uploading ${index + 1} of ${chosen.length}: ${file.name}`);
      const key = `${folder.id.slice(0, 8)}:${file.size}:${file.lastModified}:${file.name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 24)}`.slice(0, 80);
      try {
        const asset = await createAsset({
          folderId: folder.id,
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          file,
          idempotencyKey: key,
        });
        if (!asset.driveFileId) {
          failures.push(`${file.name}: ${asset.detail}`);
        }
      } catch (error) {
        failures.push(`${file.name}: ${messageFrom(error)}`);
      }
    }
    setProgress(null);
    if (failures.length > 0) {
      setFormError(failures.join(' '));
    } else {
      setNotice(`Uploaded ${chosen.length} file${chosen.length === 1 ? '' : 's'} to Google Drive.`);
    }
    await queryClient.invalidateQueries({ queryKey: ['folder-files', folder.id] });
  }

  async function saveBlob(asset: Asset, inline: boolean) {
    setFormError(null);
    const blob = await fetchAssetFile(asset.id, inline);
    const url = URL.createObjectURL(blob);
    if (inline) {
      setPreviewUrl(url);
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = asset.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-sm font-semibold">Files</h2>
      <p className="text-sm text-muted-foreground break-all">{folder.path}</p>
      <p className="text-sm text-muted-foreground">{folder.detail}</p>
      <Input
        type="file"
        multiple
        aria-label="Upload files"
        onChange={(event) => {
          void upload(event.target.files);
          event.target.value = '';
        }}
      />
      {progress ? <p className="text-sm">{progress}</p> : null}
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {files.isLoading ? <LoadingState label="Loading files." /> : null}
      {files.error ? (
        <ErrorState
          title="Files are unavailable"
          detail={messageFrom(files.error)}
          onRetry={() => void files.refetch()}
        />
      ) : null}
      {items.map((asset) => (
        <FileRow
          key={asset.id}
          asset={asset}
          onError={setFormError}
          onDone={async (text) => {
            setNotice(text);
            await queryClient.invalidateQueries({ queryKey: ['folder-files', folder.id] });
          }}
          onOpen={saveBlob}
        />
      ))}
      {previewUrl ? (
        <img src={previewUrl} alt="Preview" className="max-h-80 max-w-full" />
      ) : null}
    </div>
  );
}

function FileRow({
  asset,
  onError,
  onDone,
  onOpen,
}: {
  asset: Asset;
  onError: (message: string) => void;
  onDone: (message: string) => Promise<void>;
  onOpen: (asset: Asset, inline: boolean) => Promise<void>;
}) {
  const [title, setTitle] = useState(asset.title);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
      <span className="min-w-40 grow break-all">{asset.fileName}</span>
      <Input className="max-w-48" value={title} onChange={(event) => setTitle(event.target.value)} aria-label={`Rename ${asset.fileName}`} />
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          void updateAssetTitle(asset.id, title)
            .then(() => onDone(`Renamed ${asset.fileName}.`))
            .catch((error: unknown) => onError(messageFrom(error)));
        }}
      >
        Rename
      </Button>
      <Button type="button" variant="outline" onClick={() => void onOpen(asset, false).catch((error: unknown) => onError(messageFrom(error)))}>
        Download
      </Button>
      <Button type="button" variant="outline" onClick={() => void onOpen(asset, true).catch((error: unknown) => onError(messageFrom(error)))}>
        Preview
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          void deleteAsset(asset.id)
            .then(() => onDone(`Deleted ${asset.fileName}.`))
            .catch((error: unknown) => onError(messageFrom(error)));
        }}
      >
        Delete
      </Button>
    </div>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The folder request failed.';
}
