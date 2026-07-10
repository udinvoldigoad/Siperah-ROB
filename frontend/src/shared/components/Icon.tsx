export function Icon({ name, style, className = "" }: { name: string; style?: React.CSSProperties; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={style} aria-hidden="true">{name}</span>;
}
