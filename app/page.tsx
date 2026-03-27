import { Navbar } from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-2">Welcome to Blackkin</h1>
        <p className="text-muted-foreground text-sm">
          Your ecommerce platform. Coming soon.
        </p>
      </main>
    </>
  );
}
