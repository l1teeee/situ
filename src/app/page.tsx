import Crowd from "@/components/crowd/Crowd";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <h1 className="sr-only">situ</h1>
      <Crowd />
      <div aria-hidden="true" className="grain" />
    </main>
  );
}
