"use client";
import { createContext, useContext, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  summarySchema,
  citySchema,
  distributionsSchema,
  type Filters,
  facetsSchema,
} from "@/lib/contracts";
import { z } from "zod";
import { queryString } from "@/lib/contracts";
import { api } from "@/lib/api";
const Context = createContext<{
  filters: Filters;
  setFilters: (filters: Filters) => void;
} | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [filters, setFilters] = useState<Filters>({});
  return (
    <QueryClientProvider client={client}>
      <Context.Provider value={{ filters, setFilters }}>
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("WorkspaceProvider required");
  return context;
}
export function useAnalytics() {
  const { filters } = useWorkspace();
  const query = queryString(filters);
  const summary = useQuery({
    queryKey: ["summary", query],
    queryFn: () => api(`dashboard/summary?${query}`, summarySchema),
  });
  const cities = useQuery({
    queryKey: ["cities", query],
    queryFn: () => api(`analytics/cities?${query}`, z.array(citySchema)),
  });
  const distributions = useQuery({
    queryKey: ["distributions", query],
    queryFn: () => api(`analytics/distributions?${query}`, distributionsSchema),
  });
  return { summary, cities, distributions };
}
export function useFacets(city?: string) {
  return useQuery({
    queryKey: ["facets", city || ""],
    queryFn: () =>
      api(
        `data/facets${city ? `?city=${encodeURIComponent(city)}` : ""}`,
        facetsSchema,
      ),
  });
}
