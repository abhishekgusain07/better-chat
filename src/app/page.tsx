import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold">Minimalist Template</h1>
        <p className="text-sm text-gray-500">
          This is a minimalist template for a Next.js project.
        </p>
        <Button>Get Started</Button>
      </div>
    </div>
  );
}
