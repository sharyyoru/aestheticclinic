"use client";

import { useEffect, useState } from "react";

export type DocsTocItem = { id: string; heading: string };

export default function DocsTableOfContents({ items }: { items: DocsTocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <aside className="hidden w-60 shrink-0 xl:block">
      <div className="sticky top-[89px] max-h-[calc(100vh-120px)] overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">On this page</p>
        <ul className="mt-3 space-y-1 border-l border-slate-200">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`-ml-px block border-l py-1 pl-3 text-sm transition ${
                  activeId === item.id
                    ? "border-sky-500 font-medium text-sky-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {item.heading}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
