import Link from "next/link";
import { AddressSearch } from "@/search/AddressSearch";
import { listFixtureCells } from "@/lib/data";

export default function Home() {
  const fixtures = listFixtureCells();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24">
      <p className="text-sm font-medium text-tertiary">CDMX · datos abiertos</p>
      <h1 className="mt-2 text-center text-4xl font-bold tracking-tight">Antes de rentar</h1>
      <p className="mt-3 max-w-lg text-center text-secondary">
        Agua, inundación, sismo, seguridad vial, ruido, calor y servicios a pie — todo lo que
        conviene saber de una dirección antes de firmar.
      </p>
      <div className="mt-8 flex w-full justify-center">
        <AddressSearch />
      </div>
      <div className="mt-10 w-full">
        <p className="text-xs text-tertiary">Direcciones de ejemplo (fixtures):</p>
        <ul className="mt-2 grid gap-2">
          {fixtures.map((c) => (
            <li key={c.h3}>
              <Link
                href={`/reporte/${c.h3}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3 text-sm hover:border-tertiary"
              >
                <span>{c.label}</span>
                <span className="text-xs text-tertiary">{c.alcaldia}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
