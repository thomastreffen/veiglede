import type { Dict } from "./nb";

// English — international Norway-focused positioning for veiglede.com.
// Norwegian place names are kept untranslated.
export const en: Dict = {
  meta: {
    title: "Veiglede — Plan your perfect Norway roadtrip",
    description:
      "Scenic routes, hidden stops and AI-powered roadbooks for unforgettable roadtrips in Norway — for solo travellers and groups alike.",
    ogTitle: "Veiglede — Find the road that matters",
    ogDescription:
      "Scenic routes, hidden stops and AI-powered roadbooks for unforgettable roadtrips in Norway.",
  },
  nav: {
    login: "Log in",
    startTrip: "Plan a trip",
    myTrips: "My trips",
    newTrip: "New trip",
  },
  hero: {
    eyebrow: "AI-powered Norway roadtrip planner",
    titleLine1: "Find the road",
    titleLine2Prefix: "that ",
    titleAccent: "matters",
    body: "Plan your perfect Norway roadtrip — scenic routes, hidden stops and roadbooks tailored to your vehicle, your style and the people you're travelling with.",
    ctaPrimary: "Plan a trip",
    ctaSecondary: "Explore routes",
    note: "Free to try. Create an account whenever you want to save, share or continue later.",
    panel: {
      label: "Your next trip",
      vehicle: { k: "Vehicle", v: "Motorcycle / Car / Camper" },
      style: { k: "Style", v: "Twisty roads / Photo tour / Easy cruise" },
      stops: { k: "Stops", v: "Viewpoints, food, fuel, local tips" },
      share: { k: "Share", v: "Roadbook link and group trip" },
      distance: "120 km",
    },
  },
  features: [
    { title: "Scenic routes", body: "See more of Norway\non the way." },
    { title: "Memorable stops", body: "Viewpoints, food, fuel\nand local gems." },
    { title: "AI suggestions", body: "Smart picks based on\nyour preferences." },
    { title: "Roadbook", body: "A clear guide you can\nfollow and share." },
    { title: "Plan together", body: "Build a group trip and\nkeep everyone aligned." },
  ],
  what: {
    eyebrow: "What is Veiglede?",
    cards: [
      { title: "For yourself", body: "A personal route and stops that match how you like to drive." },
      { title: "For your group", body: "Share the trip with friends so everyone follows the same plan." },
      { title: "For the experience", body: "Discover viewpoints, food stops, local tips and detours worth taking." },
    ],
  },
  how: {
    eyebrow: "How it works",
    title: "Plan your trip in a few easy steps",
    steps: [
      { title: "Pick your vehicle and style", body: "Tell us what you drive and how you like to drive it." },
      { title: "Get routes and stop suggestions", body: "Our AI builds a route with scenic roads and great stops." },
      { title: "Open your roadbook and share", body: "Follow the roadbook, navigate with confidence and share with your group." },
    ],
  },
  together: {
    title: "Plan together",
    body: "Build a shared trip, send the roadbook to friends and keep the group on the same plan — perfect for motorcycle trips, weekend getaways and group roadtrips.",
    mini: [
      { title: "Shareable roadbook", body: "One link — everyone has the same plan." },
      { title: "Invite your group", body: "Bring friends along with a single invite." },
      { title: "Live sharing coming soon", body: "Follow each other's position and get updates on the road." },
    ],
  },
  routes: {
    title: "Start from a classic route — make it your own",
    days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    styles: {
      svingete: "Twisty road",
      fototur: "Photo tour",
      cruise: "Easy cruise",
    },
  },
  cta: {
    title1: "Plan your first trip ",
    titleAccent: "free",
    title2: " — no account required.",
    body: "Try Veiglede directly in your browser. Create an account when you want to save trips, sync between devices or share your roadbook.",
    primary: "Plan a trip",
    secondary: "Log in",
  },
  footer: {
    myTrips: "My trips",
    newTrip: "New trip",
    login: "Log in",
  },
  language: {
    label: "Language",
    nb: "Norsk",
    en: "English",
    de: "Deutsch",
  },
};
