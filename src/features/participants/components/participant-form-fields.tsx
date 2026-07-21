'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { GENDERS } from '../schema';

const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
};

/**
 * The personal / contact / parent-guardian field set, shared by the create
 * dialog and the edit form so the two can never drift apart.
 */
export interface ParticipantFormValues {
  fullName: string;
  dob: string;
  gender?: (typeof GENDERS)[number] | undefined;
  phone: string;
  email?: string | undefined;
  address?: string | undefined;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  parentName?: string | undefined;
  parentPhone?: string | undefined;
}

function FieldError({ message }: { message?: string | undefined }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function ParticipantFormFields<T extends ParticipantFormValues>({
  register,
  errors,
  defaultGender,
  onGenderChange,
  idPrefix,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  defaultGender: string | undefined;
  onGenderChange: (value: string) => void;
  idPrefix: string;
}) {
  // react-hook-form's generic register path type doesn't narrow through the
  // constraint, so field names are asserted once here rather than at each use.
  const field = (name: keyof ParticipantFormValues) =>
    register(name as Parameters<UseFormRegister<T>>[0]);
  const errorOf = (name: keyof ParticipantFormValues): string | undefined => {
    const entry = (errors as FieldErrors<ParticipantFormValues>)[name];
    return typeof entry?.message === 'string' ? entry.message : undefined;
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Personal information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-fullName`} required>
              Full name
            </Label>
            <Input id={`${idPrefix}-fullName`} {...field('fullName')} />
            <FieldError message={errorOf('fullName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-dob`} required>
              Date of birth
            </Label>
            <Input id={`${idPrefix}-dob`} type="date" {...field('dob')} />
            <FieldError message={errorOf('dob')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-gender`}>Gender</Label>
            <Select
              {...(defaultGender ? { defaultValue: defaultGender } : {})}
              onValueChange={onGenderChange}
            >
              <SelectTrigger id={`${idPrefix}-gender`}>
                <SelectValue placeholder="Not specified" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {GENDER_LABELS[gender]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Contact information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`} required>
              Phone
            </Label>
            <Input id={`${idPrefix}-phone`} placeholder="+919876543210" {...field('phone')} />
            <FieldError message={errorOf('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-email`}>Email</Label>
            <Input id={`${idPrefix}-email`} type="email" {...field('email')} />
            <FieldError message={errorOf('email')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-address`}>Address</Label>
            <Input id={`${idPrefix}-address`} {...field('address')} />
            <FieldError message={errorOf('address')} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Emergency contact</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-ecName`} required>
              Name
            </Label>
            <Input id={`${idPrefix}-ecName`} {...field('emergencyContactName')} />
            <FieldError message={errorOf('emergencyContactName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-ecPhone`} required>
              Phone
            </Label>
            <Input
              id={`${idPrefix}-ecPhone`}
              placeholder="+919876543210"
              {...field('emergencyContactPhone')}
            />
            <FieldError message={errorOf('emergencyContactPhone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-ecRelation`} required>
              Relation
            </Label>
            <Input
              id={`${idPrefix}-ecRelation`}
              placeholder="Parent, Guardian…"
              {...field('emergencyContactRelation')}
            />
            <FieldError message={errorOf('emergencyContactRelation')} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Parent / guardian</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-parentName`}>Name</Label>
            <Input id={`${idPrefix}-parentName`} {...field('parentName')} />
            <FieldError message={errorOf('parentName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-parentPhone`}>Phone</Label>
            <Input
              id={`${idPrefix}-parentPhone`}
              placeholder="+919876543210"
              {...field('parentPhone')}
            />
            <FieldError message={errorOf('parentPhone')} />
          </div>
        </div>
      </section>
    </div>
  );
}
