import type { ComponentProps } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * The URL when it is safe to put in a link, otherwise null. Parsing (not pattern matching) means
 * `java\nscript:`, padded and mixed-case schemes are judged by what the browser would run.
 * Relative and protocol-less URLs are refused: model text has no page to be relative to.
 */
export function safeUrl(url: string): string | null {
  try {
    return LINK_PROTOCOLS.has(new URL(url.trim()).protocol) ? url.trim() : null;
  } catch {
    return null;
  }
}

const components: Components = {
  a({ href, children }) {
    const url = href ? safeUrl(href) : null;
    if (!url) return <span>{children}</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  // A remote image is a tracking channel (the URL can carry the conversation), so none is ever loaded.
  img({ alt }) {
    return alt ? <span className="text-muted-foreground italic">[{alt}]</span> : null;
  },
  h1: (p) => <h3 className="mt-4 mb-2 text-lg font-semibold first:mt-0">{p.children}</h3>,
  h2: (p) => <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0">{p.children}</h3>,
  h3: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{p.children}</h4>,
  h4: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{p.children}</h4>,
  h5: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{p.children}</h4>,
  h6: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{p.children}</h4>,
  p: (p) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{p.children}</p>,
  ul: (p) => <ul className="my-2 list-disc space-y-1 pl-5">{p.children}</ul>,
  ol: (p) => <ol className="my-2 list-decimal space-y-1 pl-5">{p.children}</ol>,
  blockquote: (p) => (
    <blockquote className="text-muted-foreground my-2 border-l-2 pl-3">{p.children}</blockquote>
  ),
  hr: () => <hr className="my-3" />,
  pre: (p) => (
    <pre className="bg-muted my-2 overflow-x-auto rounded-lg p-3 text-sm">{p.children}</pre>
  ),
  code: (p) => (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em] [pre_&]:bg-transparent [pre_&]:p-0">
      {p.children}
    </code>
  ),
  table: (p) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{p.children}</table>
    </div>
  ),
  th: (p) => <th className="bg-muted border px-2.5 py-1.5 text-left font-medium">{p.children}</th>,
  td: (p) => <td className="border px-2.5 py-1.5 align-top">{p.children}</td>,
};

/**
 * Markdown from the assistant. Safe by construction (AC6): raw HTML is dropped, remote images never
 * load, and links open in a new tab only for http, https and mailto. GFM adds tables and task lists.
 */
export function MarkdownView({
  children,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & { children: string }) {
  return (
    <div className={cn('text-sm break-words', className)} {...props}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => safeUrl(url) ?? ''}
        components={components}
      >
        {children}
      </Markdown>
    </div>
  );
}
