/** Public API of the settings feature (Doc 02 §3). */
export { GeneralSettingsForm } from './components/general-settings-form';
export { IdFormatsForm } from './components/id-formats-form';
export { getGeneralSettings, getIdFormats } from './queries';
export type { GeneralSettings, IdFormatsSettings } from './schema';
