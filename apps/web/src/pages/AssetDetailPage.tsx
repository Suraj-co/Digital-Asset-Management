import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import {
  createAssetVersion,
  fetchAsset,
  transitionAsset,
  updateAssetTitle,
  type Asset,
} from '@/api/assets';
import { CompanyRequestError } from '@/api/companies';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/shell/StatePanels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSession } from '@/shell/session-context';

const titleSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or fewer.'),
});

type TitleValues = z.infer<typeof titleSchema>;

const REVIEW_STAGES = new Set<Asset['workflowStage']>([
  'scope_analysis',
  'rm_qc',
  'rm_approval',
  'admin_qc',
  'admin_approval',
]);

const STAGE_LABEL: Record<Asset['workflowStage'], string> = {
  draft: 'Draft',
  scope_analysis: 'Scope analysis',
  rm_qc: 'RM QC',
  rm_approval: 'RM approval',
  admin_qc: 'Admin QC',
  admin_approval: 'Admin approval',
  changes_requested: 'Changes requested',
};

function pendingReviewer(item: Asset): string {
  if (item.publication === 'ready') {
    return 'None';
  }
  if (item.workflowStage === 'draft' || item.workflowStage === 'changes_requested') {
    return 'Creator';
  }
  if (
    item.workflowStage === 'scope_analysis' ||
    item.workflowStage === 'rm_qc' ||
    item.workflowStage === 'rm_approval'
  ) {
    return 'RM';
  }
  return 'Admin';
}

const ACTION_LABEL: Record<Asset['actions'][number], string> = {
  submit: 'Submit for review',
  approve: 'Approve',
  reject: 'Reject',
  publish: 'Try publication again',
};

export function AssetDetailPage() {
  const { assetId } = useParams();
  const { session, ready } = useSession();
  const asset = useQuery({
    queryKey: ['asset', assetId],
    enabled: Boolean(session) && Boolean(assetId),
    queryFn: () => fetchAsset(assetId!),
  });

  if (!ready) {
    return <LoadingState label="Checking the session." />;
  }
  if (!session) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Asset"
          description="Metadata is available after a server session. The file is not stored."
        />
        <EmptyState
          title="Sign in is required"
          description="Asset details are available after a server session."
        />
        <Link to="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (!assetId) {
    return (
      <EmptyState title="No asset" description="This address does not name an asset." />
    );
  }
  if (asset.isLoading) {
    return <LoadingState label="Loading the asset." />;
  }
  if (asset.error || !asset.data) {
    return (
      <ErrorState
        title="This asset is unavailable"
        detail={messageFrom(asset.error)}
        onRetry={() => void asset.refetch()}
      />
    );
  }

  const item = asset.data;
  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={item.code}
        description={
          item.driveFileId
            ? 'This file is stored in Google Drive.'
            : 'Upload failed. There is no preview because the file was not stored.'
        }
      />
      <Link to="/assets" className="text-sm font-medium underline">
        Back to assets
      </Link>
      <dl className="grid min-w-0 max-w-xl gap-3 text-sm">
        <Detail label="Title" value={item.title} />
        <Detail label="State" value="Upload failed" />
        <Detail label="File name" value={item.fileName} />
        <Detail label="Size" value={`${item.byteSize} bytes`} />
        <Detail label="Content type" value={item.contentType} />
        <Detail label="Folder" value={item.path} />
        <Detail label="Review" value={STAGE_LABEL[item.workflowStage]} />
        <Detail
          label="Status"
          value={
            item.publication === 'ready' ? 'Ready to publish' : STAGE_LABEL[item.workflowStage]
          }
        />
        <Detail label="Pending reviewer" value={pendingReviewer(item)} />
        <Detail label="Drive" value={item.driveFileId ? 'Stored in Google Drive' : 'Not stored'} />
        <Detail label="Detail" value={item.detail} />
      </dl>
      {item.driveFileId ? (
        <a
          className="text-sm font-medium underline"
          href={`https://drive.google.com/file/d/${item.driveFileId}/view`}
        >
          Open the file in Google Drive
        </a>
      ) : (
        <p className="max-w-xl text-sm text-muted-foreground">
          No preview. The file was not stored.
        </p>
      )}
      <ReviewPanel asset={item} />
      <VersionList versions={item.versions} />
      {REVIEW_STAGES.has(item.workflowStage) ? (
        <p className="max-w-xl text-sm text-muted-foreground">
          This asset is in review. Record another version after it is rejected.
        </p>
      ) : (
        <VersionForm assetId={item.id} />
      )}
      <TitleForm key={item.id} assetId={item.id} title={item.title} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  );
}

function ReviewPanel({ asset }: { asset: Asset }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (input: { action: Asset['actions'][number]; reason?: string }) =>
      transitionAsset(asset.id, input),
  });

  function decide(action: Asset['actions'][number]) {
    setFormError(null);
    setNotice(null);
    if (action === 'reject' && reason.trim().length === 0) {
      setFormError('Enter a reason for the rejection.');
      return;
    }
    void mutation
      .mutateAsync(action === 'reject' ? { action, reason: reason.trim() } : { action })
      .then(
        async (next) => {
          setNotice(next.decisions.at(-1)?.detail ?? 'Decision recorded.');
          setReason('');
          await queryClient.invalidateQueries({ queryKey: ['asset', asset.id] });
          await queryClient.invalidateQueries({ queryKey: ['assets'] });
        },
        (caught: unknown) => setFormError(messageFrom(caught)),
      );
  }

  return (
    <section className="min-w-0 max-w-xl space-y-3 rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-sm font-semibold">Review</h2>
      <p className="text-sm">{STAGE_LABEL[asset.workflowStage]}</p>
      <p className="text-sm text-muted-foreground">
        A decision does not store the file or move it in Drive.
      </p>
      {asset.publication === 'not_run' ? (
        <p className="text-sm text-muted-foreground">
          Google Drive was not called. The file was not moved into 02_Approved.
        </p>
      ) : null}
      {asset.actions.includes('reject') ? (
        <div>
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            className="mt-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {asset.actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'reject' ? 'outline' : 'default'}
            disabled={mutation.isPending}
            onClick={() => decide(action)}
          >
            {ACTION_LABEL[action]}
          </Button>
        ))}
      </div>
      <DecisionList decisions={asset.decisions} />
    </section>
  );
}

function DecisionList({ decisions }: { decisions: Asset['decisions'] }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No decisions yet.</p>;
  }
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">Decisions</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decisions.map((decision) => (
            <TableRow key={decision.id}>
              <TableCell className="whitespace-normal">
                {decision.action}
                {decision.reason ? ` — ${decision.reason}` : ''}
              </TableCell>
              <TableCell>{decision.versionLabel}</TableCell>
              <TableCell className="whitespace-normal">{decision.actorEmail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VersionList({ versions }: { versions: Asset['versions'] }) {
  return (
    <div className="min-w-0 space-y-3">
      <h2 className="text-sm font-semibold">Versions</h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        Earlier attempts stay listed. None of them have a stored file.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Drive</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell>{version.label}</TableCell>
              <TableCell className="whitespace-normal">{version.fileName}</TableCell>
              <TableCell>{version.driveFileId ? 'Stored in Google Drive' : 'Not stored'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VersionForm({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (next: File) => createAssetVersion(assetId, next, crypto.randomUUID()),
  });

  return (
    <form
      className="max-w-xl space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!file) {
          setFileError('Choose a file.');
          return;
        }
        setFileError(null);
        setFormError(null);
        setNotice(null);
        void mutation.mutateAsync(file).then(
          async (asset) => {
            const latest = asset.versions.at(-1);
            const resubmit = asset.decisions.at(-1);
            setNotice(
              resubmit?.action === 'resubmit'
                ? resubmit.detail
                : latest?.driveFileId
                  ? `${latest.label} stored in Google Drive.`
                  : latest
                    ? `${latest.label} recorded. The file was not stored.`
                    : 'The version was recorded. The file was not stored.',
            );
            setFile(null);
            await queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
            await queryClient.invalidateQueries({ queryKey: ['assets'] });
          },
          (caught: unknown) => setFormError(messageFrom(caught)),
        );
      }}
    >
      <h2 className="text-sm font-semibold">Record another version</h2>
      <p className="text-sm text-muted-foreground">
        This keeps the same asset id. The new file is stored only after Google Drive returns a file id.
      </p>
      <div>
        <Label htmlFor="asset-version-file">File</Label>
        <Input
          id="asset-version-file"
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
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Record another version
      </Button>
    </form>
  );
}

function TitleForm({ assetId, title }: { assetId: string; title: string }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<TitleValues>({
    resolver: zodResolver(titleSchema),
    defaultValues: { title },
  });
  const mutation = useMutation({
    mutationFn: (values: TitleValues) => updateAssetTitle(assetId, values.title),
  });

  return (
    <form
      className="max-w-xl space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(event) =>
        void form.handleSubmit(async (values) => {
          setFormError(null);
          setNotice(null);
          try {
            await mutation.mutateAsync(values);
            setNotice('Title saved. The file is still not stored.');
            await queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
            await queryClient.invalidateQueries({ queryKey: ['assets'] });
          } catch (error) {
            setFormError(messageFrom(error));
          }
        })(event)
      }
      noValidate
    >
      <h2 className="text-sm font-semibold">Edit title</h2>
      <p className="text-sm text-muted-foreground">
        This changes the title only. It does not store a file or call Google Drive.
      </p>
      <div>
        <Label htmlFor="asset-title-edit">Title</Label>
        <Input id="asset-title-edit" className="mt-2" {...form.register('title')} />
        {form.formState.errors.title ? (
          <p className="mt-1 text-sm text-bad">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      {formError ? <p className="text-sm text-bad">{formError}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      <Button type="submit" disabled={mutation.isPending}>
        Save title
      </Button>
    </form>
  );
}

function messageFrom(error: unknown): string {
  if (error instanceof CompanyRequestError) {
    return error.message;
  }
  return 'The asset request failed.';
}
