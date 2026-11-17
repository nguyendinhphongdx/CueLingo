/** The shared tokens switch on `.dark`; this keeps that class in step with the browser's preferred appearance. */
export function followColorScheme(): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', query.matches);
  apply();
  query.addEventListener('change', apply);
}
