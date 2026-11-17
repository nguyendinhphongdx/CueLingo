/** A keyboard shortcut: mono face, small radius, a 2px bottom edge for depth. Put it beside the action it triggers. */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-card text-foreground text-mono rounded-sm border border-b-2 px-1.5 py-0.5">
      {children}
    </kbd>
  );
}
