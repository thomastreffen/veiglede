import { createFileRoute } from "@tanstack/react-router";
import { sharedTripLoader, sharedTripHead, SharedTripPage } from "@/components/SharedTripPage";

export const Route = createFileRoute("/tur/delt/$shareToken")({
  loader: async ({ params }) => sharedTripLoader({ shareToken: params.shareToken }),
  head: ({ loaderData }) => sharedTripHead(loaderData),
  component: () => {
    const { shareToken } = Route.useParams();
    return <SharedTripPage shareToken={shareToken} />;
  },
});
