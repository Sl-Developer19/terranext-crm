'use client';

import { Download, Play } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { csvFilename } from '@/lib/utils/csv';

import { exportReportAction, runReportAction } from '../actions/run-report';
import {
  REPORT_CATALOGUE,
  type ReportDefinition,
  type ReportId,
  type ReportResult,
} from '../schema';

/** Triggers a browser download without leaving the page or hitting the network again. */
function downloadCsv(csv: string, filename: string) {
  // A UTF-8 BOM makes Excel read non-ASCII names correctly instead of mojibake.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** S42 — report catalogue, parameterless runs, audited export (Doc 16). */
export function ReportsCentre({
  available,
  canExport,
}: {
  available: ReportId[];
  canExport: boolean;
}) {
  const [selected, setSelected] = React.useState<ReportDefinition | null>(null);
  const [result, setResult] = React.useState<ReportResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const catalogue = REPORT_CATALOGUE.filter((report) => available.includes(report.id));

  const onRun = async (report: ReportDefinition) => {
    setSelected(report);
    setResult(null);
    setRunning(true);
    try {
      const outcome = await runReportAction({ reportId: report.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      setResult(outcome.data);
    } finally {
      setRunning(false);
    }
  };

  const onExport = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const outcome = await exportReportAction({ reportId: selected.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      downloadCsv(outcome.data.csv, csvFilename(outcome.data.reportId));
      toast.success('Export downloaded — the export itself is recorded in the audit trail');
    } finally {
      setExporting(false);
    }
  };

  if (catalogue.length === 0) {
    return (
      <EmptyState
        icon={Play}
        headline="No reports available to your role"
        explanation="Reports are scoped to the modules you can already view."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-1">
        {catalogue.map((report) => (
          <Card
            key={report.id}
            className={selected?.id === report.id ? 'border-primary' : undefined}
          >
            <CardHeader>
              <CardTitle className="text-base">{report.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{report.description}</p>
              <p className="text-xs text-muted-foreground">{report.source}</p>
              <Button
                size="sm"
                variant={selected?.id === report.id ? 'primary' : 'outline'}
                disabled={running}
                onClick={() => onRun(report)}
              >
                <Play aria-hidden />
                Run
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">{selected ? selected.label : 'Result'}</CardTitle>
            {selected && result && canExport ? (
              <Button size="sm" variant="outline" loading={exporting} onClick={onExport}>
                <Download aria-hidden />
                Export CSV
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <EmptyState
                icon={Play}
                headline="Choose a report"
                explanation="Pick a report from the catalogue and run it to see the current figures."
              />
            ) : running ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Running…</p>
            ) : !result ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No result.</p>
            ) : (
              <div className="space-y-4">
                {result.note ? (
                  <p className="text-sm text-muted-foreground">{result.note}</p>
                ) : null}
                {result.rows.length === 0 ? (
                  <EmptyState
                    icon={Play}
                    headline="Nothing to report"
                    explanation="This report returned no rows, which for most of these is the good outcome."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {result.columns.map((column) => (
                            <TableHead
                              key={column.key}
                              className={column.numeric ? 'text-right' : undefined}
                            >
                              {column.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rows.map((row, index) => (
                          <TableRow key={index}>
                            {result.columns.map((column) => (
                              <TableCell
                                key={column.key}
                                className={column.numeric ? 'text-right tabular-nums' : undefined}
                              >
                                {row[column.key] ?? '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
