import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { createAsset, fetchAssets, retryAsset, type Asset } from '@/api/assets';
import { CompanyRequestError } from '@/api/companies';
import { fetchFolders } from '@/api/folders';
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

const uploadSchema = z.object({
  folderId: z.string().min(1, 'Choose a folder path.'),
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or fewer.'),
});

type UploadValues = z.infer<typeof uploadSchema>;

const selectClass =
  'mt-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm';

export function AssetsPage() {
  const { session, ready } = useSession();
  const company = useCompany();
  const selected = company.selected;
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const folders = useQuery({
    queryKey: ['folders', selected?.id],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchFolders(selected!.id),
  });
  const assets = useQuery({
    queryKey: ['assets', selected?.id, query],
    enabled: Boolean(session) && Boolean(selected),
    queryFn: () => fetchAssets(selected!.id, query),
  });

  if (!ready || (session && !company.ready)) {
    return <LoadingState label="Loading company membership." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Assets"
          description="An upload records metadata and a failure. The file is not stored, and Google Drive is not called."
        />
        <EmptyState
          title="Sign in is required"
          description="Asset uploads are available after a server session."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Assets"
          description="An upload records metadata and a failure. The file is not stored, and Google Drive is not called."
        />
        <EmptyState
          title="No company membership"
          description="A membership is required before an upload can be recorded."
        />
      </div>
    );
  }

  const folderItems = folders.data?.items ?? [];
  const loadError = folders.error ?? assets.error;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Assets"
        description={
          query
            ? `Matches for “${query}” in ${selected.code}. File contents are not searched. A file is stored only after Google Drive returns a file id.`
            : `${selected.code} is selected in this tab. A file is stored only after Google Drive returns a file id.`
        }
        actions={
          <Button asChild variant="outline">
            <a href="/api/v1/storage/oauth/start">Connect Google Drive</a>
          </Button>
        }
      />
      {folders.isLoading || assets.isLoading ? (
        <LoadingState label="Loading folder paths and assets." />
      ) : loadError ? (
        <ErrorState
          title="Assets are unavailable"
          detail={messageFrom(loadError)}
          onRetry={() => {
            void folders.refetch();
            void assets.refetch();
          }}
        />
      ) : folderItems.length === 0 ? (
        <EmptyState
          title="No folder path"
          description="Record a folder path before an upload. This page will not invent a Drive folder."
        />
      ) : (
        <>
          <UploadForm
            companyId={selected.id}
            folders={folderItems.map((folder) => ({ id: folder.id, path: folder.path }))}
          />
          <AssetTable
            items={assets.data?.items ?? []}
            companyId={selected.id}
            query={query}
          />
        </>
      )}
    </div>
  );
}

function UploadForm({
  companyId,
  folders,
}: {
  companyId: string;
  folders: { id: string; path: string }[];
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Asset | null>(null);
  const form = useForm<UploadValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { folderId: folders[0]?.id ?? '', title: '' },
  });
  const mutation = useMutation({ mutationFn: createAsset });

  return (
    <form
      className="max-w-xl space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          if (!file) {
            setFileError('Choose a file.');
            return;
          }
          setFileError(null);
          try {
            const asset = await mutation.mutateAsync({
              folderId: values.folderId,
              title: values.title,
              file,
              idempotencyKey: crypto.randomUUID(),
            });
            setRecorded(asset);
            form.reset({ folderId: values.folderId, title: '' });
            setFile(null);
            await queryClient.invalidateQueries({ queryKey: ['assets', companyId] });
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Record an upload</h2>
      <div>
        <Label htmlFor="asset-folder">Folder path</Label>
        <select id="asset-folder" className={selectClass} {...form.register('folderId')}>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="asset-title">Title</Label>
        <Input id="asset-title" className="mt-2" {...form.register('title')} />
        {form.formState.errors.title ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="asset-file">File</Label>
        <Input
          id="asset-file"
          className="mt-2"
          type="file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setFileError(null);
          }}
        />
        {fileError ? <p className="mt-1 text-sm text-bad">{fileError}</p> : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {recorded ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {recorded.code} · {recorded.driveFileId ? 'Stored in Google Drive' : 'Upload failed'}
          </p>
          <p className="text-muted-foreground">{recorded.detail}</p>
        </div>
      ) : null}
      <Button type="submit" disabled={mutation.isPending}>
        Record upload
      </Button>
    </form>
  );
}

function AssetTable({
  items,
  companyId,
  query,
}: {
  items: Asset[];
  companyId: string;
  query: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={query ? 'No matching assets' : 'No assets'}
        description={
          query
            ? 'No code, title, or file name in this company contains that text. File contents are not searched.'
            : 'Recorded uploads appear here. None of them have a stored file.'
        }
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>File</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Review</TableHead>
          <TableHead>Drive</TableHead>
          <TableHead>Retry</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link to={`/assets/${item.id}`} className="font-medium underline">
                {item.code}
              </Link>
            </TableCell>
            <TableCell className="whitespace-normal">{item.title}</TableCell>
            <TableCell className="whitespace-normal">{item.fileName}</TableCell>
            <TableCell>{item.versions.at(-1)?.label ?? ''}</TableCell>
            <TableCell>{reviewLabel(item.workflowStage)}</TableCell>
            <TableCell>{item.driveFileId ? 'Stored in Google Drive' : 'Not stored'}</TableCell>
            <TableCell>
              {item.workflowStage === 'draft' ? (
                <RetryControl assetId={item.id} companyId={companyId} />
              ) : (
                'Retry is only available on a draft.'
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RetryControl({ assetId, companyId }: { assetId: string; companyId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: (file: File) => retryAsset(assetId, file) });

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Try again
      </Button>
    );
  }
  return (
    <form
      className="flex min-w-48 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem('retry-file');
        const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (!file) {
          setError('Choose a file.');
          return;
        }
        setError(null);
        void mutation.mutateAsync(file).then(
          async (asset) => {
            setNotice(asset.detail);
            await queryClient.invalidateQueries({ queryKey: ['assets', companyId] });
          },
          (caught: unknown) => setError(messageFrom(caught)),
        );
      }}
    >
      <Label htmlFor={`retry-${assetId}`} className="sr-only">
        Replacement file
      </Label>
      <Input id={`retry-${assetId}`} name="retry-file" type="file" />
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        Send again
      </Button>
    </form>
  );
}

function reviewLabel(stage: Asset['workflowStage']): string {
  const labels: Record<Asset['workflowStage'], string> = {
    draft: 'Draft',
    scope_analysis: 'Scope analysis',
    rm_qc: 'RM QC',
    rm_approval: 'RM approval',
    admin_qc: 'Admin QC',
    admin_approval: 'Admin approval',
    changes_requested: 'Changes requested',
  };
  return labels[stage];
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The asset request failed.';
}
