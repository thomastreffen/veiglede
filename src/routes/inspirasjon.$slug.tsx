import { createFileRoute } from "@tanstack/react-router";
import { CuratedTripPage, curatedTripHead } from "@/components/CuratedTripPage";

export const Route = createFileRoute("/inspirasjon/$slug")({
  head: ({ params }) => curatedTripHead(params.slug),
  component: () => {
    const { slug } = Route.useParams();
    return <CuratedTripPage slug={slug} />;
  },
});
