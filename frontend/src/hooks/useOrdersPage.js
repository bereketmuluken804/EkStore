import { useAuth } from "@clerk/react";
import { apiFetch } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

const useOrdersPage = () => {
	const { getToken, isSignedIn } = useAuth();

	const { data, isLoading, error } = useQuery({
		queryKey: ["orders"],
		queryFn: () => apiFetch("/api/orders", { getToken }),
		enabled: isSignedIn,
	});

	const { data: meData } = useQuery({
		queryKey: ["me"],
		queryFn: () => {
			return apiFetch("/api/me", { getToken });
		},
		enabled: isSignedIn,
	});

	const staff =
		meData?.user?.role === "support" || meData?.user?.role === "admin";

  const orders = data?.orders ?? [];
  return {
    isLoading,
    error,
    orders,
    staff
  }
};

export default useOrdersPage;
