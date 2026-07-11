"use client";

import { createContext, useContext } from "react";

export interface StorefrontSearchProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  imageUrl: string | null;
}

export interface StorefrontShellData {
  navigation: Array<{
    _id: string;
    categoryId: string;
    name: string;
    slug: string;
    sortOrder: number;
  }>;
  categories: Array<{ _id: string; name: string; slug: string }>;
  predefinedQueries: Array<{ _id: string; query: string }>;
  searchProducts: StorefrontSearchProduct[];
  marketing: {
    facebookPixelId: string | null;
    facebookBrowserEnabled: boolean;
    ga4MeasurementId: string | null;
    googleEnabled: boolean;
    headScripts: string | null;
    bodyScripts: string | null;
  };
}

const emptyStorefrontShell: StorefrontShellData = {
  navigation: [],
  categories: [],
  predefinedQueries: [],
  searchProducts: [],
  marketing: {
    facebookPixelId: null,
    facebookBrowserEnabled: false,
    ga4MeasurementId: null,
    googleEnabled: false,
    headScripts: null,
    bodyScripts: null,
  },
};

const StorefrontDataContext = createContext(emptyStorefrontShell);

export function StorefrontDataProvider({
  data,
  children,
}: {
  data: StorefrontShellData;
  children: React.ReactNode;
}) {
  return (
    <StorefrontDataContext.Provider value={data}>
      {children}
    </StorefrontDataContext.Provider>
  );
}

export function useStorefrontData() {
  return useContext(StorefrontDataContext);
}
