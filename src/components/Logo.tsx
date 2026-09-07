interface LogoProps { size?: 'sm' | 'md' | 'lg'; inverted?: boolean; }

export default function Logo({ size = 'md', inverted = false }: LogoProps) {
  const sizes = {
    sm: 'h-10 w-36',
    md: 'h-14 w-52',
    lg: 'h-20 w-72',
  };
  const currentSize = sizes[size];

  return (
    <div className={`${currentSize} overflow-hidden rounded-lg bg-white select-none`} role="img" aria-label="HosQueue Hospital Management System">
      <img src="/hosqueue-logo.png" alt="HosQueue Hospital Management System" className="h-full w-full object-cover object-center" />
    </div>
  );
}
