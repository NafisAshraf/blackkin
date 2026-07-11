"use client";

import { useEffect, useState } from "react";

const URL_CHANGE_EVENT = "storefront:urlchange";

export function useUrlSearchParams() {
  const [params, setParams] = useState(() => new URLSearchParams());

  useEffect(() => {
    const syncFromLocation = () => {
      setParams(new URLSearchParams(window.location.search));
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener(URL_CHANGE_EVENT, syncFromLocation);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener(URL_CHANGE_EVENT, syncFromLocation);
    };
  }, []);

  return params;
}

export function pushUrlSearchParams(params: URLSearchParams) {
  const query = params.toString();
  window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}
