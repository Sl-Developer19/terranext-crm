import { format } from 'date-fns';
import { FileBadge } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { CertificateTemplate } from '../schema';

/** S-CTE1 Certificate Templates list (Settings → Certificate Templates). */
export function TemplateList({ templates }: { templates: CertificateTemplate[] }) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={FileBadge}
        headline="No certificate templates yet"
        explanation="Create a template, upload approved artwork, map the dynamic fields, then activate it for a programme or academy."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Template</TableHead>
          <TableHead>Assigned to</TableHead>
          <TableHead>Active version</TableHead>
          <TableHead>Versions</TableHead>
          <TableHead>Last updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell>
              <Link
                href={`/admin/settings/certificate-templates/${template.id}`}
                className="font-medium hover:underline"
              >
                {template.name}
              </Link>
              {template.description ? (
                <p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground">
                  {template.description}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="text-sm">
              {template.programmeName ? (
                <span>{template.programmeName}</span>
              ) : template.academyName ? (
                <span>{template.academyName} (academy-wide)</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {template.activeVersionId ? (
                <StatusBadge kind="success" label={`v${template.activeVersionNumber} Active`} />
              ) : (
                <StatusBadge kind="neutral" label="No active version" />
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              v{template.latestVersionNumber}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {template.updatedAt ? format(new Date(template.updatedAt), 'PP') : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
