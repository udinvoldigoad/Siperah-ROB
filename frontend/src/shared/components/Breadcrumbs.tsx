import { Icon } from "./Icon";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} aria-current={isLast ? "page" : undefined}>
              {item.href && !isLast ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span>{item.label}</span>
              )}
              {!isLast && <Icon name="chevron_right" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
