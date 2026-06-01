import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, BadgeCheck } from "lucide-react";
import { incrementPartnerImpressionFn, incrementPartnerClickFn } from "@/lib/partners.functions";

/** Session-scoped dedupe so impressions only fire once per partner per tab. */
function impressionKey(id: string) {
  return `partner-impression:${id}`;
}

export function PartnerStopBlock({
  partnerId,
  logoUrl,
  website,
  variant = "list",
}: {
  partnerId?: string;
  logoUrl?: string;
  website?: string;
  variant?: "list" | "roadbook";
}) {
  const incImpression = useServerFn(incrementPartnerImpressionFn);
  const incClick = useServerFn(incrementPartnerClickFn);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!partnerId || firedRef.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(impressionKey(partnerId))) return;
    firedRef.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(impressionKey(partnerId), "1");
    incImpression({ data: { partnerId } }).catch(() => {});
  }, [partnerId, incImpression]);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!partnerId) return;
    e.stopPropagation();
    incClick({ data: { partnerId } }).catch(() => {});
  };

  const label = variant === "roadbook" ? "Anbefalt av Veiglede" : "Anbefalt partner";

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {logoUrl && (
        <img src={logoUrl} alt="" className="h-5 w-5 rounded object-cover bg-surface-2" />
      )}
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
        <BadgeCheck className="h-3 w-3" /> {label}
      </span>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={onClick}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Besøk nettside <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
