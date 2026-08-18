/** Public API of the settings feature (Doc 02 §3). */
export { BrandingSettingsForm } from './components/branding-settings-form';
export { GeneralSettingsForm } from './components/general-settings-form';
export { IdFormatsForm } from './components/id-formats-form';
export { getBrandingSettings, getGeneralSettings, getIdFormats } from './queries';
export type { BrandingSettings, GeneralSettings, IdFormatsSettings } from './schema';
