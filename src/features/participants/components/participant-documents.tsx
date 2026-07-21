'use client';

import { format } from 'date-fns';
import { Download, FileText, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
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

import {
  confirmDocumentUpload,
  issueDocumentDownloadUrl,
  requestUploadTicket,
} from '../actions/manage-documents';
import {
  ALLOWED_CONTENT_TYPES,
  DOCUMENT_KINDS,
  MAX_DOCUMENT_BYTES,
  type DocumentKind,
  type ParticipantDocument,
} from '../schema';
import { DOCUMENT_KIND_LABELS } from '../status-labels';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * S21 Documents tab — the Doc 10 §6 upload flow end to end:
 * ticket → signed-URL PUT → server-side confirmation. The browser never
 * holds credentials and never picks its own storage path.
 */
export function ParticipantDocuments({
  participantId,
  documents,
  canUpload,
}: {
  participantId: string;
  documents: ParticipantDocument[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<DocumentKind>('id_proof');
  const [uploading, setUploading] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error('Files must be 10MB or smaller.');
      return;
    }
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP, and PDF files are accepted.');
      return;
    }

    setUploading(true);
    try {
      const ticket = await requestUploadTicket({
        participantId,
        kind,
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type as (typeof ALLOWED_CONTENT_TYPES)[number],
      });
      if (!ticket.ok) {
        toast.error(ticket.error.message);
        return;
      }

      // The Content-Type must match the signed value exactly or GCS rejects
      // the request — the signature covers the header.
      const response = await fetch(ticket.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ticket.data.contentType },
        body: file,
      });
      if (!response.ok) {
        toast.error('The file could not be uploaded. Please try again.');
        return;
      }

      const confirmed = await confirmDocumentUpload({
        participantId,
        documentId: ticket.data.documentId,
      });
      if (!confirmed.ok) {
        toast.error(confirmed.error.message);
        return;
      }
      if (confirmed.data.status === 'rejected') {
        toast.error('The uploaded file did not match its request and was discarded.');
      } else {
        toast.success('Document uploaded');
      }
      router.refresh();
    } catch {
      toast.error('Network problem during upload — please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (document: ParticipantDocument) => {
    setDownloadingId(document.id);
    try {
      const outcome = await issueDocumentDownloadUrl({ participantId, documentId: document.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      window.open(outcome.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {canUpload ? (
          <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="document-kind">Document type</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as DocumentKind)}>
                <SelectTrigger id="document-kind" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_KINDS.map((documentKind) => (
                    <SelectItem key={documentKind} value={documentKind}>
                      {DOCUMENT_KIND_LABELS[documentKind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-file">File</Label>
              <input
                ref={fileInputRef}
                id="document-file"
                type="file"
                accept={ALLOWED_CONTENT_TYPES.join(',')}
                disabled={uploading}
                className="block w-72 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1 file:text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>
            {uploading ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="size-4 animate-pulse" aria-hidden />
                Uploading…
              </span>
            ) : null}
            <p className="w-full text-xs text-muted-foreground">
              JPEG, PNG, WebP, or PDF · up to 10MB. Downloads are logged against your account.
            </p>
          </div>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            headline="No documents yet"
            explanation="Upload ID proofs, photos, resumes, or passports to keep them on the participant record."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.fileName}</TableCell>
                  <TableCell className="text-sm">{DOCUMENT_KIND_LABELS[document.kind]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatSize(document.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      kind={
                        document.status === 'ready'
                          ? 'success'
                          : document.status === 'rejected'
                            ? 'danger'
                            : 'progress'
                      }
                      label={
                        document.status === 'ready'
                          ? 'Ready'
                          : document.status === 'rejected'
                            ? 'Rejected'
                            : 'Pending'
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {document.uploadedAt ? format(new Date(document.uploadedAt), 'PP') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {document.status === 'ready' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === document.id}
                        onClick={() => handleDownload(document)}
                      >
                        <Download aria-hidden />
                        Download
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
