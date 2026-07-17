# Capra Crossing 🐐

Endless hopper 3D in stile Crossy Road: porta Nonna Rosetta (la capra) più lontano possibile tra strade, fiumi e binari. HTML5 + Three.js, pensato per CrazyGames.

## Gioca

```bash
python3 -m http.server 8643
# apri http://localhost:8643
```

## Controlli

| Input | Azione |
|---|---|
| ⬆️⬇️⬅️➡️ / WASD / Spazio | salta nella direzione |
| Tap (mobile) | avanti |
| Swipe (mobile) | salta nella direzione |

## Meccaniche

- **Score** = riga massima raggiunta; record in localStorage
- **Corsie**: prato (alberi/rocce bloccano), strada (auto e camion), fiume (salta sui tronchi), binari (semaforo rosso = treno in arrivo)
- **Aquila**: fermo troppo a lungo (o troppo indietro) → banner rosso + ombra crescente → l'aquila ti porta via. Salta avanti per salvarti
- **Monete 🪙**: persistenti, sbloccano 5 skin capra nel negozio della schermata titolo
- **Difficoltà progressiva**: velocità veicoli, densità corsie e camera crescono col punteggio
- **Ciclo giornata**: giorno → tramonto → notte → alba, cambia ogni 50 righe

## Struttura

```
index.html                canvas + HUD + overlay + negozio skin
css/style.css             layout responsivo
js/main.js                engine: generazione corsie, gameplay, camera, giorno/notte, SDK CrazyGames
js/models.js              modelli GLB Kenney + procedurali (capra, tronchi, treno, aquila)
vendor/                   three.js r160 + GLTFLoader (vendored, zero CDN)
assets/models/            GLB Kenney CC0 (auto, alberi, rocce) + colormap
```

## Crediti asset

- [Kenney](https://kenney.nl) — Car Kit, Nature Kit (CC0)
- Capra, tronchi, treno, aquila: modelli procedurali Three.js

SDK CrazyGames v3 integrato con guardie (`gameplayStart/Stop`, `happytime`) — funziona anche offline.
