import { useMemo, useState } from 'react';
import { z } from 'zod';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/shell/StatePanels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';

const sections = [
  { id: 'buttons', title: 'Buttons' },
  { id: 'fields', title: 'Fields' },
  { id: 'badges', title: 'Status badges' },
  { id: 'table', title: 'Table' },
  { id: 'dialog', title: 'Confirmation dialog' },
  { id: 'states', title: 'Loading, empty, and error' },
] as const;

const exampleSchema = z.object({
  title: z.string().trim().min(3, 'Enter at least 3 characters.'),
});

const sampleRows = [
  { code: 'BAPL', state: 'Not stored', note: 'Registry arrives in Module 4' },
  { code: 'SAPL', state: 'Not stored', note: 'Replaces ASEDS' },
  { code: 'Ontale', state: 'Not stored', note: 'First-class company' },
];

export function DesignSystemPage() {
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showErrorExample, setShowErrorExample] = useState(true);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return sections;
    }
    return sections.filter((section) =>
      section.title.toLowerCase().includes(needle),
    );
  }, [query]);

  const visibleIds = new Set(visible.map((section) => section.id));

  function submitExample() {
    const parsed = exampleSchema.safeParse({ title });
    if (!parsed.success) {
      setFieldMessage(null);
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid title.');
      return;
    }
    setFieldError(null);
    setFieldMessage(`Accepted example title “${parsed.data.title}”. Nothing was saved.`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Design system"
        description="Shared controls for later modules. The sample field and confirmation do not create an asset."
      />
      <div className="max-w-sm">
        <Label htmlFor="component-filter">Filter components</Label>
        <Input
          id="component-filter"
          className="mt-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buttons, table, dialog"
        />
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title="No matching components"
          description="Try button, field, badge, table, dialog, or state."
        />
      ) : null}

      {visibleIds.has('buttons') ? (
        <section aria-labelledby="buttons-heading" className="space-y-3">
          <h2 id="buttons-heading" className="text-lg font-semibold">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button">Primary</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
            <Button type="button" variant="outline">
              Outline
            </Button>
            <Button type="button" variant="ghost">
              Ghost
            </Button>
            <Button type="button" variant="destructive">
              Destructive
            </Button>
            <Button type="button" disabled>
              Disabled
            </Button>
          </div>
        </section>
      ) : null}

      {visibleIds.has('fields') ? (
        <section aria-labelledby="fields-heading" className="space-y-3">
          <h2 id="fields-heading" className="text-lg font-semibold">
            Fields
          </h2>
          <form
            className="max-w-md space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitExample();
            }}
            noValidate
          >
            <div>
              <Label htmlFor="example-title">Example title</Label>
              <Input
                id="example-title"
                className="mt-2"
                value={title}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? 'example-title-error' : undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
              {fieldError ? (
                <p id="example-title-error" className="mt-1 text-sm text-destructive">
                  {fieldError}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="example-note">Note</Label>
              <Textarea id="example-note" className="mt-2" placeholder="Optional" />
            </div>
            <Button type="submit">Check example</Button>
            {fieldMessage ? (
              <p className="text-sm text-ok" role="status">
                {fieldMessage}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {visibleIds.has('badges') ? (
        <section aria-labelledby="badges-heading" className="space-y-3">
          <h2 id="badges-heading" className="text-lg font-semibold">
            Status badges
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-ok-bg text-ok">Up</Badge>
            <Badge className="bg-warn-bg text-warn">Pending</Badge>
            <Badge className="bg-bad-bg text-bad">Down</Badge>
            <Badge variant="outline">Not started</Badge>
          </div>
        </section>
      ) : null}

      {visibleIds.has('table') ? (
        <section aria-labelledby="table-heading" className="space-y-3">
          <h2 id="table-heading" className="text-lg font-semibold">
            Table
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleRows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{row.state}</TableCell>
                    <TableCell>{row.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {visibleIds.has('dialog') ? (
        <section aria-labelledby="dialog-heading" className="space-y-3">
          <h2 id="dialog-heading" className="text-lg font-semibold">
            Confirmation dialog
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                Discard example
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard the example title?</DialogTitle>
                <DialogDescription>
                  This clears the sample field on this page. No asset is deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Keep
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setTitle('');
                      setFieldError(null);
                      setFieldMessage(null);
                      setConfirmed(true);
                    }}
                  >
                    Discard
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {confirmed ? <p role="status">Example discarded.</p> : null}
        </section>
      ) : null}

      {visibleIds.has('states') ? (
        <section aria-labelledby="states-heading" className="space-y-3">
          <h2 id="states-heading" className="text-lg font-semibold">
            Loading, empty, and error
          </h2>
          <LoadingState label="Checking a sample request." />
          <EmptyState
            title="No assets"
            description="The library is not built yet, so this empty state has nothing to list."
          />
          {showErrorExample ? (
            <ErrorState
              title="Sample request failed"
              detail="This message is an example. Retry hides it and does not call the API."
              onRetry={() => setShowErrorExample(false)}
            />
          ) : (
            <p role="status">Sample error dismissed.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
