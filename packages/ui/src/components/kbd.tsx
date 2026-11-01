export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-card text-foreground rounded-md border border-b-2 px-2 py-0.5 font-sans text-xs font-medium tracking-wide">
      {children}
    </kbd>
  );
}
