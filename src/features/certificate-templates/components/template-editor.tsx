'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

import {
  confirmArtworkUploadAction,
  confirmSignatureUploadAction,
  getVersionAssetUrlsAction,
  previewTemplateAction,
  requestArtworkUploadTicketAction,
  requestSignatureUploadTicketAction,
  updateSignatoryInfoAction,
  updateVersionFieldsAction,
} from '../actions/manage-template';
import { ASSUMED_ARTWORK_DPI, canEditVersion, validateForActivation } from '../logic';
import {
  ARTWORK_MAX_BYTES,
  ARTWORK_MIME_TYPES,
  IMAGE_FIELD_KEYS,
  SIGNATURE_MAX_BYTES,
  SIGNATURE_MIME_TYPES,
  TEXT_FIELD_KEYS,
  type ImageFieldConfig,
  type ImageFieldKey,
  type QrFieldConfig,
  type SignatureSlot,
  type TemplateFields,
  type TemplateFontFamily,
  type TemplateVersion,
  type TextFieldConfig,
  type TextFieldKey,
} from '../schema';
import { VERSION_STATUS_KIND, VERSION_STATUS_LABELS } from '../status-labels';
import { ImageFieldPanel, QrFieldPanel, TextFieldPanel } from './field-config-panel';

type FieldKey = TextFieldKey | ImageFieldKey | 'verificationQr';

const TEXT_FIELD_LABELS: Record<TextFieldKey, string> = {
  participantName: 'Participant Name',
  programmeName: 'Programme Name',
  academyName: 'Academy Name',
  completionDate: 'Completion Date',
  certificateId: 'Certificate ID',
  duration: 'Duration',
  signatoryName1: 'Signatory 1 Name',
  signatoryDesignation1: 'Signatory 1 Designation',
  signatoryName2: 'Signatory 2 Name',
  signatoryDesignation2: 'Signatory 2 Designation',
};

const IMAGE_FIELD_LABELS: Record<ImageFieldKey, string> = {
  signature1: 'Signature 1 Image',
  signature2: 'Signature 2 Image',
};

const SAMPLE_TEXT: Record<TextFieldKey, string> = {
  participantName: 'Participant Name',
  programmeName: 'Programme Name',
  academyName: 'Academy Name',
  completionDate: '01 January 2026',
  certificateId: 'TNXC-2026-00001',
  duration: '45 Days',
  signatoryName1: 'Signatory Name',
  signatoryDesignation1: 'Designation',
  signatoryName2: 'Signatory Name',
  signatoryDesignation2: 'Designation',
};

const CSS_FONT: Record<TemplateFontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Helvetica-Bold': 'Helvetica, Arial, sans-serif',
  'Helvetica-Oblique': 'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  TimesRomanBold: '"Times New Roman", Times, serif',
  TimesRomanItalic: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
  CourierBold: '"Courier New", Courier, monospace',
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid_image'));
    };
    img.src = url;
  });
}

function openPdfFromBase64(base64: string): void {
  const byteChars = atob(base64);
  const byteNumbers = new Array<number>(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface DragState {
  key: FieldKey;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
}

export function TemplateEditor({
  templateId,
  version,
}: {
  templateId: string;
  version: TemplateVersion;
}) {
  const router = useRouter();
  const readOnly = !canEditVersion(version.status);

  const [fields, setFields] = React.useState<TemplateFields>(version.fields);
  const [signatoryDrafts, setSignatoryDrafts] = React.useState(version.signatories);
  const [dirty, setDirty] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<FieldKey | null>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [uploadingArtwork, setUploadingArtwork] = React.useState(false);
  const [uploadingSlot, setUploadingSlot] = React.useState<SignatureSlot | null>(null);
  const [savingSlot, setSavingSlot] = React.useState<SignatureSlot | null>(null);
  const [assets, setAssets] = React.useState<{
    artworkUrl: string | null;
    signature1Url: string | null;
    signature2Url: string | null;
  } | null>(null);

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const artworkInputRef = React.useRef<HTMLInputElement>(null);
  const signatureInputRefs = React.useRef<Record<SignatureSlot, HTMLInputElement | null>>({
    signature1: null,
    signature2: null,
  });

  React.useEffect(() => {
    setFields(version.fields);
    setSignatoryDrafts(version.signatories);
    setDirty(false);
  }, [version]);

  const loadAssets = React.useCallback(async () => {
    const result = await getVersionAssetUrlsAction({ templateId, versionId: version.id });
    if (result.ok) setAssets(result.data);
  }, [templateId, version.id]);

  React.useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  React.useEffect(() => {
    if (!dragState) return undefined;

    function handleMove(event: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas || !dragState) return;
      const rect = canvas.getBoundingClientRect();
      const dxFraction = (event.clientX - dragState.startClientX) / rect.width;
      const dyFraction = (event.clientY - dragState.startClientY) / rect.height;
      const x = clamp01(dragState.originX + dxFraction);
      const y = clamp01(dragState.originY + dyFraction);
      setFields(
        (prev) =>
          ({ ...prev, [dragState.key]: { ...prev[dragState.key], x, y } }) as TemplateFields,
      );
      setDirty(true);
    }
    function handleUp() {
      setDragState(null);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState]);

  function handlePointerDown(key: FieldKey, event: React.PointerEvent) {
    if (readOnly) return;
    event.preventDefault();
    setSelectedKey(key);
    const cfg = fields[key];
    setDragState({
      key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: cfg.x,
      originY: cfg.y,
    });
  }

  function updateTextField(key: TextFieldKey, patch: Partial<TextFieldConfig>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  }
  function updateImageField(key: ImageFieldKey, patch: Partial<ImageFieldConfig>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  }
  function updateQrField(patch: Partial<QrFieldConfig>) {
    setFields((prev) => ({ ...prev, verificationQr: { ...prev.verificationQr, ...patch } }));
    setDirty(true);
  }

  async function handleSaveLayout() {
    setSaving(true);
    try {
      const result = await updateVersionFieldsAction({ templateId, versionId: version.id, fields });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Layout saved.');
      setDirty(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      if (dirty) {
        const saveResult = await updateVersionFieldsAction({
          templateId,
          versionId: version.id,
          fields,
        });
        if (!saveResult.ok) {
          toast.error(saveResult.error.message);
          return;
        }
        setDirty(false);
        router.refresh();
      }
      const result = await previewTemplateAction({ templateId, versionId: version.id });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      openPdfFromBase64(result.data.pdfBase64);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleArtworkFile(file: File) {
    if (file.size > ARTWORK_MAX_BYTES) {
      toast.error('Artwork must be 15MB or smaller.');
      return;
    }
    if (!(ARTWORK_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Only PNG or JPEG artwork is accepted.');
      return;
    }

    setUploadingArtwork(true);
    try {
      const dims = await loadImageDimensions(file).catch(() => null);
      if (!dims) {
        toast.error('Could not read this image file.');
        return;
      }

      const ticket = await requestArtworkUploadTicketAction({
        templateId,
        versionId: version.id,
        fileName: file.name,
        contentType: file.type as (typeof ARTWORK_MIME_TYPES)[number],
        sizeBytes: file.size,
        widthPx: dims.width,
        heightPx: dims.height,
      });
      if (!ticket.ok) {
        toast.error(ticket.error.message);
        return;
      }

      const response = await fetch(ticket.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ticket.data.contentType },
        body: file,
      });
      if (!response.ok) {
        toast.error('The artwork could not be uploaded. Please try again.');
        return;
      }

      const confirmed = await confirmArtworkUploadAction({
        templateId,
        versionId: version.id,
        contentType: file.type as (typeof ARTWORK_MIME_TYPES)[number],
        sizeBytes: file.size,
        widthPx: dims.width,
        heightPx: dims.height,
      });
      if (!confirmed.ok) {
        toast.error(confirmed.error.message);
        return;
      }
      toast.success('Artwork uploaded.');
      router.refresh();
      void loadAssets();
    } finally {
      setUploadingArtwork(false);
      if (artworkInputRef.current) artworkInputRef.current.value = '';
    }
  }

  async function handleSignatureFile(slot: SignatureSlot, file: File) {
    if (file.size > SIGNATURE_MAX_BYTES) {
      toast.error('Signature images must be 5MB or smaller.');
      return;
    }
    if (!(SIGNATURE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Only PNG or JPEG signature images are accepted.');
      return;
    }

    setUploadingSlot(slot);
    try {
      const ticket = await requestSignatureUploadTicketAction({
        templateId,
        versionId: version.id,
        slot,
        fileName: file.name,
        contentType: file.type as (typeof SIGNATURE_MIME_TYPES)[number],
        sizeBytes: file.size,
      });
      if (!ticket.ok) {
        toast.error(ticket.error.message);
        return;
      }

      const response = await fetch(ticket.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ticket.data.contentType },
        body: file,
      });
      if (!response.ok) {
        toast.error('The signature image could not be uploaded. Please try again.');
        return;
      }

      const confirmed = await confirmSignatureUploadAction({
        templateId,
        versionId: version.id,
        slot,
        contentType: file.type as (typeof SIGNATURE_MIME_TYPES)[number],
        sizeBytes: file.size,
      });
      if (!confirmed.ok) {
        toast.error(confirmed.error.message);
        return;
      }
      toast.success('Signature image uploaded.');
      router.refresh();
      void loadAssets();
    } finally {
      setUploadingSlot(null);
      const input = signatureInputRefs.current[slot];
      if (input) input.value = '';
    }
  }

  async function handleSaveSignatory(slot: SignatureSlot) {
    setSavingSlot(slot);
    try {
      const draft = signatoryDrafts[slot];
      const result = await updateSignatoryInfoAction({
        templateId,
        versionId: version.id,
        slot,
        name: draft.name,
        designation: draft.designation,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Signatory saved.');
      router.refresh();
    } finally {
      setSavingSlot(null);
    }
  }

  const validation = validateForActivation({
    artwork: version.artwork,
    fields,
    signatories: signatoryDrafts,
  });
  const artworkAspect = version.artwork
    ? version.artwork.widthPx / version.artwork.heightPx
    : 297 / 210;
  const ptScale = ASSUMED_ARTWORK_DPI / 72;

  function ptToPx(pt: number, displayWidthPx: number): number {
    // displayWidthPx is the rendered canvas width; artwork px per pt is fixed
    // by ASSUMED_ARTWORK_DPI, so screen px = pt * (artworkPxPerPt) * (display/artworkWidth).
    if (!version.artwork) return pt;
    const displayScale = displayWidthPx / version.artwork.widthPx;
    return pt * ptScale * displayScale;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Version {version.versionNumber}</span>
          <StatusBadge
            kind={VERSION_STATUS_KIND[version.status]}
            label={VERSION_STATUS_LABELS[version.status]}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading || !version.artwork}
          >
            {previewLoading ? 'Rendering…' : 'Preview'}
          </Button>
          {!readOnly ? (
            <Button onClick={handleSaveLayout} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save Layout'}
            </Button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <div className="rounded-md border border-status-info/30 bg-status-info/10 p-3 text-sm text-status-info">
          This version is {VERSION_STATUS_LABELS[version.status].toLowerCase()} and is read-only.
          Create a new version from the template page to make changes.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-4">
            {!version.artwork ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-16 text-center">
                <p className="text-sm font-medium">Upload the certificate artwork to begin</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  PNG or JPEG, up to 15MB. The uploaded artwork is used exactly as provided — it is
                  never redesigned or approximated.
                </p>
                {!readOnly ? (
                  <>
                    <input
                      ref={artworkInputRef}
                      type="file"
                      accept={ARTWORK_MIME_TYPES.join(',')}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleArtworkFile(file);
                      }}
                    />
                    <Button
                      onClick={() => artworkInputRef.current?.click()}
                      disabled={uploadingArtwork}
                    >
                      {uploadingArtwork ? 'Uploading…' : 'Upload artwork'}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : (
              <div>
                <div
                  ref={canvasRef}
                  className="relative mx-auto w-full max-w-[900px] select-none overflow-hidden rounded-md border bg-muted/20 bg-cover bg-center"
                  style={{
                    aspectRatio: `${artworkAspect}`,
                    backgroundImage: assets?.artworkUrl ? `url(${assets.artworkUrl})` : undefined,
                  }}
                >
                  {([...TEXT_FIELD_KEYS, ...IMAGE_FIELD_KEYS, 'verificationQr'] as FieldKey[]).map(
                    (key) => {
                      const cfg = fields[key];
                      const isSelected = selectedKey === key;
                      const width = 'width' in cfg ? cfg.width : cfg.size;
                      const height = 'height' in cfg ? cfg.height : cfg.size;
                      const isText = key in TEXT_FIELD_LABELS;
                      const textCfg = isText ? (cfg as TextFieldConfig) : null;

                      return (
                        <div
                          key={key}
                          onPointerDown={(event) => handlePointerDown(key, event)}
                          onClick={() => setSelectedKey(key)}
                          className={cn(
                            'absolute flex cursor-move items-center overflow-hidden rounded border-2',
                            isSelected
                              ? 'z-10 border-gold bg-gold/10'
                              : cfg.visible
                                ? 'border-primary/30 bg-primary/5 hover:border-primary/70'
                                : 'border-dashed border-muted-foreground/30 bg-muted/40 opacity-50',
                          )}
                          style={{
                            left: `${cfg.x * 100}%`,
                            top: `${cfg.y * 100}%`,
                            width: `${width * 100}%`,
                            height: `${height * 100}%`,
                            justifyContent: textCfg
                              ? textCfg.align === 'center'
                                ? 'center'
                                : textCfg.align === 'right'
                                  ? 'flex-end'
                                  : 'flex-start'
                              : 'center',
                          }}
                        >
                          {key === 'verificationQr' ? (
                            <span className="w-full truncate px-1 text-center text-[10px] text-muted-foreground">
                              QR
                            </span>
                          ) : isText && textCfg ? (
                            <span
                              className="w-full truncate px-1"
                              style={{
                                fontFamily: CSS_FONT[textCfg.fontFamily],
                                fontSize: `${Math.max(6, ptToPx(textCfg.fontSize, canvasRef.current?.clientWidth ?? 900))}px`,
                                fontWeight: textCfg.fontWeight === 'bold' ? 700 : 400,
                                color: textCfg.color,
                                textAlign: textCfg.align,
                                letterSpacing: `${ptToPx(textCfg.letterSpacing, canvasRef.current?.clientWidth ?? 900)}px`,
                                lineHeight: textCfg.lineHeight,
                              }}
                            >
                              {SAMPLE_TEXT[key as TextFieldKey]}
                            </span>
                          ) : (
                            <span className="w-full truncate px-1 text-center text-[10px] text-muted-foreground">
                              {IMAGE_FIELD_LABELS[key as ImageFieldKey]}
                            </span>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>

                {!readOnly ? (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Drag a field to reposition it, or use the panel to enter exact values.
                    </p>
                    <input
                      ref={artworkInputRef}
                      type="file"
                      accept={ARTWORK_MIME_TYPES.join(',')}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleArtworkFile(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => artworkInputRef.current?.click()}
                      disabled={uploadingArtwork}
                    >
                      {uploadingArtwork ? 'Uploading…' : 'Replace artwork'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fields</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[420px] space-y-1 overflow-y-auto p-3">
              {([...TEXT_FIELD_KEYS, ...IMAGE_FIELD_KEYS, 'verificationQr'] as FieldKey[]).map(
                (key) => {
                  const cfg = fields[key];
                  const label =
                    key === 'verificationQr'
                      ? 'Verification QR'
                      : key in TEXT_FIELD_LABELS
                        ? TEXT_FIELD_LABELS[key as TextFieldKey]
                        : IMAGE_FIELD_LABELS[key as ImageFieldKey];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        selectedKey === key ? 'bg-gold/15 text-gold-hover' : 'hover:bg-muted',
                      )}
                    >
                      <span className={cn(!cfg.visible && 'text-muted-foreground line-through')}>
                        {label}
                      </span>
                      {!cfg.visible ? (
                        <span className="text-[10px] text-muted-foreground">hidden</span>
                      ) : null}
                    </button>
                  );
                },
              )}
            </CardContent>
          </Card>

          {selectedKey ? (
            <Card>
              <CardContent className="p-4">
                {selectedKey === 'verificationQr' ? (
                  <QrFieldPanel
                    cfg={fields.verificationQr}
                    onChange={updateQrField}
                    disabled={readOnly}
                  />
                ) : selectedKey in TEXT_FIELD_LABELS ? (
                  <TextFieldPanel
                    label={TEXT_FIELD_LABELS[selectedKey as TextFieldKey]}
                    cfg={fields[selectedKey as TextFieldKey]}
                    onChange={(patch) => updateTextField(selectedKey as TextFieldKey, patch)}
                    disabled={readOnly}
                  />
                ) : (
                  <ImageFieldPanel
                    label={IMAGE_FIELD_LABELS[selectedKey as ImageFieldKey]}
                    cfg={fields[selectedKey as ImageFieldKey]}
                    onChange={(patch) => updateImageField(selectedKey as ImageFieldKey, patch)}
                    disabled={readOnly}
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

          {(['signature1', 'signature2'] as SignatureSlot[]).map((slot) => (
            <Card key={slot}>
              <CardHeader>
                <CardTitle className="text-sm">{IMAGE_FIELD_LABELS[slot]} details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                {(() => {
                  const signatureUrl =
                    slot === 'signature1' ? assets?.signature1Url : assets?.signature2Url;
                  return signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signatureUrl}
                      alt=""
                      className="h-12 w-auto max-w-full rounded border bg-white p-1"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No signature image uploaded yet.
                    </p>
                  );
                })()}
                {!readOnly ? (
                  <>
                    <input
                      ref={(el) => {
                        signatureInputRefs.current[slot] = el;
                      }}
                      type="file"
                      accept={SIGNATURE_MIME_TYPES.join(',')}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleSignatureFile(slot, file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => signatureInputRefs.current[slot]?.click()}
                      disabled={uploadingSlot === slot}
                    >
                      {uploadingSlot === slot ? 'Uploading…' : 'Upload signature image'}
                    </Button>
                  </>
                ) : null}

                <div className="space-y-1.5">
                  <Label className="text-xs">Signatory name</Label>
                  <Input
                    value={signatoryDrafts[slot].name}
                    disabled={readOnly}
                    onChange={(event) =>
                      setSignatoryDrafts((prev) => ({
                        ...prev,
                        [slot]: { ...prev[slot], name: event.target.value },
                      }))
                    }
                    placeholder="Not configured"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Designation</Label>
                  <Input
                    value={signatoryDrafts[slot].designation}
                    disabled={readOnly}
                    onChange={(event) =>
                      setSignatoryDrafts((prev) => ({
                        ...prev,
                        [slot]: { ...prev[slot], designation: event.target.value },
                      }))
                    }
                    placeholder="Not configured"
                  />
                </div>
                {!readOnly ? (
                  <Button
                    size="sm"
                    onClick={() => handleSaveSignatory(slot)}
                    disabled={savingSlot === slot}
                  >
                    {savingSlot === slot ? 'Saving…' : 'Save signatory'}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ready to activate?</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {validation.ok ? (
                <p className="text-sm text-status-success">All required fields are configured.</p>
              ) : (
                <ul className="space-y-1 text-xs text-status-danger">
                  {validation.errors.map((error) => (
                    <li key={error}>• {error}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
