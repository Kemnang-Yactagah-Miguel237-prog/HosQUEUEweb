interface LogoProps { size?: 'sm' | 'md' | 'lg'; inverted?: boolean; }

export default function Logo({ size = 'md', inverted = false }: LogoProps) {
  const sizes = {
    sm: { image: 'h-9 w-9', text: 'text-lg', sub: 'text-[10px]' },
    md: { image: 'h-11 w-11', text: 'text-2xl', sub: 'text-xs' },
    lg: { image: 'h-28 w-28', text: 'text-4xl', sub: 'text-sm' },
  };
  const currentSize = sizes[size];

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className={`${currentSize.image} rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold ${inverted ? 'text-white bg-white/15' : ''}`} aria-hidden="true">+</div>
      <div>
        <div className={`${currentSize.text} font-serif leading-none ${inverted ? 'text-white' : 'text-foreground'}`}>
          Hos<span className="text-primary">QUEUE</span>
        </div>
        <div className={`${currentSize.sub} font-mono tracking-widest uppercase opacity-60 ${inverted ? 'text-white' : 'text-foreground'}`}>
          Queue Management
        </div>
      </div>
    </div>
  );
}
