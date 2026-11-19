import Image from "next/image";

export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={64}
      priority
      src="/brand-mark.png"
      width={64}
    />
  );
}
