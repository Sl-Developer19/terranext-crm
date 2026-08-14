'use client';

import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Academy, ProgrammeOption } from '@/features/catalogue';

import {
  activateTemplateAction,
  approveTemplateAction,
  archiveTemplateAction,
  createNewDraftVersionAction,
  submitTemplateForReviewAction,
} from '../actions/manage-template';
import type { CertificateTemplate, TemplateVersion } from '../schema';
import { VERSION_STATUS_KIND, VERSION_STATUS_LABELS } from '../status-labels';
import { EditTemplateMetaDialog } from './edit-template-meta-dialog';

type TransitionKind = 'submit' | 'approve' | 'activate' | 'archive';
type ConfirmTarget = { kind: TransitionKind; version: TemplateVersion } | null;

const CONFIRM_COPY: Record<
  TransitionKind,
  { title: string; consequence: string; confirmLabel: string; variant: 'primary' | 'destructive' }
> = {
  submit: {
    title: 'Submit this version for review?',
    consequence:
      'It moves out of draft — configuration can no longer be edited until it is either approved or a new draft version is created.',
    confirmLabel: 'Submit for review',
    variant: 'primary',
  },
  approve: {
    title: 'Approve this version?',
    consequence:
      'It becomes eligible for activation. It still will not be used for issuance until you activate it.',
    confirmLabel: 'Approve',
    variant: 'primary',
  },
  activate: {
    title: 'Activate this version?',
    consequence:
      'It becomes the version used for every new certificate issued against this assignment. Any previously active version for this template is archived automatically. Already-issued certificates are never affected.',
    confirmLabel: 'Activate',
    variant: 'primary',
  },
  archive: {
    title: 'Archive this version?',
    consequence:
      'It can no longer be edited, approved, activated, or used for issuance. This does not affect certificates already issued from it.',
    confirmLabel: 'Archive',
    variant: 'destructive',
  },
};

export function TemplateDetail({
  template,
  versions,
  academies,
  programmes,
}: {
  template: CertificateTemplate;
  versions: TemplateVersion[];
  academies: Academy[];
  programmes: ProgrammeOption[];
}) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = React.useState<ConfirmTarget>(null);
  const [pending, setPending] = React.useState(false);
  const [creatingVersion, setCreatingVersion] = React.useState(false);

  const runTransition = async () => {
    if (!confirmTarget) return;
    setPending(true);
    try {
      const ref = { templateId: template.id, versionId: confirmTarget.version.id };
      const result =
        confirmTarget.kind === 'submit'
          ? await submitTemplateForReviewAction(ref)
          : confirmTarget.kind === 'approve'
            ? await approveTemplateAction(ref)
            : confirmTarget.kind === 'activate'
              ? await activateTemplateAction(ref)
              : await archiveTemplateAction(ref);

      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Done.');
      setConfirmTarget(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const handleNewVersion = async () => {
    setCreatingVersion(true);
    try {
      const result = await createNewDraftVersionAction({ templateId: template.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.push(
        `/admin/settings/certificate-templates/${template.id}/versions/${result.data.versionId}`,
      );
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{template.name}</CardTitle>
            {template.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
            ) : null}
          </div>
          <EditTemplateMetaDialog
            template={template}
            academies={academies}
            programmes={programmes}
          />
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Assigned programme</dt>
              <dd className="mt-0.5 font-medium">{template.programmeName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assigned academy</dt>
              <dd className="mt-0.5 font-medium">
                {template.academyName ?? '—'}
                {template.academyName && !template.programmeName ? ' (fallback)' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Active version</dt>
              <dd className="mt-0.5 font-medium">
                {template.activeVersionId ? (
                  <StatusBadge kind="success" label={`v${template.activeVersionNumber}`} />
                ) : (
                  <span className="text-status-danger">None — certificates cannot be issued</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Versions</CardTitle>
          <Button variant="outline" onClick={handleNewVersion} disabled={creatingVersion}>
            {creatingVersion ? 'Creating…' : 'Create new version'}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell className="font-medium">v{version.versionNumber}</TableCell>
                  <TableCell>
                    <StatusBadge
                      kind={VERSION_STATUS_KIND[version.status]}
                      label={VERSION_STATUS_LABELS[version.status]}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {version.updatedAt ? format(new Date(version.updatedAt), 'PP') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/admin/settings/certificate-templates/${template.id}/versions/${version.id}`}
                        >
                          {version.status === 'draft' ? 'Open Editor' : 'View'}
                        </Link>
                      </Button>
                      {version.status === 'draft' ? (
                        <Button
                          size="sm"
                          onClick={() => setConfirmTarget({ kind: 'submit', version })}
                        >
                          Submit for Review
                        </Button>
                      ) : null}
                      {version.status === 'review' ? (
                        <Button
                          size="sm"
                          onClick={() => setConfirmTarget({ kind: 'approve', version })}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {version.status === 'approved' ? (
                        <Button
                          size="sm"
                          onClick={() => setConfirmTarget({ kind: 'activate', version })}
                        >
                          Activate
                        </Button>
                      ) : null}
                      {version.status !== 'archived' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmTarget({ kind: 'archive', version })}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTarget ? CONFIRM_COPY[confirmTarget.kind].title : ''}
        consequence={confirmTarget ? CONFIRM_COPY[confirmTarget.kind].consequence : ''}
        confirmLabel={confirmTarget ? CONFIRM_COPY[confirmTarget.kind].confirmLabel : 'Confirm'}
        variant={confirmTarget ? CONFIRM_COPY[confirmTarget.kind].variant : 'primary'}
        pending={pending}
        onConfirm={runTransition}
      />
    </div>
  );
}
