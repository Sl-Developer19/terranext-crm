/** Public API of the certificates feature (Doc 02 §3). */
export { CertificateRegistry } from './components/certificate-registry';
export { EligibilityQueue } from './components/eligibility-queue';
export { listCertificates, listEligibilityQueue } from './queries';
export { evaluateEligibility, buildCertificateVerifyUrl } from './logic';
export { issueCertificateDownloadUrl } from './actions/manage-certificate';
export type { Certificate, EligibilityRow, VerificationResult } from './schema';
