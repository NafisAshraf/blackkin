"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="h-9 w-9 flex items-center justify-center hover:bg-muted transition-colors rounded"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Blackkin" className="h-6 w-auto" />
          <span className="text-sm font-bold tracking-wider uppercase">Admin</span>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 z-50 md:hidden">
            <div className="relative h-full">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center hover:bg-muted transition-colors rounded z-10"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              <AdminSidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </>
      )}

      {/* Main layout */}
      <div className="flex md:min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <AdminSidebar />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
