'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TEMPLATE_FONT_FAMILIES } from '../schema';
import type {
  ImageFieldConfig,
  QrFieldConfig,
  TemplateFontFamily,
  TextFieldConfig,
} from '../schema';

const PCT = (fraction: number) => Math.round(fraction * 1000) / 10;
const FROM_PCT = (pct: number) => Math.max(0, Math.min(1, pct / 100));

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.5,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-sm"
      />
    </div>
  );
}

/** Common position/size fields shared by every field kind (stored as 0–1 fractions, edited as %). */
function GeometryFields<T extends { x: number; y: number; width: number; height: number }>({
  cfg,
  onChange,
  disabled,
}: {
  cfg: T;
  onChange: (patch: Partial<T>) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label="X %"
        value={PCT(cfg.x)}
        onChange={(v) => onChange({ x: FROM_PCT(v) } as Partial<T>)}
        disabled={disabled}
      />
      <NumberField
        label="Y %"
        value={PCT(cfg.y)}
        onChange={(v) => onChange({ y: FROM_PCT(v) } as Partial<T>)}
        disabled={disabled}
      />
      <NumberField
        label="Width %"
        value={PCT(cfg.width)}
        onChange={(v) => onChange({ width: FROM_PCT(v) } as Partial<T>)}
        disabled={disabled}
      />
      <NumberField
        label="Height %"
        value={PCT(cfg.height)}
        onChange={(v) => onChange({ height: FROM_PCT(v) } as Partial<T>)}
        disabled={disabled}
      />
    </div>
  );
}

export function TextFieldPanel({
  label,
  cfg,
  onChange,
  disabled,
}: {
  label: string;
  cfg: TextFieldConfig;
  onChange: (patch: Partial<TextFieldConfig>) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={cfg.visible}
            disabled={disabled}
            onChange={(event) => onChange({ visible: event.target.checked })}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Visible
        </label>
      </div>

      <GeometryFields cfg={cfg} onChange={onChange} disabled={disabled} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Font</Label>
          <Select
            value={cfg.fontFamily}
            onValueChange={(v) => onChange({ fontFamily: v as TemplateFontFamily })}
          >
            <SelectTrigger className="h-8 text-sm" disabled={disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_FONT_FAMILIES.map((font) => (
                <SelectItem key={font} value={font}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <NumberField
          label="Size"
          value={cfg.fontSize}
          min={4}
          max={400}
          step={1}
          onChange={(v) => onChange({ fontSize: v })}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Weight</Label>
          <Select
            value={cfg.fontWeight}
            onValueChange={(v) => onChange({ fontWeight: v as 'normal' | 'bold' })}
          >
            <SelectTrigger className="h-8 text-sm" disabled={disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Align</Label>
          <Select
            value={cfg.align}
            onValueChange={(v) => onChange({ align: v as 'left' | 'center' | 'right' })}
          >
            <SelectTrigger className="h-8 text-sm" disabled={disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Colour</Label>
          <input
            type="color"
            value={cfg.color}
            disabled={disabled}
            onChange={(event) => onChange({ color: event.target.value })}
            className="h-8 w-full rounded-md border border-input"
          />
        </div>
        <NumberField
          label="Line height"
          value={cfg.lineHeight}
          min={0.5}
          max={4}
          step={0.1}
          onChange={(v) => onChange({ lineHeight: v })}
          disabled={disabled}
        />
        <NumberField
          label="Letter spacing"
          value={cfg.letterSpacing}
          min={-5}
          max={50}
          step={0.5}
          onChange={(v) => onChange({ letterSpacing: v })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ImageFieldPanel({
  label,
  cfg,
  onChange,
  disabled,
}: {
  label: string;
  cfg: ImageFieldConfig;
  onChange: (patch: Partial<ImageFieldConfig>) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={cfg.visible}
            disabled={disabled}
            onChange={(event) => onChange({ visible: event.target.checked })}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Visible
        </label>
      </div>

      <GeometryFields cfg={cfg} onChange={onChange} disabled={disabled} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Fit</Label>
          <Select
            value={cfg.objectFit}
            onValueChange={(v) => onChange({ objectFit: v as 'contain' | 'cover' })}
          >
            <SelectTrigger className="h-8 text-sm" disabled={disabled}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Contain (no crop)</SelectItem>
              <SelectItem value="cover">Cover (fills box)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NumberField
          label="Opacity %"
          value={Math.round(cfg.opacity * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(v) => onChange({ opacity: Math.max(0, Math.min(1, v / 100)) })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function QrFieldPanel({
  cfg,
  onChange,
  disabled,
}: {
  cfg: QrFieldConfig;
  onChange: (patch: Partial<QrFieldConfig>) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Verification QR</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={cfg.visible}
            disabled={disabled}
            onChange={(event) => onChange({ visible: event.target.checked })}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Visible
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label="X %"
          value={PCT(cfg.x)}
          onChange={(v) => onChange({ x: FROM_PCT(v) })}
          disabled={disabled}
        />
        <NumberField
          label="Y %"
          value={PCT(cfg.y)}
          onChange={(v) => onChange({ y: FROM_PCT(v) })}
          disabled={disabled}
        />
        <NumberField
          label="Size %"
          value={PCT(cfg.size)}
          onChange={(v) => onChange({ size: FROM_PCT(v) })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
