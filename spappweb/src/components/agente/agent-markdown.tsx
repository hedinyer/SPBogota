"use client";

import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold tracking-tight text-balance first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold tracking-tight text-balance first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-medium first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed text-pretty last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-sm">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium underline underline-offset-2"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ className, children }) => {
    const block = Boolean(className);
    if (block) {
      return (
        <code className="block overflow-x-auto p-3 font-mono text-xs leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.8em]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-muted">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full min-w-md border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left text-xs font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-border px-2.5 py-1.5 align-top tabular-nums">
      {children}
    </td>
  ),
};

export function AgentMarkdown({ children }: { children: string }) {
  return (
    <div className="max-w-[65ch]">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
