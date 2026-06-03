import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  useTripsStore, tripsApi, stopMeta, stopDisplayMeta, STOP_TYPES, vehicleMeta, styleMeta,
  COVERS, type CoverKey, fetchRouteSuggestions, getPartnerTips, getPhotoMemories,
  LODGING_PLACE_TYPES, looksLikeLodging,
  type SuggestedStop, type PartnerTip,
} from "@/lib/trips-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { getVehicleById, energyMeta, useVehicles, energyTypeToSource } from "@/lib/vehicles-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTripTracking, statusMeta } from "@/lib/trip-tracking";
import { TripMap } from "@/components/TripMap";
import { TripTimeBudget } from "@/components/TripTimeBudget";
import { TripOverview } from "@/components/TripOverview";
import { BookingInfo } from "@/components/BookingInfo";
import { projectTrip, suggestionRouteInfo, lookupPlace } from "@/lib/geo";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";
import { ShareTripModal } from "@/components/ShareTripModal";
import { OpenInMaps } from "@/components/OpenInMaps";
import { TripCompanions } from "@/components/TripCompanions";
import { TripMembers } from "@/components/TripMembers";
import { SaveTripPrompt } from "@/components/SaveTripPrompt";
import { TripReactionsRow } from "@/components/TripReactionsRow";
import { useAuth } from "@/lib/auth";
import { TripTracker } from "@/components/TripTracker";
import { TripMemories } from "@/components/TripMemories";
import { TripPhotosGallery } from "@/components/TripPhotosGallery";
import { DetourPromptDialog } from "@/components/DetourPromptDialog";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { PackingList } from "@/components/PackingList";
import { DayWeather } from "@/components/DayWeather";
import { dayDate, dayCoords } from "@/lib/weather";
import type { ResolvedPlace } from "@/lib/places/geocoder";
import { EditTripSheet } from "@/components/EditTripSheet";
import {
  Plus, Trash2, ArrowLeft, BookOpen, Clock, MapPin, Route as RouteIcon,
  Camera, Sparkles, Share2, ChevronUp, ChevronDown, Info, Star, Tag, Image as ImageIcon,
  Navigation, CornerDownRight, Check, Pencil, MoreHorizontal, Copy, BedDouble, ArrowRightLeft,
  Ship,
} from "lucide-react";
import { toast } from "sonner";
import { flushTripsNow } from "@/lib/cloud-sync";
import { Globe, Lock } from "lucide-react";
import { PartnerStopBlock } from "@/components/PartnerStopBlock";
import { useT } from "@/i18n/provider";


export const Route = createFileRoute("/_app/trips/$tripId")({
  head: () => ({ meta: [{ title: "Tur — Veiglede" }] }),
  component: TripPlanner,
});

function TripPlanner() {
  const { tripId } = Route.useParams();
  const t = useT();
  const td = t.app.tripDetail;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { trips, days, stops } = useTripsStore();
  const prefs = useDriverPrefs();
  const tracking = useTripTracking(tripId);
  const trackMeta = statusMeta(tracking.status);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shareOpen, setShareOpenRaw] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const setShareOpen = (v: boolean) => { if (v && !user) { setSavePromptOpen(true); return; } setShareOpenRaw(v); };

  const trip = trips.find((t) => t.id === tripId);

  const tripDays = trip ? days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber) : [];
  const tripStops = trip ? stops.filter((st) => tripDays.some((d) => d.id === st.dayId)) : [];

  // Project the trip so suggestions can be measured against the route polyline.
  // NOTE: these hooks must run on every render — never put hooks behind an early return.
  const projection = useMemo(
    () => (trip ? projectTrip(trip, tripDays, tripStops) : null),
    [trip, tripDays, tripStops],
  );
  const routePoints = useMemo(
    () => (trip?.routeGeometry && trip.routeGeometry.length > 1
      ? trip.routeGeometry
      : projection
        ? [projection.origin, ...projection.mapped.map((m) => m.loc), projection.destination]
        : []),
    [projection, trip?.routeGeometry],
  );
  const mergedInterests = trip
    ? Array.from(new Set([...(getVehicleById(trip.vehicleId)?.stopInterests ?? []), ...prefs.stopInterests]))
    : [];
  const [suggestions, setSuggestions] = useState<SuggestedStop[]>([]);
  useEffect(() => {
    if (!trip) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    fetchRouteSuggestions(trip, mergedInterests, ctrl.signal)
      .then((s) => setSuggestions(s))
      .catch((err) => {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.warn("[trip] fetchRouteSuggestions failed", err);
        }
        setSuggestions([]);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.routeGeometry, mergedInterests.join(",")]);

  // Map → list: scroll a stop card into view when its map pin is clicked.
  useEffect(() => {
    const onScroll = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id) return;
      const el = document.getElementById(`stop-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
    };
    window.addEventListener("trip:scroll-to-stop", onScroll);
    return () => window.removeEventListener("trip:scroll-to-stop", onScroll);
  }, []);

  // Retroactive lodging detection: if the final "Ankomst {…}" destination
  // stop is named after a known hotel chain or has lodging placeTypes,
  // upgrade its type to "lodging" so the booking prompt appears.
  useEffect(() => {
    if (!trip) return;
    for (const day of tripDays) {
      const dayStops = tripStops
        .filter((s) => s.dayId === day.id)
        .sort((a, b) => a.order - b.order);
      const last = dayStops[dayStops.length - 1];
      if (!last) continue;
      if (last.type === "lodging") continue;
      const isAnkomst = last.name.toLowerCase().startsWith("ankomst ");
      const matchName = isAnkomst && looksLikeLodging(last.name.slice("ankomst ".length), last.placeTypes);
      const matchTypes = last.placeTypes?.some((t) => LODGING_PLACE_TYPES.includes(t));
      if (matchName || matchTypes) {
        tripsApi.updateStop(last.id, { type: "lodging" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, tripStops.length]);

  const enrichedSuggestions = useMemo(
    () => suggestions.map((sug: SuggestedStop) => ({ sug, info: suggestionRouteInfo(sug, routePoints) })),
    [suggestions, routePoints],
  );
  const suggestionPins = useMemo(
    () =>
      enrichedSuggestions
        .filter((e: { info: { loc?: { lat: number; lng: number } } }) => e.info.loc)
        .map((e: { sug: SuggestedStop; info: { loc?: { lat: number; lng: number } } }) => ({
          id: e.sug.id,
          name: e.sug.name,
          loc: e.info.loc!,
          emoji: stopMeta(e.sug.type).emoji,
        })),
    [enrichedSuggestions],
  );

  if (pathname !== `/trips/${tripId}`) {
    return <Outlet />;
  }

  if (!trip) {
    return (
      <div className="py-12 text-center">
        <p className="font-display text-2xl uppercase">{td.notFound}</p>
        <Link to="/trips" className="mt-4 inline-block text-sm text-primary underline">{td.backToMyTrips}</Link>
      </div>
    );
  }

  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const vehicle = getVehicleById(trip.vehicleId);
  const em = trip.energy ? energyMeta(trip.energy) : undefined;
  const vehicleDisplay = trip.vehicleName ?? v.label;
  const totalStops = tripStops.length;
  const selectedStop = selectedStopId ? tripStops.find((stop) => stop.id === selectedStopId) ?? null : null;
  const partnerTips = getPartnerTips(trip, routePoints);
  const memories = getPhotoMemories(trip, tripStops);


  // Pin click in the map should NOT scroll the page or change list selection.
  // The popup on the pin is the only visible feedback. Selection state is left
  // alone so the list does not re-render or steal focus.
  const handleSelectStop = (_id: string | null) => {
    // intentionally no-op: see MapLibreTripMap pin click handler.
  };


  return (
    <div className="py-4">
      <DemoDebugPanel
        title="Planner debug"
        items={[
          { label: "Route", value: `/trips/${tripId}` },
          { label: "Trip", value: trip.id },
          { label: "Days", value: tripDays.length },
          { label: "Stops", value: totalStops },
          { label: "Selected", value: selectedStop?.id ?? "—" },
          { label: "Placement", value: selectedStop?.placement ?? "—" },
          { label: "Status", value: selectedStop?.routeStatus ?? "—" },
          { label: "Stop coords", value: selectedStop?.lat != null && selectedStop?.lng != null ? `${selectedStop.lat.toFixed(4)}, ${selectedStop.lng.toFixed(4)}` : (selectedStop?.location ?? "—") },
          { label: "Dist from route", value: selectedStop?.distanceFromRouteKm != null ? `${selectedStop.distanceFromRouteKm} km` : "—" },
          { label: "Extra", value: selectedStop?.extraDistanceKm != null ? `+${selectedStop.extraDistanceKm} km` : "—" },
          { label: "Route provider", value: trip.routeProvider ?? "—" },
          { label: "Geometry pts", value: trip.routeGeometry?.length ?? 0 },
          { label: "Waypoints hash", value: (trip.routeWaypointsHash ?? "—").slice(0, 24) },
          { label: "On-route stops", value: tripStops.filter((s) => (s.routeStatus ?? "on-route") === "on-route" && s.lat != null).length },
          { label: "Detour stops", value: tripStops.filter((s) => s.routeStatus === "detour").length },
          { label: "Route dist", value: trip.routeDistanceKm != null ? `${trip.routeDistanceKm} km` : "—" },
          { label: "Route time", value: trip.routeDurationMin != null ? `${trip.routeDurationMin} min` : "—" },
        ]}
      />

      {trip.status === "draft" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span className="flex-1 min-w-0">
            {td.draftBanner}
          </span>
          <button
            type="button"
            onClick={() => { tripsApi.updateTrip(trip.id, { status: "saved" }); toast.success(td.tripSavedToast); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-amber-950 hover:brightness-110 shadow-lg shadow-amber-400/20"
          >
            <Check className="h-3.5 w-3.5" /> {td.saveTrip}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {td.myTripsLink}
        </Link>
        {trip.status !== "draft" && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Check className="h-3 w-3 text-primary" /> {td.savedBadge}
          </span>
        )}
      </div>


      {/* Hero cover */}
      <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-5 md:p-8`}>
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,180 C80,160 120,80 200,100 C280,120 320,40 400,60" fill="none" stroke="oklch(0.78 0.17 65 / 0.6)" strokeWidth="2" />
        </svg>
        <div className="relative">
          <div className="flex flex-wrap gap-2">
            <VehiclePickerBadge
              tripId={trip.id}
              currentVehicleId={trip.vehicleId}
              vehicleEmoji={v.emoji}
              vehicleLabel={vehicleDisplay}
              energyEmoji={em?.emoji}
              energyLabel={em?.label}
            />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">
              {s.emoji} {s.label}
            </span>
            {trip.region && <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{trip.region}</span>}
            <span className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur border px-3 py-1 text-xs font-semibold bg-background/60 ${trackMeta.cls}`}>{trackMeta.emoji} {trackMeta.label}</span>
            <TripMembers tripId={trip.id} onOpenShare={() => setShareOpen(true)} />
          </div>
          <div className="mt-5 flex items-start gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
            {user && (
              <button
                onClick={() => setEditOpen(true)}
                title={td.editTrip}
                aria-label={td.editTrip}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
              >
                <Pencil className="h-3.5 w-3.5" /> {td.editTrip}
              </button>
            )}
            {user && (
              <button
                onClick={() => {
                  const next = !(trip.isPublic ?? false);
                  if (next && !trip.shareToken) tripsApi.ensureShareToken(trip.id);
                  tripsApi.setTripPublic(trip.id, next);
                  void flushTripsNow();
                  toast.success(next ? td.publicToast : td.privateToast);
                }}
                title={td.publicTooltip}
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  trip.isPublic
                    ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                    : "border-border bg-background/60 hover:border-primary hover:text-primary"
                }`}
              >
                {trip.isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {trip.isPublic ? td.publicLabel : td.privateLabel}
              </button>
            )}
          </div>
          {trip.subtitle && <p className="mt-2 text-sm md:text-base text-foreground/80">{trip.subtitle}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
        </div>
      </section>

      {/* Stat row */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <BigStat icon={<RouteIcon className="h-4 w-4" />} label={td.distance} value={`${trip.distanceKm} km`} />
        <BigStat icon={<Clock className="h-4 w-4" />} label={td.drivingTime} value={trip.drivingTime} />
        <BigStat icon={<Camera className="h-4 w-4" />} label={td.stops} value={String(totalStops)} />
      </section>

      {/* Map */}
      <section className="mt-4">
        <TripMap
          trip={trip}
          days={tripDays}
          stops={tripStops}
          selectedStopId={selectedStopId}
          onSelectStop={handleSelectStop}
          suggestionPins={suggestionPins}
          hoveredSuggestionId={null}
          height="h-72 md:h-[520px]"
        />
        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
          {td.mapDisclaimer}
        </p>
        <DetourTotals trip={trip} stops={tripStops} />
      </section>


      {/* Planning actions — flexible trip model */}
      <PlannerActions trip={trip} tripDays={tripDays} tripStops={tripStops} maxDrivingHours={prefs.maxDrivingHours} />


      {/* Time budget */}
      <section className="mt-4">
        <TripTimeBudget trip={trip} days={tripDays} stops={tripStops} showPerDay title={td.tripBudget} />
      </section>

      {/* OVERSIKT — at-a-glance timeline + per-day cost */}
      <section id="overview" className="mt-6 scroll-mt-24">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl uppercase">{td.overview.title}</h2>
          <p className="text-[11px] text-muted-foreground">{td.overview.jumpHint}</p>
        </div>
        <TripOverview trip={trip} days={tripDays} stops={tripStops} />
      </section>





      {/* AI explanation */}
      {trip.aiSummary && (
        <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
              <Sparkles className="h-4 w-4" /> {td.aiCopilot}
            </p>
            <span className="text-[10px] uppercase tracking-wider rounded-full border border-primary/30 bg-background/40 px-2 py-0.5 text-primary">
              {td.profileMatched(prefs.stopInterests.length)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
        </section>
      )}

      {/* Primary actions */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/trips/$tripId/roadbook" params={{ tripId }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <BookOpen className="h-4 w-4" /> {td.openRoadbook}
        </Link>
        <button
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2 hover:border-primary">
          <Share2 className="h-4 w-4" /> {td.shareTrip}
        </button>
        <OpenInMaps
          origin={trip.origin}
          destination={trip.destination}
          tripTitle={trip.title}
          distanceKm={trip.distanceKm}
          stops={tripDays.flatMap((d) =>
            tripStops
              .filter((s) => s.dayId === d.id)
              .sort((a, b) => a.order - b.order)
          )}
        />
      </section>

      {trip.isPublic && (
        <section className="mt-4">
          <TripReactionsRow tripId={trip.id} />
        </section>
      )}

      <ShareTripModal trip={trip} open={shareOpen} onOpenChange={setShareOpenRaw} />
      <EditTripSheet trip={trip} open={editOpen} onOpenChange={setEditOpen} />
      <SaveTripPrompt open={savePromptOpen} onOpenChange={setSavePromptOpen} title={td.saveAndSharePromptTitle} description={td.saveAndSharePromptBody} redirectTo={`/trips/${tripId}`} />

      <section className="mt-4">
        <TripCompanions tripId={tripId} onInvite={() => setShareOpen(true)} />
      </section>

      {/* Trip tracking */}
      <section id="track" className="mt-4 scroll-mt-24">
        <TripTracker tripId={tripId} tripStops={tripStops} vehicleLabel={`${v.emoji} ${vehicleDisplay}`} />
      </section>

      {/* Memories (after completion) */}
      <TripMemories trip={trip} tripStops={tripStops} onShare={() => setShareOpen(true)} />

      {/* Quick-jump pills */}
      <nav className="mt-4 -mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto pb-1">
        {[
          { href: "#track", label: td.jumpLive },
          { href: "#overview", label: td.overview.title },
          { href: "#days", label: td.jumpDays },
          { href: "#packing", label: td.jumpPacking },
          { href: "#along", label: td.jumpAlong },
          { href: "#photos", label: td.jumpPhotos },
          { href: "#tips", label: td.jumpTips },
          { href: "#practical", label: td.jumpPractical },
        ].map((p) => (
          <a key={p.href} href={p.href}
            className="shrink-0 inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary">
            {p.label}
          </a>
        ))}
      </nav>

      {/* Days */}
      <section id="days" className="mt-8 scroll-mt-24">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase">{td.dayByDay}</h2>
          <button onClick={() => tripsApi.addDay(tripId)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs uppercase tracking-wider hover:border-primary">
            <Plus className="h-3.5 w-3.5" /> {td.addDay}
          </button>
        </div>

        <ol className="mt-4 space-y-4">
          {tripDays.map((day, dayIdx) => {
            const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
            return (
              <DayCard
                key={day.id}
                day={day}
                dayIdx={dayIdx}
                totalDays={tripDays.length}
                allDays={tripDays}
                dayStops={dayStops}
                trip={trip}
                tripId={tripId}
                userId={user?.id}
                selectedStopId={selectedStopId}
                onLightbox={setLightboxUrl}
                td={td}
                onAddStopType={(typeValue, typeLabel) => {
                  const stop = tripsApi.addStop(day.id, { type: typeValue, name: td.newStopPrefix(typeLabel) });
                  if (typeValue === "lodging") {
                    toast.success("Vi registrerte dette som overnatting — fyll inn booking-detaljer");
                  }
                  navigate({ to: "/trips/$tripId/stops/$stopId", params: { tripId, stopId: stop.id } });
                }}
              />
            );
          })}
        </ol>
      </section>

      {/* Packing list */}
      <PackingList trip={trip} stopTypes={tripStops.map((s) => s.type)} />

      {/* Suggested along the route */}
      <section id="along" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{td.suggestedEyebrow}</p>
            <h2 className="mt-1 font-display text-2xl uppercase">{td.alongRouteTitle}</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">{td.tapToAdd}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{td.tailoredFor(vehicleDisplay, em ? em.label.toLowerCase() : "", s.label.toLowerCase())}</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {enrichedSuggestions.map(({ sug, info }: { sug: SuggestedStop; info: ReturnType<typeof suggestionRouteInfo> }) => (
            <SuggestionCard
              key={sug.id}
              sug={sug}
              detourMin={info.detourMin}
              distanceFromRouteKm={info.distanceFromRouteKm}
              extraDistanceKm={info.extraDistanceKm}
              off={info.off}
              vehicleDisplay={vehicleDisplay}
              styleLabel={s.label}
              tripDays={tripDays}
              tripDestination={trip.destination}
              onAdd={(placement, dayId) => {
                const added = tripsApi.addSuggestionAt(tripId, sug, placement, dayId, info);
                if (added) {
                  const status = added.routeStatus ?? "—";
                  const coords = added.lat != null && added.lng != null
                    ? `${added.lat.toFixed(3)},${added.lng.toFixed(3)}`
                    : "(no coords)";
                  // Temporary debug toast — verifies waypoint reaches the routing engine.
                  // eslint-disable-next-line no-console
                  console.info("[veiglede] added stop", { name: added.name, status, placement, coords });
                  if (placement === "along") {
                    toast(`Added waypoint: ${added.name} ${coords} routeStatus=${status}`);
                  }
                }
              }}
              onHover={(h) => setHoveredSuggestionId(h ? sug.id : null)}
            />
          ))}
        </div>

      </section>


      {/* Photo memories concept */}
      <section id="photos" className="mt-10 scroll-mt-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{td.photoEyebrow}</p>
        <h2 className="mt-1 font-display text-2xl uppercase">{td.photosFromRoute}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{td.photosLater}</p>

        <TripPhotosGallery tripId={tripId} />
      </section>

      {/* Partner tips */}
      <section id="tips" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{td.partnerTipsEyebrow}</p>
            <h2 className="mt-1 font-display text-2xl uppercase">{td.localAlongRoute}</h2>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{td.freeTipsNote}</p>

        <div className="mt-4 space-y-3">
          {partnerTips.map((tip) => <PartnerCard key={tip.id} tip={tip} />)}
        </div>
      </section>

      {/* Practical info */}
      <section id="practical" className="mt-10 rounded-2xl border border-border bg-surface p-5 scroll-mt-24">
        <h2 className="font-display text-xl uppercase">{td.practicalTitle}</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>· {td.practicalTotal(trip.distanceKm, tripDays.length)}</li>
          <li>· {td.practicalDrivingTime(trip.drivingTime)} <span className="text-[11px] text-muted-foreground/80">{td.practicalDrivingTimeNote}</span></li>
          <li>· {td.practicalVehicle(vehicleDisplay, v.label, em ? em.label : "", s.label)}</li>
          {trip.energy === "electric" && <li>· {td.electricNote}</li>}
          {trip.energy === "hybrid" && <li>· {td.hybridNote}</li>}
          {trip.vehicle === "rv" && <li>· {td.rvNote}</li>}
          {trip.vehicle === "motorcycle" && <li>· {td.mcNote}</li>}
          {trip.startDate && <li>· {td.departure(new Date(trip.startDate).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))}</li>}
          {tripStops.filter((st) => st.type === "ferry").map((f) => (
            <li key={f.id}>· ⛴️ Inkluderer ferje: {f.ferryRouteHint ?? f.name}</li>
          ))}
          <li>· {td.remember}</li>
        </ul>

        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-primary font-bold">{td.yourDrivingStyle}</p>
          <p className="mt-1.5 text-sm text-foreground/90">
            {td.stopsPlacedNote(prefs.maxDrivingHours, formatPauseLabel(prefs.pauseEveryMin))}
          </p>
          {(prefs.drivingFlags["no-highway"] || prefs.drivingFlags["no-ferry"]) && (
            <p className="mt-1.5 text-sm text-foreground/90">
              {td.avoidPrefix} {[prefs.drivingFlags["no-highway"] && td.avoidHighway, prefs.drivingFlags["no-ferry"] && td.avoidFerry].filter(Boolean).join(` ${td.avoidAnd} `)} {td.avoidSuffix}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">{td.changeInProfile}</p>
        </div>

        <Link to="/trips/$tripId/roadbook" params={{ tripId }}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <BookOpen className="h-4 w-4" /> {td.openRoadbook}
        </Link>
      </section>

      <button onClick={() => { if (confirm(td.deleteTripConfirm)) { tripsApi.deleteTrip(tripId); navigate({ to: "/trips" }); } }}
        className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
        <Trash2 className="h-4 w-4" /> {td.deleteTrip}
      </button>
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} className="fixed inset-0 z-50 bg-background/95 backdrop-blur grid place-items-center p-4 cursor-zoom-out">
          <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

type Td = ReturnType<typeof useT>["app"]["tripDetail"];

function DayCard({
  day, dayIdx, totalDays, allDays, dayStops, trip, tripId, userId, selectedStopId,
  onLightbox, td, onAddStopType,
}: {
  day: import("@/lib/trips-store").TripDay;
  dayIdx: number;
  totalDays: number;
  allDays: import("@/lib/trips-store").TripDay[];
  dayStops: import("@/lib/trips-store").Stop[];
  trip: import("@/lib/trips-store").Trip;
  tripId: string;
  userId: string | undefined;
  selectedStopId: string | null;
  onLightbox: (url: string) => void;
  td: Td;
  onAddStopType: (typeValue: import("@/lib/trips-store").StopType, typeLabel: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [moveStopId, setMoveStopId] = useState<string | null>(null);
  const hasLodging = dayStops.some((s) => s.type === "lodging");
  const coords = dayCoords(trip, dayStops);

  // Build time options: 05:00 → 12:00 in 15-min steps.
  const timeOptions = useMemo(() => {
    const out: string[] = [];
    for (let h = 5; h <= 12; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 12 && m > 0) break;
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, []);

  // Compute estimated arrival per stop based on departure + cumulative drive + dwell.
  // Average 60 km/h for driving legs. Dwell = previous stops' durationMin.
  const arrivals = useMemo(() => {
    if (!day.departureTime) return new Map<string, string>();
    const [hh, mm] = day.departureTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return new Map<string, string>();
    let mins = hh * 60 + mm;
    const map = new Map<string, string>();
    dayStops.forEach((s, i) => {
      if (i > 0) mins += (s.distanceFromPrevKm ?? 0) * 60 / 60; // 60 km/h → 1 min/km
      const h = Math.floor(mins / 60) % 24;
      const m = Math.round(mins % 60);
      map.set(s.id, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      mins += s.durationMin ?? 0;
    });
    return map;
  }, [day.departureTime, dayStops]);

  const moveStop = (stop: import("@/lib/trips-store").Stop) =>
    allDays.filter((d) => d.id !== day.id);

  return (
    <li className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex items-start gap-4 p-4 md:p-5 border-b border-border/60">
        <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display text-xl shrink-0">{day.dayNumber}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input value={day.title} onChange={(e) => tripsApi.updateDay(day.id, { title: e.target.value })}
              className="flex-1 min-w-0 font-display text-xl md:text-2xl uppercase bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
            {hasLodging && (
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                <BedDouble className="h-3 w-3" /> Overnatting
              </span>
            )}
          </div>
          <input value={day.summary ?? ""} placeholder={td.dayDescPlaceholder}
            onChange={(e) => tripsApi.updateDay(day.id, { summary: e.target.value })}
            className="mt-1 w-full text-sm text-muted-foreground bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />

          {/* Departure time */}
          <div className="mt-2 relative">
            {day.departureTime ? (
              <button onClick={() => setTimeOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary px-2.5 py-1 text-[11px] uppercase tracking-wider hover:bg-primary/20">
                <Clock className="h-3 w-3" /> Avreise {day.departureTime}
              </button>
            ) : (
              <button onClick={() => setTimeOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary">
                <Clock className="h-3 w-3" /> Sett avreisestidspunkt
              </button>
            )}
            {timeOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 w-56 rounded-xl border border-border bg-surface-2 shadow-xl p-2">
                <div className="grid grid-cols-4 gap-1 max-h-56 overflow-y-auto">
                  {timeOptions.map((t) => (
                    <button key={t}
                      onClick={() => { tripsApi.updateDay(day.id, { departureTime: t }); setTimeOpen(false); }}
                      className={`rounded-md px-1.5 py-1 text-[11px] font-mono ${
                        day.departureTime === t
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-primary/15 hover:text-primary"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between gap-2 pt-1 border-t border-border/60">
                  {day.departureTime && (
                    <button onClick={() => { tripsApi.updateDay(day.id, { departureTime: undefined }); setTimeOpen(false); }}
                      className="text-[11px] text-muted-foreground hover:text-destructive px-1">Fjern</button>
                  )}
                  <button onClick={() => setTimeOpen(false)} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground px-1">Lukk</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Day actions: reorder + menu */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => tripsApi.reorderDay(day.id, -1)} disabled={dayIdx === 0}
            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt dag opp">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button onClick={() => tripsApi.reorderDay(day.id, 1)} disabled={dayIdx === totalDays - 1}
            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt dag ned">
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 text-muted-foreground hover:text-primary" aria-label="Dagsmeny">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-xl border border-border bg-surface-2 shadow-xl p-1 text-sm">
                <button onClick={() => { tripsApi.duplicateDay(day.id); setMenuOpen(false); toast.success("Dag duplisert"); }}
                  className="w-full text-left inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-primary/10 hover:text-primary">
                  <Copy className="h-3.5 w-3.5" /> Dupliser dag
                </button>
                {totalDays > 1 && (
                  <button onClick={() => {
                    setMenuOpen(false);
                    if (confirm("Slett dag? Stopp på denne dagen flyttes til forrige dag.")) tripsApi.mergeDayUp(day.id);
                  }}
                    className="w-full text-left inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Slett dag
                  </button>
                )}
                <button onClick={() => setMenuOpen(false)}
                  className="mt-0.5 w-full text-left rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-background">Lukk</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DayWeather lat={coords?.lat} lng={coords?.lng} date={dayDate(trip, day)} className="px-4 md:px-5 pt-3" />

      <ul className="divide-y divide-border/60">
        {dayStops.map((stop, idx) => {
          const meta = stopDisplayMeta(stop);
          const arrival = arrivals.get(stop.id);
          const otherDays = moveStop(stop);
          return (
            <li key={stop.id} id={`stop-${stop.id}`}
              className={`transition-colors hover:bg-surface-2/40 ${selectedStopId === stop.id ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}>
              <div className="flex items-stretch">
                <Link to="/trips/$tripId/stops/$stopId" params={{ tripId, stopId: stop.id }} className="flex flex-1 items-start gap-3 p-4 hover:bg-surface-2/60 transition-colors min-w-0">
                  <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-lg shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{stop.name}</p>
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                      {stop.photoOp && <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider"><ImageIcon className="h-2.5 w-2.5" /> {td.photoBadge}</span>}
                      {stop.promoted && !stop.isPartner && <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">{td.partnerBadge}</span>}
                    </div>
                    {stop.description && <p className="mt-1 text-sm text-foreground/80 line-clamp-2">{stop.description}</p>}
                    {stop.type === "lodging" && stop.booking && <BookingInfo booking={stop.booking} />}
                    <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {stop.estimatedTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{stop.estimatedTime}</span>}
                      {arrival && !stop.estimatedTime && <span className="inline-flex items-center gap-1 text-primary/80"><Clock className="h-3 w-3" />ca. {arrival}</span>}
                      {stop.durationMin && <><span>·</span><span>{formatDuration(stop.durationMin)}</span></>}
                      {stop.distanceFromPrevKm !== undefined && idx > 0 && <><span>·</span><span>+{stop.distanceFromPrevKm} km</span></>}
                      {stop.location && <><span>·</span><span>{stop.location}</span></>}
                    </p>
                    {stop.reason && (
                      <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{stop.reason}</span>
                      </p>
                    )}
                    {stop.isPartner && (
                      <PartnerStopBlock partnerId={stop.partnerId} logoUrl={stop.partnerLogoUrl} website={stop.partnerWebsite} />
                    )}
                  </div>
                </Link>
                <div className="flex flex-col items-center justify-center border-l border-border/60 px-1 relative">
                  <button onClick={() => tripsApi.moveStop(stop.id, -1)} disabled={idx === 0}
                    className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label={td.moveUp}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => tripsApi.moveStop(stop.id, 1)} disabled={idx === dayStops.length - 1}
                    className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label={td.moveDown}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {otherDays.length > 0 && (
                    <button onClick={(e) => { e.preventDefault(); setMoveStopId(moveStopId === stop.id ? null : stop.id); }}
                      className="p-1.5 text-muted-foreground hover:text-primary" aria-label={td.overview.moveToOtherDay} title={td.overview.moveToOtherDay}>
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={(e) => { e.preventDefault(); if (confirm(td.removeStopConfirm(stop.name))) tripsApi.deleteStop(stop.id); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive" aria-label={td.removeStop}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {moveStopId === stop.id && (
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1 z-30 w-48 rounded-xl border border-border bg-surface-2 shadow-xl p-1 text-sm">
                      <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{td.overview.moveToOtherDay}</p>
                      {otherDays.map((d) => (
                        <button key={d.id} onClick={() => { tripsApi.moveStopToDay(stop.id, d.id); setMoveStopId(null); toast.success(`${td.overview.moveToOtherDay} → ${d.dayNumber}`); }}
                          className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-primary/10 hover:text-primary">
                          {d.dayNumber}{d.title ? ` — ${d.title}` : ""}
                        </button>
                      ))}
                      <button onClick={() => setMoveStopId(null)} className="mt-0.5 w-full text-left rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-background">×</button>
                    </div>
                  )}
                </div>
              </div>
              {stop.type === "ferry" && (
                <div className="px-4 pb-3 -mt-1 flex items-center gap-2 text-xs text-muted-foreground bg-slate-400/5 border-t border-border/40">
                  <Ship className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <label className="inline-flex items-center gap-1.5">
                    {td.overview.ferryPrice}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={10}
                      value={stop.ferryCostNok ?? ""}
                      placeholder="0"
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        tripsApi.updateStop(stop.id, { ferryCostNok: Number.isFinite(v) ? v : undefined });
                      }}
                      className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  {stop.isAutoDetected && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {td.overview.ferryAutoDetected}
                    </span>
                  )}
                </div>
              )}
              <StopPhotos stop={stop} tripId={tripId} userId={userId} onLightbox={onLightbox} />
            </li>
          );
        })}
        {dayStops.length === 0 && (
          <li className="px-5 py-6 text-sm text-muted-foreground italic">{td.noStopsToday}</li>
        )}
      </ul>

      <div className="p-3 bg-background/40 border-t border-border/60 flex gap-2 overflow-x-auto">
        {STOP_TYPES.slice(0, 8).map((typ) => (
          <button key={typ.value}
            onClick={() => onAddStopType(typ.value, typ.label)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1.5 text-xs hover:border-primary">
            <span>{typ.emoji}</span> {typ.label}
          </button>
        ))}
      </div>
    </li>
  );
}


function StopPhotos({
  stop, tripId, userId, onLightbox,
}: {
  stop: import("@/lib/trips-store").Stop;
  tripId: string;
  userId: string | undefined;
  onLightbox: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const photos = stop.photos ?? [];
  const canAdd = photos.length < 5;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!userId) { toast.error("Logg inn for å laste opp bilder"); return; }
    if (!canAdd) { toast.error("Maks 5 bilder per stopp"); return; }
    setUploading(true);
    try {
      console.log("uploading photo...");
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const photoId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const path = `${userId}/${tripId}/${Date.now()}_${photoId}.${ext}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.storage.from("trip-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("trip-photos").getPublicUrl(path);
      console.log(`upload complete: ${pub.publicUrl}`);
      const { data: row, error: dbErr } = await supabase
        .from("trip_photos")
        .insert({ trip_id: tripId, stop_id: stop.id, user_id: userId, url: pub.publicUrl, path })
        .select("id")
        .single();
      if (dbErr) throw dbErr;
      console.log(`saved to db: ${row?.id}`);
      const ok = tripsApi.addStopPhoto(stop.id, { id: photoId, url: pub.publicUrl, path });
      if (!ok) toast.error("Maks 5 bilder per stopp");
      else toast.success("Bilde lagt til");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`error: ${msg}`);
      toast.error("Kunne ikke laste opp bildet");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (photo: { id: string; path: string }) => {
    if (!confirm("Slette bildet?")) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.storage.from("trip-photos").remove([photo.path]);
    } catch { /* noop */ }
    tripsApi.removeStopPhoto(stop.id, photo.id);
  };

  return (
    <div className="px-4 pb-3 space-y-2">
      {photos.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
          {photos.map((p) => (
            <div key={p.id} className="relative group shrink-0">
              <button type="button" onClick={() => onLightbox(p.url)} className="block h-16 w-16 rounded-lg overflow-hidden border border-border hover:border-primary">
                <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onDelete(p); }}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive text-xs leading-none grid place-items-center"
                aria-label="Slett bilde"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <label
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "10px 12px",
          marginTop: "4px",
          border: "1px dashed rgba(148,163,184,0.35)",
          borderRadius: "10px",
          color: "#9ca3af",
          fontSize: "13px",
          fontWeight: 600,
          cursor: canAdd ? "pointer" : "not-allowed",
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? "none" : "auto",
        }}
      >
        <Camera className="h-4 w-4" />
        <span>
          📷 {uploading ? "Laster opp…" : canAdd ? `Legg til bilde${photos.length > 0 ? ` (${photos.length}/5)` : ""}` : "Maks 5 bilder"}
        </span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onPick}
          disabled={uploading || !canAdd}
        />
      </label>
    </div>
  );
}

type Placement = "along" | "detour" | "after" | "new-day" | "day";

function SuggestionCard({
  sug, onAdd, onHover, detourMin, distanceFromRouteKm, extraDistanceKm, off, vehicleDisplay, styleLabel,
  tripDays, tripDestination,
}: {
  sug: SuggestedStop;
  onAdd: (placement: Placement, dayId?: string) => void;
  onHover: (h: boolean) => void;
  detourMin: number; distanceFromRouteKm: number; extraDistanceKm: number; off: boolean;
  vehicleDisplay: string; styleLabel: string;
  tripDays: { id: string; dayNumber: number; title: string }[];
  tripDestination: string;
}) {
  const meta = stopMeta(sug.type);
  const [open, setOpen] = useState(false);
  const [detourOpen, setDetourOpen] = useState(false);
  const [pendingDayId, setPendingDayId] = useState<string | undefined>(undefined);
  const choose = (p: Placement, dayId?: string) => {
    if (p === "along" && off) {
      setPendingDayId(dayId);
      setDetourOpen(true);
      setOpen(false);
      return;
    }
    onAdd(p, dayId);
    setOpen(false);
  };
  const handleDetourChoice = (c: "detour" | "via" | "save" | "cancel") => {
    if (c === "cancel") return;
    if (c === "detour") onAdd("detour", pendingDayId);
    else if (c === "via") onAdd("along", pendingDayId);
    else if (c === "save") onAdd("day", pendingDayId);
  };
  // Hover is intentionally passive — no map sync, no popup, no flyTo.
  // (onHover prop kept for API compat; intentionally unused.)
  void onHover;
  return (
    <div
      className="rounded-2xl border border-border bg-surface p-4 flex flex-col hover:border-primary/50 transition-colors relative"
    >
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-lg shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{sug.name}</p>
            {sug.badge && <BadgeChip kind={sug.badge} />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{meta.label}{sug.location ? ` · ${sug.location}` : ""}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground/85">{sug.description}</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${off ? "border-amber-500/40 text-amber-300" : "border-border text-muted-foreground"}`}>
          <CornerDownRight className="h-3 w-3" />
          {off ? `+${detourMin} min detour` : "På ruta"}
        </span>
        {off && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
            +{extraDistanceKm} km ekstra
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
          <Navigation className="h-3 w-3" />
          {distanceFromRouteKm < 1 ? "<1 km" : `${distanceFromRouteKm} km`} fra ruta
        </span>
        {sug.durationMin && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDuration(sug.durationMin)}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>{sug.reason} <span className="text-muted-foreground">Passer {vehicleDisplay.toLowerCase()} · {styleLabel.toLowerCase()}.</span></span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <p className="text-[11px] text-muted-foreground">{sug.photoOp ? "📸 fotomulighet" : ""}</p>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary border border-primary/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-primary/25">
          <Plus className="h-3 w-3" /> Legg til
        </button>
      </div>
      {open && (
        <div className="absolute right-3 bottom-14 z-30 w-64 rounded-2xl border border-border bg-surface-2 shadow-xl p-2 text-sm">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Hvor skal det legges?</p>
          <PlacementBtn label="Legg til langs nåværende rute" onClick={() => choose("along")} />
          <PlacementBtn label="Legg til som avstikker" onClick={() => choose("detour")} />
          <PlacementBtn label={`Legg til etter ${tripDestination}`} onClick={() => choose("after")} />
          <PlacementBtn label="Legg til som egen dag" onClick={() => choose("new-day")} />
          {tripDays.length > 1 && (
            <>
              <p className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Velg dag</p>
              {tripDays.map((d) => (
                <PlacementBtn key={d.id} label={`Dag ${d.dayNumber} — ${d.title}`} onClick={() => choose("day", d.id)} />
              ))}
            </>
          )}
          <button onClick={() => setOpen(false)} className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-background">Avbryt</button>
        </div>
      )}
      <DetourPromptDialog
        open={detourOpen}
        onOpenChange={setDetourOpen}
        name={sug.name}
        location={sug.location}
        distanceFromRouteKm={distanceFromRouteKm}
        extraDistanceKm={extraDistanceKm}
        detourMin={detourMin}
        onChoose={handleDetourChoice}
      />
    </div>
  );
}


function PlacementBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-primary/10 hover:text-primary transition-colors">
      {label}
    </button>
  );
}

function PlannerActions({
  trip, tripDays, tripStops, maxDrivingHours,
}: {
  trip: { id: string; destination: string; routeDurationMin?: number; drivingTime: string; startDate?: string; source?: "manual" | "ai" | "template" };
  tripDays: { id: string; dayNumber: number }[];
  tripStops: { dayId: string; type: string }[];
  maxDrivingHours: number;
}) {
  const [destOpen, setDestOpen] = useState(false);
  const [destText, setDestText] = useState("");
  const [destPlace, setDestPlace] = useState<ResolvedPlace | null>(null);
  const [lodgingOpen, setLodgingOpen] = useState(false);
  const [lodgingText, setLodgingText] = useState("");
  const [lodgingPlace, setLodgingPlace] = useState<ResolvedPlace | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

  const handleSplit = () => {
    if (isSplitting) return;
    setIsSplitting(true);
    tripsApi.splitIntoDays(trip.id, tripDays.length + 1);
    window.setTimeout(() => setIsSplitting(false), 1000);
  };

  // Booking context (populated after a lodging place is selected).
  const today = new Date().toISOString().slice(0, 10);
  const defaultCheckin = trip.startDate ?? today;
  const defaultCheckout = (() => {
    const d = new Date(defaultCheckin);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const [checkin, setCheckin] = useState(defaultCheckin);
  const [checkout, setCheckout] = useState(defaultCheckout);
  const [guests, setGuests] = useState(2);
  const [priceText, setPriceText] = useState("");
  const [bookingStatus, setBookingStatus] = useState<"none" | "booked" | "paid">("none");

  const lastDayId = tripDays.length > 0 ? tripDays[tripDays.length - 1].id : null;

  const resetLodging = () => {
    setLodgingText(""); setLodgingPlace(null); setLodgingOpen(false);
    setCheckin(defaultCheckin); setCheckout(defaultCheckout);
    setGuests(2); setPriceText(""); setBookingStatus("none");
  };

  const nightsBetween = (a: string, b: string) => {
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Math.max(1, Math.round(ms / 86400000));
  };

  const commitLodging = (mode: "overnight" | "stop") => {
    if (!lastDayId || !lodgingPlace) return;
    const p = lodgingPlace;
    if (mode === "stop") {
      tripsApi.addStop(lastDayId, {
        name: p.name,
        type: "attraction",
        location: p.secondary ?? p.label ?? p.name,
        description: p.secondary ? `Stopp · ${p.secondary}` : "Stopp langs ruta.",
        durationMin: 30,
        lat: p.lat, lng: p.lng,
      });
      resetLodging();
      return;
    }
    const nights = nightsBetween(checkin, checkout);
    const price = priceText.trim() ? Number(priceText.replace(",", ".")) : undefined;
    const validPrice = price != null && !Number.isNaN(price) && price > 0 ? price : undefined;
    tripsApi.addStop(lastDayId, {
      name: p.name,
      type: "lodging",
      location: p.secondary ?? p.label ?? p.name,
      description: `Overnatting · ${nights} ${nights === 1 ? "natt" : "netter"}${validPrice ? ` · ${validPrice.toFixed(0)} kr/natt` : ""}.`,
      reason: "Booking lagt inn fra planlegger.",
      durationMin: 720 * nights,
      lat: p.lat, lng: p.lng,
      booking: {
        checkinDate: checkin,
        checkoutDate: checkout,
        nights,
        guests,
        pricePerNight: validPrice,
        status: bookingStatus,
      },
    });
    resetLodging();
  };

  const onLodgingSelect = (p: ResolvedPlace | null) => {
    setLodgingPlace(p);
    // Do NOT auto-add — show booking context panel inline below.
  };


  const durationMin = trip.routeDurationMin ?? 0;
  const allDaysHaveLodging = tripDays.length > 0 && tripDays.every((d) =>
    tripStops.some((s) => s.dayId === d.id && s.type === "lodging"));
  const suppressLongLeg = trip.source === "manual" || allDaysHaveLodging;
  const isLongLeg = !suppressLongLeg && durationMin > 0 && durationMin > maxDrivingHours * 60;

  return (
    <section className="mt-4 space-y-3">
      {isLongLeg && (
        <div className="relative z-20 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
          <p className="text-sm font-semibold text-amber-900">Denne etappen er lang ({trip.drivingTime}).</p>
          <p className="mt-1 text-xs text-amber-900/80">
            Lengre enn dine {maxDrivingHours} timer kjøring per dag. Vil du dele den opp?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => { tripsApi.splitIntoDays(trip.id, 2); setLodgingOpen(true); }}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:brightness-110"
            >
              Ja, foreslå overnatting
            </button>
            <button
              onClick={() => { /* keep as-is */ }}
              className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 hover:bg-amber-100"
            >
              Nei, behold som én dag
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <PlannerBtn label={isSplitting ? "Deler opp…" : "Del opp i flere dager"} onClick={handleSplit} disabled={isSplitting} />
        <PlannerBtn label="Legg til overnatting" onClick={() => setLodgingOpen(true)} primary />
        <PlannerBtn label="+ Legg til neste destinasjon" onClick={() => setDestOpen(true)} />
      </div>
      {destOpen && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Neste destinasjon etter {trip.destination}</p>
          <p className="mt-1 text-xs text-muted-foreground">F.eks. Ålesund, Geiranger, eller et hotell. Kartet oppdateres ved neste rutegenerering.</p>
          <div className="mt-3 space-y-2" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
            <PlaceAutocomplete
              value={destText}
              onTextChange={setDestText}
              selected={destPlace}
              onSelect={(p) => {
                setDestPlace(p);
                // If user picked a hotel/camping etc., switch to lodging flow automatically.
                if (p?.placeTypes?.some((t) => LODGING_PLACE_TYPES.includes(t))) {
                  setLodgingPlace(p);
                  setLodgingText(p.name);
                  setLodgingOpen(true);
                  setDestOpen(false);
                  setDestText("");
                  setDestPlace(null);
                }
              }}
              placeholder="Sted eller hotell"
              ariaLabel="Neste destinasjon"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const place = (destPlace?.name ?? destText).trim();
                  if (!place) return;
                  tripsApi.addDestination(trip.id, place);
                  setDestText("");
                  setDestPlace(null);
                  setDestOpen(false);
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                Legg til
              </button>
              <button onClick={() => { setDestOpen(false); setDestText(""); setDestPlace(null); }} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
      {lodgingOpen && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Legg til overnatting</p>
          <p className="mt-1 text-xs text-muted-foreground">Søk etter hotell, hytte eller camping</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Hotell", "Hytte", "Camping", "Scandic", "Thon", "Nordic Choice", "Airbnb"].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => { setLodgingPlace(null); setLodgingText((prev) => { const e = (prev ?? "").trim(); if (!e) return chip; if (e.toLowerCase().includes(chip.toLowerCase())) return e; return `${chip} ${e}`; }); }}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-primary hover:bg-surface-2"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
            <PlaceAutocomplete
              value={lodgingText}
              onTextChange={setLodgingText}
              selected={lodgingPlace}
              onSelect={onLodgingSelect}
              placeholder="F.eks. Scandic Geilo"
              ariaLabel="Overnatting"
              searchOptions={{ category: "lodging" }}
            />
            {!lodgingPlace && (
              <div className="flex justify-end">
                <button
                  onClick={resetLodging}
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Avbryt
                </button>
              </div>
            )}
          </div>

          {lodgingPlace && (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-4 space-y-4">
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-lg leading-none">🏨</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{lodgingPlace.name}</p>
                  {lodgingPlace.secondary && (
                    <p className="text-xs text-muted-foreground truncate">{lodgingPlace.secondary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setLodgingPlace(null); }}
                  className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Endre
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Innsjekk</span>
                  <input
                    type="date"
                    value={checkin}
                    onChange={(e) => { const v = e.target.value; setCheckin(v); if (new Date(v) >= new Date(checkout)) { const d = new Date(v); d.setDate(d.getDate() + 1); setCheckout(d.toISOString().slice(0, 10)); } }}
                    className="w-full min-h-10 rounded-lg border border-border bg-background/60 px-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Utsjekk</span>
                  <input
                    type="date"
                    value={checkout}
                    min={checkin}
                    onChange={(e) => setCheckout(e.target.value)}
                    className="w-full min-h-10 rounded-lg border border-border bg-background/60 px-2 text-sm"
                  />
                </label>
              </div>

              <div>
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Gjester</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGuests(n)}
                      className={`min-w-10 h-10 px-3 rounded-lg border text-sm font-medium ${guests === n ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-foreground hover:border-primary/50"}`}
                    >
                      {n === 4 ? "4+" : n}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Pris per natt (valgfritt)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" inputMode="decimal" min={0} step="1"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-h-10 rounded-lg border border-border bg-background/60 px-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">kr</span>
                </div>
                {priceText.trim() && !Number.isNaN(Number(priceText.replace(",", "."))) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Totalt: {(Number(priceText.replace(",", ".")) * nightsBetween(checkin, checkout)).toFixed(0)} kr ({nightsBetween(checkin, checkout)} {nightsBetween(checkin, checkout) === 1 ? "natt" : "netter"})
                  </p>
                )}
              </label>

              <div>
                <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Bookingstatus</span>
                <div className="space-y-1.5">
                  {([
                    { v: "none", label: "Ikke booket ennå" },
                    { v: "booked", label: "Booket ✓" },
                    { v: "paid", label: "Betalt ✓" },
                  ] as const).map((opt) => (
                    <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="bookingStatus"
                        checked={bookingStatus === opt.v}
                        onChange={() => setBookingStatus(opt.v)}
                        className="accent-primary"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={() => commitLodging("overnight")}
                  className="flex-[2] min-h-11 rounded-xl bg-primary px-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
                >
                  Legg til overnatting
                </button>
                <button
                  onClick={() => commitLodging("stop")}
                  className="flex-1 min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground hover:bg-surface-2"
                >
                  Bare som stopp
                </button>
              </div>
            </div>
          )}
        </div>

      )}
    </section>
  );
}

function PlannerBtn({ label, onClick, disabled, primary }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={primary
        ? "rounded-2xl bg-primary text-primary-foreground px-3 py-2.5 text-xs font-semibold uppercase tracking-wider hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        : "rounded-2xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold uppercase tracking-wider hover:border-primary hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      {label}
    </button>
  );
}



function PartnerCard({ tip }: { tip: PartnerTip }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className="h-11 w-11 rounded-xl bg-surface-2 grid place-items-center text-xl shrink-0">{tip.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{tip.name}</p>
          <BadgeChip kind={tip.badge} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{tip.category} · {tip.location}</p>
        <p className="mt-2 text-sm text-foreground/85">{tip.blurb}</p>
      </div>
    </div>
  );
}

function BadgeChip({ kind }: { kind: "partner" | "promoted" | "local" }) {
  const map = {
    partner:  { label: "Partner",   className: "border-primary/40 text-primary",                 icon: <Tag className="h-2.5 w-2.5" /> },
    promoted: { label: "Promotert", className: "border-primary/40 text-primary bg-primary/10",   icon: <Star className="h-2.5 w-2.5" /> },
    local:    { label: "Lokalt tips", className: "border-border text-muted-foreground",          icon: <MapPin className="h-2.5 w-2.5" /> },
  } as const;
  const m = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${m.className}`}>
      {m.icon} {m.label}
    </span>
  );
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </p>
      <p className="mt-1 font-display text-lg md:text-2xl">{value}</p>
    </div>
  );
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60); const m = min % 60;
    return m ? `${h}t ${m}min` : `${h}t`;
  }
  return `${min} min`;
}

function formatPauseLabel(min: number): string {
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? "hver time" : h === 2 ? "annenhver time" : `hver ${h}. time`;
  }
  return `hvert ${min}. minutt`;
}

/**
 * Detour totals — when one or more stops are flagged as detours, show
 * the user how the trip is composed: base route, detour extras, and the
 * total including detours. If there are no detours, render nothing.
 */
function DetourTotals({
  trip, stops,
}: {
  trip: { distanceKm: number; drivingTime: string; routeDistanceKm?: number; routeDurationMin?: number };
  stops: { routeStatus?: string; extraDistanceKm?: number }[];
}) {
  const detours = stops.filter((s) => s.routeStatus === "detour");
  if (detours.length === 0) return null;
  const extraKm = detours.reduce((sum, s) => sum + (s.extraDistanceKm ?? 0), 0);
  // 60 km/h average for detour spurs (round-trip already baked into extraKm).
  const extraMin = Math.round(extraKm * 60 / 60);
  const baseKm = trip.routeDistanceKm ?? trip.distanceKm;
  const baseMin = trip.routeDurationMin ?? 0;
  const totalKm = Math.round((baseKm + extraKm) * 10) / 10;
  const totalMin = baseMin + extraMin;
  return (
    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">Med avstikker</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hovedrute</p>
          <p className="mt-0.5 font-semibold">{Math.round(baseKm)} km</p>
          <p className="text-[11px] text-muted-foreground">{trip.drivingTime}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-amber-300">Avstikkere ({detours.length})</p>
          <p className="mt-0.5 font-semibold text-amber-300">+{Math.round(extraKm * 10) / 10} km</p>
          <p className="text-[11px] text-amber-200/80">+{formatDuration(extraMin)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-foreground">Total</p>
          <p className="mt-0.5 font-semibold">{totalKm} km</p>
          <p className="text-[11px] text-muted-foreground">{formatDuration(totalMin)}</p>
        </div>
      </div>
    </div>
  );
}

function VehiclePickerBadge({
  tripId, currentVehicleId, vehicleEmoji, vehicleLabel, energyEmoji, energyLabel,
}: {
  tripId: string;
  currentVehicleId?: string;
  vehicleEmoji: string;
  vehicleLabel: string;
  energyEmoji?: string;
  energyLabel?: string;
}) {
  const { vehicles } = useVehicles();
  const [open, setOpen] = useState(false);

  const onPick = (vid: string) => {
    const veh = vehicles.find((x) => x.id === vid);
    if (!veh) return;
    tripsApi.updateTrip(tripId, {
      vehicleId: veh.id,
      vehicleName: veh.name,
      vehicle: veh.type,
      energy: energyTypeToSource(veh.energy),
    });
    setOpen(false);
    toast.success(`Kjøretøy byttet til ${veh.name}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs hover:bg-background/80 hover:border-primary/50 transition"
          aria-label="Bytt kjøretøy"
        >
          {vehicleEmoji} {vehicleLabel}
          {energyEmoji && <span className="opacity-70">· {energyEmoji} {energyLabel}</span>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
          Velg kjøretøy
        </p>
        <div className="flex flex-col gap-1">
          {vehicles.map((veh) => {
            const em = energyMeta(veh.energy);
            const active = veh.id === currentVehicleId;
            return (
              <button
                key={veh.id}
                type="button"
                onClick={() => onPick(veh.id)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{vehicleMeta(veh.type).emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">{veh.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {em.emoji} {em.label}
                    </span>
                  </span>
                </span>
                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}


