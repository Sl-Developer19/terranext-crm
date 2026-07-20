import { redirect } from 'next/navigation';

/** Root entry: middleware guarantees a session here, so land on the dashboard. */
export default function RootPage() {
  redirect('/dashboard');
}
