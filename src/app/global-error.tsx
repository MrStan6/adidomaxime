"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.25rem", maxWidth: 560, margin: "0 auto" }}>
        <h1>Le site est momentanément indisponible</h1>
        <p>Un incident technique empêche l'affichage. Réessayez dans quelques instants.</p>
        <button onClick={reset} style={{ padding: "0.75rem 1.25rem", marginTop: "1rem" }}>Réessayer</button>
      </body>
    </html>
  );
}
