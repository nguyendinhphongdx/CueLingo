/** Keeps the signed-in landing-page decision small and independently testable. */
export function redirectSignedInVisitor(
  session: unknown,
  isPending: boolean,
  router: { replace: (href: string) => void },
) {
  if (!isPending && session) router.replace('/sessions');
}
