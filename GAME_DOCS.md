# GOAT CROSSER — documentazione tecnica completa

Endless hopper 3D (tipo Crossy Road), Three.js r160, zero asset esterni pesanti — texture/musica/SFX generati a runtime, modelli Kenney CC0 GLB con fallback procedurale JS.

## Stack e file

```
index.html          struttura DOM (HUD, overlay titolo/game-over, splash CrazyGames)
css/style.css        stile HUD/overlay
js/main.js  (1463 righe)  loop di gioco, fisica, world-gen, SDK, audio, stato
js/models.js          libreria modelli 3D (capra, veicoli, tronchi, treno, power-up, skin)
js/textures.js        texture canvas procedurali (erba/asfalto/rotaie/acqua/corteccia/pelo)
js/fx.js              particelle, testo fluttuante, post-processing, camera shake
vendor/three.module.min.js   Three.js locale (import map, no CDN)
```
Nessuna build: apri con un server statico (es. `python3 -m http.server`), niente bundler/npm.

## Loop di gioco (`tick()`, main.js:1408)

`requestAnimationFrame` continuo. Ogni frame: clamp `dt` a 0.05s (evita tunneling su tab in background) → `updateVehicles → updatePlayer → updatePowers → checkCollisions → updateEagle → updateDeath → ensureRows → particles/floats/clouds/day-cycle/camera → postfx.render`.

`timeScale` globale: scala il `dt` di gioco (non quello reale) — usato per lo slow-mo alla morte (0.25×, torna a 1× in ~0.9s).

## Controlli

- Frecce / WASD → salto di una cella (`tryHop(dx,dz)`), input bufferizzato (max 3) se un salto è già in corso
- Space → belato di panico (`bleat()`, cooldown 0.5s), puramente cosmetico/audio, NON è più un salto
- Touch: swipe → stesso `tryHop`
- Muro: se provi a saltare lateralmente restando sulla stessa cella → suono "deny", nessun movimento

## Mondo e colonne

- `COLS = 8` → colonne giocabili -8..8 (quasi tutta la larghezza schermo)
- `LANE_W = 42` → larghezza visiva di ogni corsia (asfalto/rotaia/fiume/erba)
- Righe generate `AHEAD = 24` avanti al giocatore, tenute `BEHIND = 7` dietro camera; il resto viene riciclato (object pooling, vedi sotto)
- `TILE = 1` → una cella = un'unità mondo = una riga di avanzamento (`score`)

## Generazione procedurale delle righe (`buildRow`, `laneTypeFor`)

Ogni riga `r` ha un tipo scelto a pesi (roulette): `grass | road | river | rail`.
- Righe `r < 3`: sempre erba (spawn sicuro)
- Pesi base: grass 0.30, road 0.34, river 0.24, rail 0.12
- `diffAt(r) = min(r/150, 1)` → rampa di difficoltà 0→1 fino a riga 150
- `lateAt(r) = min(max(r-150,0)/500, 1)` → rampa lenta "endgame" oltre riga 150, per modalità endless lunghe
- Con la difficoltà: più road/river/rail, meno grass
- Anti-ripetizione: dopo 2 fiumi/3 strade/1 rotaia consecutive, quel peso azzera (evita sequenze impossibili); dopo 2 erbe consecutive, peso erba ×0.3 (evita noia)
- **Biomi**: `BIOMES` a bande (`BAND` righe ciascuna), colori erba/acqua/rocce interpolati (lerp) tra bioma corrente e successivo, quantizzati `& 0xF0F0F0` per limitare la cache texture

## RNG separato (world-gen vs runtime)

Due generatori distinti per non rompere il determinismo della daily challenge:
- `genRand` — usato SOLO da `buildRow/biomeAt/laneTypeFor` (via helper `grand/grandi/gpick`) → decide la struttura del mondo
- `Math.random()` diretto — usato per tutto il resto (particelle, ragdoll, audio) → non deve essere deterministico

In modalità `daily`: `genRand = mulberry32(seed)` con seed = data odierna (YYYYMMDD) × costante; stesso mondo per tutti i giocatori nello stesso giorno. In `endless`: `genRand = Math.random`.

## Object pooling (`objPool` Map, main.js:390-465)

Ogni mesh riciclabile ha `mesh.userData._pk` (pool key). Quando una riga esce dal range attivo, `recycleRow()` rimette veicoli/tronchi/monete/power-up/alberi/corsie/decorazioni/treno+segnale nel pool (`poolPut`, max 40 per bucket) invece di fare `dispose()`. Alla creazione di una nuova riga, `poolGet(key)` riusa un oggetto esistente se disponibile. Motivo: QA CrazyGames richiede zero churn di garbage collection su device di fascia bassa.

## Fisica capra e collisioni

### Salto (`tryHop` → `updatePlayer`)
- `HOP_TIME = 0.14s`, `HOP_HEIGHT = 0.55` (raddoppia a 1.6×/1.8× con Super Jump)
- Arco parabolico (`sin(π·t)`), stretch in aria (squash&stretch), zampe/orecchie animate in base alla fase del salto
- Atterraggio: squash verticale che si rilassa in ~0.25s, polvere se su terreno solido

### Veicoli — hitbox reale vs spaziatura visiva
Ogni veicolo ha due valori distinti (fix più recente):
- `halfLen` — mezza-lunghezza "di corsia", usata SOLO per spaziare i veicoli tra loro e per il near-miss ("CLOSE CALL")
- `hit` (= `userData.hitLen`, fallback `halfLen*0.82`) — estensione reale del corpo, usata per la morte
- Auto GLB: `halfLen=0.95 / hit=0.74` · Camion GLB: `1.1 / 0.92` · Auto fallback: `0.85/0.72` · Camion fallback: `1.15/0.98`
- Check morte: `dist(veicolo,capra) < hit + 0.26` (prima usava `halfLen`, causava morti "sfiorando" il retro dell'auto)
- Finestra di salto sicuro sopra un veicolo: `hopHigh = hopping && sin(π·hopT) > 0.45` (arco del salto oltre il 45% d'altezza = invulnerabile ai veicoli sotto)
- Near-miss ("CLOSE CALL"): trigger quando `dist < halfLen+0.95` poi torna `false` quando `dist > halfLen+1.6` — puro stat, +shake+aberrazione cromatica+suono whoosh+testo fluttuante, nessun effetto di gameplay

### Treno
- `hit` = `±0.95` dai bordi reali del vagone (era ±1.1)
- Fase treno: `idle → warn (1.3s, segnale lampeggiante rosso + suono warn) → run (attraversa a velocità `tr.speed`) → idle`
- Fix "flash 1 frame": `tr.mesh.position.x` viene risincronizzato ALLA POSIZIONE nuova PRIMA di rendere il mesh visibile, evitando che appaia un frame nella vecchia posizione fuori schermo

### Fiume/tronchi
- Ogni fiume ha 4-6 tronchi (`grandi(4,5) + (speed<1.5?1:0)`), velocità minima alzata (`grand(1.25,1.8) + diff*1.3 + late*1.0`) — garantisce sempre un tronco raggiungibile in tempo (< 7.5s, sotto la soglia di allarme aquila)
- Atterraggio su tronco: tolleranza `halfLen + 0.48`; la capra viene "agganciata" (`logOffset`) clampato per non sporgere oltre i bordi, segue bob/rollio del tronco
- Cadere fuori dai tronchi = morte "splash" (annegamento)

### Aquila (pressione temporale)
- `idleTimer` cresce se la capra non avanza (si azzera solo avanzando, `dz>0`)
- 7.5s → banner di avviso + ombra crescente proiettata sulla capra (ancora scampabile)
- 11s (o troppo indietro rispetto a `minRow`) → l'aquila appare e insegue, morte se ti raggiunge
- La camera stessa spinge in avanti (`minRow` cresce nel tempo, accelera con `score` e `lateAt`) → costringe il ritmo

## Power-up (main.js: `updatePowers`, `landPlayer`, `die`)

Tutti **automatici al raccolgimento**, nessun tasto di attivazione. Al pickup: `toast()` esplicativo + testo fluttuante + confetti + suono.

| Power-up | Effetto | Durata/uso |
|---|---|---|
| 🛡️ Shield | Assorbe UN colpo di auto/treno (poi 1.2s invulnerabilità extra), si consuma | 1 utilizzo |
| 🧲 Magnet | Attira monete entro 4.5 unità verso la capra | 8 secondi |
| 🚀 Super Jump | Il PROSSIMO salto in avanti copre 2 righe invece di 1 (salta ostacoli/corsie) | 1 utilizzo, si attiva al prossimo tasto ↑ |

HUD in alto mostra le icone attive con countdown (`updatePowerHud`).

## Monete e skin

- Monete: raccolta diretta (atterri sulla cella) o tramite magnete; `totalCoins` persistito in `localStorage`
- 6 skin in `models.js` (`SKINS`): 5 acquistabili con monete + 1 esclusiva "Crazy Goat" (arancio/nero, costo 0, `cgOnly:true`) sbloccata SOLO se `location.hostname` termina in `crazygames.com`

## Punteggio, milestone, record

- `score` = riga massima raggiunta (`landPlayer`)
- Ogni 25 punti: celebrazione + confetti + suono milestone; ogni 50: `sdk.game.happytime()` (CrazyGames)
- Nuovo record (solo se `curBest() >= 5`, evita spam nei primi salti): banner "NEW BEST!" + confetti + flash schermo
- "Close call" (near-miss) contato in `nearMisses`: statistica di stile a fine partita e nel testo di condivisione, NESSUN effetto sul punteggio o sulla sopravvivenza

## Modalità

- **Endless**: `Math.random()`, corre all'infinito, `best` persistito
- **Daily Challenge**: seed deterministico dal giorno corrente (`mulberry32`), stesso mondo per tutti, `dailyBest` per-giorno in `localStorage` (`capra_daily_YYYYMMDD`)

## Morte e ragdoll

`die(kind)` con `kind ∈ {crash, train, splash, eagle}`:
- `crash`/`train` → `ragdoll()`: velocità+spin casuali, gravità simulata manualmente (no physics engine), rimbalza sul terreno con attrito, zampe/orecchie/testa animate proceduralmente durante il volo
- `splash` → affonda ruotando
- `eagle` → la capra viene trascinata in alto seguendo l'aquila
- Slow-mo drammatico (`timeScale=0.25`), shake camera, flash/aberrazione cromatica in post-processing
- Schermo di game-over ritardato (1400ms se ragdoll, 700ms altrimenti) per godersi l'animazione prima dell'overlay

## Revive (CrazyGames rewarded ad)

Un solo utilizzo per run (`reviveUsed`). Richiama `sdkRewarded()`: in produzione mostra pubblicità rewarded reale via SDK CrazyGames; in locale/dev (SDK assente) simula successo dopo 400ms. Se accettato: respawn su riga erba più vicina, colonna libera, 2.5s invulnerabilità, riprende `state='playing'`.

## Integrazione CrazyGames SDK (tutta gated da `window.CrazyGames?.SDK`, no-op se assente)

- `sdkInit()` all'avvio
- `sdkGameplayStart()` al primo salto in avanti della run (non al boot/menu)
- `sdkGameplayStop()` quando appare la schermata di game-over
- `sdkHappy()` ogni 50 punti (segnala momento di successo all'SDK)
- `sdkMidroll(cb)` prima di riavviare dal menu (`restartFromMenu`) — mostra ad interstitial se disponibile
- `sdkRewarded(onDone, onFail)` per il revive
- `onCrazyGames` — flag hostname per contenuti esclusivi (skin Crazy Goat)

## Splash screen / boot

Precarica libreria modelli GLB (`loadLibrary()`), garantisce minimo 2000ms di splash "Presented by CrazyGames" anche se il caricamento è più veloce (branding compliance), poi fade verso il menu titolo.

## Audio

Sintesi 100% WebAudio, nessun file audio:
- SFX: `tone()` (oscillatore con slide di frequenza) e `noise()` (buffer rumoroso filtrato) per hop/coin/crash/splash/warn/eagle/deny/record/whoosh/milestone/power
- Musica di sottofondo: ticker procedurale su scala pentatonica minore (`MUSIC_SCALE`), attivabile/disattivabile (`#mute-btn`)

## Rendering

- Camera ortografica (niente prospettiva/distorsione ai bordi), frustum ricalcolato al resize
- Ciclo giorno/notte (`DAY_PHASES`, colore luce/cielo/ombra interpolato nel tempo)
- Post-processing custom (shader GLSL fullscreen): aberrazione cromatica, color grade saturazione/calore, vignetta, flash-to-white, darken-on-death; correzione gamma manuale `pow(col, 1/2.2)` (necessaria: il render-to-texture in Three r160 non applica sRGB automaticamente in output)
- Ombre PCFSoftShadowMap + tone mapping ACES Filmic
- Nuvole: decal piatti semi-trasparenti a terra (non sfere 3D, altrimenti occludono la visuale in ortografica)

## Debug hook (`window.__dbg`)

Esposto in produzione (innocuo) per test automatizzati Playwright: `rows, player, state, score, nearMisses, mode, reviveUsed, poolSizes, setMode(), revive(), tryHop()`.

## Insidie note / lezioni apprese

1. Three r160 NON applica sRGB automatico su output di render-target → serve gamma manuale nello shader
2. Nuvole 3D volumetriche con camera ortografica finiscono nel campo visivo e coprono il gioco → usare decal piatti
3. `halfLen` (spaziatura visiva tra veicoli in corsia) ≠ `hit` (estensione reale del corpo) — usare sempre `hit` per i controlli di morte, mai `halfLen`
4. Sincronizzare `mesh.position.x` PRIMA di impostare `visible=true` quando un oggetto pooled riappare, altrimenti flash di un frame nella vecchia posizione
5. RNG di world-gen e RNG runtime devono restare separati, altrimenti la daily challenge non è più deterministica/condivisibile tra giocatori

## Update 2026-07-19 — GDD Rebalance & CrazyGames monetization

- **Eagle timer**: warn banner/ombra a 4.0s di inattività (era 7.5), cattura a 5.5s (era 11). Crescita ombra su 1.5s.
- **Monete**: 40% delle righe grass genera una fila di 1-3 monete (`row.coins` array, prima singola `row.coin` al 22%).
- **Power-up pacing**: uno ogni ~40 righe (forzato a 46, probabilistico 25% da 34; `genState.lastPowerRow`).
- **Camera forward-only + muro invisibile**: la camera segue `max(score, minRow)`, mai indietro. `tryHop` con dz=-1 è permesso per schivare, ma negato (suono deny) se `toRow < floor(camRow) - (BEHIND-2)`.
- **Salto Anfibio** (ex Super Jump): 1 uso, a mezz'aria un input direzionale esegue un secondo hop ignorando il ground contact (retarget da `hopTo`); utile per correggere atterraggi sui fiumi.
- **Scudo**: assorbe 1 impatto veicolo/treno + 1.2s invulnerabilità (invariato); ora si disattiva cadendo in acqua.
- **Skin con abilità** (models.js `SKINS`, acquisto in localStorage come le altre):
  - Montone 🪙5000 — scudo intrinseco che si ricarica 45s dopo l'uso (`player.ramT` in `updatePowers`).
  - Alpaca 🪙10000 — 1.2× monete raccolte (accumulatore frazionario `coinCarry`).
  - Lo shop mostra il perk (`.skin-perk` in css).
- **CrazyGames SDK v3**: script `https://sdk.crazygames.com/crazygames-sdk-v3.js` in index.html. Revive rewarded invariato (respawn su grass più vicina, 2.5s invuln, fallback locale). Interstitial `requestAd("midgame")` solo ogni 3 morti cumulative (`deathsSinceAd`) al restart dal menu, mai in gameplay.

## Update 2026-07-20 — Audio sync, collisioni, specie, biomi

- **Audio posizionale**: `playSfx(name, vol)` accetta moltiplicatore volume; `rowAudible(r)` (finestra camera −5..+14 righe) e `rowFalloff(r, range)` (attenuazione per distanza dal player). Treno: horn/rumble SOLO se la riga è visibile, volume per distanza; rumble è in loop agganciato al treno (`tr.rumble`), si spegne a fine corsa e in `recycleRow` (`stopRumble`). Prima si sentivano treni fantasma fino a 8 righe fuori schermo.
- **Auto udibili**: `car_pass.mp3` ora wired — ogni veicolo entro 2 righe dal player che gli passa vicino (dx<2.2) suona con volume per prossimità; flag `v.passed` resettato al wrap o dx>5.
- **Suono collisione**: nuovo `impact_thud.mp3` (ElevenLabs) su morte crash/train e su assorbimento scudo, più `goat_bleat_hurt.mp3` (belato di dolore) su crash/train/eagle.
- **FIX BUG collisioni mid-hop**: `checkCollisions` ora calcola la riga dalla posizione FISICA interpolata (`Math.round(-pz)`), non da `player.row` (che si aggiorna solo all'atterraggio) — prima nella seconda metà del salto la capra era sopra la riga di destinazione ma invulnerabile alle sue auto. Finestra salto-sicuro ristretta: `sin(π·hopT) > 0.62` (era 0.45 = 70% dell'arco invulnerabile).
- **Scudo vs aquila**: lo scudo assorbe anche la presa dell'aquila (aquila scacciata, idleTimer azzerato, 1.5s invuln, slack su minRow). Testato: salva a ~6s di stallo, poi senza scudo l'aquila uccide.
- **Garanzia tronchi**: dopo lo spawn, passate di riempimento con `MAX_GAP = 4.2` unità su tutti i gap (incluso wraparound, beltLen = LANE_W+4) — prima i gap arrivavano a ~17 unità (attesa > timer aquila). Verificato max 4.13 su tutti i fiumi.
- **Specie differenziate** (`makeGoat` shape params): Ram = corna a spirale (TorusGeometry), corpo 1.22×, lana a bozzi (`woolly`), zampe tozze; Alpaca = collo reale (cilindro, `neck: 0.55`), zampe lunghe 1.35× (`lift` alza tutto il corpo), orecchie a banana dritte (`earUp`), ciuffo (`topknot`), niente corna né barba. `headBaseY` in userData per l'idle bob (prima hardcoded 0.72).
- **Versi per specie** (SPACE): capre = goat_bleat_happy "BAAA!", Ram = `ram_bleat.mp3` "BRAAA!", Alpaca = `alpaca_hum.mp3` "MHMM~" (mappa `VOICES` in main.js).
- **Hop**: `goat_hop.mp3` rigenerato come thump morbido senza belato — il belato c'è solo con SPACE.
- **Crazy Goat perk**: 🎲 power-up casuale (shield/magnet/speed) a inizio run, toast "CRAZY START".
- **Biomi**: nomi inglesi con emoji annunciati al passaggio (celebrate + suono milestone, `lastBiomeIdx`); texture terreno per stile (`grassTexture(color, style)`): meadow/leaves(foglie)/sand(dune+sassi)/snow(scintillii)/alpine(pietre)/forest(muschio+funghi); acqua colorata per bioma (turchese costa, ghiaccio inverno, scuro dark forest) con dispose della texture pooled.
- **Skin inglesi**: Snowy/Midnight/Cocoa/Goldie/Zombie/Ram/Alpaca/Crazy Goat (id invariati per localStorage).
- **Icone shop**: `assets/icons/{id}.png` (gpt-image-1, 256px, sfondo trasparente), card `.skin-btn` a dimensione fissa 104×138 (prima Ram/Alpaca erano più grandi per il testo perk), fallback swatch su onerror.
- **`__dbg.step(dt)`**: tick manuale per test headless (il loop è splittato in `tick()` → `frame(rawDt)`).

## Update 2026-07-20 (bis) — Collisioni v2, vita extra, economia sblocchi, accessori, mondi

- **Collisioni v2** (`checkCollisions`): controlla TUTTE le righe che il corpo tocca (`floor(-pz+0.45)..ceil(-pz-0.45)`, max 2 a metà salto). Treno = muro: MAI scavalcabile in salto (prima l'esenzione hopHigh valeva anche per i treni → "ci sbatto e non muoio"). Auto scavalcabili solo all'apice (`sin(π·hopT) > 0.8`, prima 0.62). Testato: catena di salti veloci contro treno in corsa = morte; auto ferma sulla cella d'atterraggio = morte.
- **Vita extra ❤️**: nuovo power-up `heart` (18% dei roll power-up), max 1 accumulabile; se già posseduta il pickup dà +10 monete. Alla morte (qualsiasi causa) consuma la vita e fa `respawnPlayer()` (riga grass più vicina, 2.5s invuln) — helper estratto dal revive. ❤️ nell'HUD power.
- **Economia sblocchi** (SKINS in models.js):
  - Snowy gratis; Midnight/Cocoa/Goldie/Zombie = `adUnlock` (rewarded ad); Piggy 🐷 = animale extra via ad;
  - Ram 🪙5000, Bull 🪙8000 (💥 sfonda alberi/rocce in `tryHop`), Alpaca 🪙10000, Horse 🪙12000 (🐎 salti 20% più rapidi in `hopDur`);
  - Deer = sblocco progressi (`bestUnlock: 150`, auto-grant quando best ≥ 150; 🦅 aquila +2s in `updateEagle`);
  - Crazy Goat resta cgOnly. Versi nuovi: pig_oink, bull_snort, horse_neigh, deer_squeak (mappa VOICES).
- **Negozio a 3 tab** (`renderShop`): 🐐 ANIMALS / 🎩 GEAR / 🌍 WORLDS. GEAR = 9 accessori cosmetici (`ACCESSORIES` in models.js, slot head/neck/back, uno per slot): Bow Tie 150, Party Hat 200, Scarf 300, Cowboy Hat 400, Flower Crown 500, Ranger Vest 600, Gold Chain 900, Hero Cape 1200, Crown 2000 — modelli procedurali, `attachAccessories(goat, equipped)` in makePlayer, persistiti in `capra_acc`/`capra_acc_eq`. Icone emoji nelle card.
- **WORLDS**: bioma di partenza selezionabile; sblocco 🪙400 O rewarded ad (due mini-bottoni espliciti). Offset `effStartBiome()` su biomeAt/biomeIndexAt/biomeAtmoTarget; **daily forza sempre bioma 0** (determinismo condiviso). Backdrop rigenerato al cambio (`backdropBiome`). Persist: `capra_biomes`, `capra_start_biome`.
- **Splash rebrand**: via "Presented by CrazyGames" → logo GOAT CROSSER (icona bianca.png che rimbalza + tagline), min 1400ms (era 2000). Gioco non esclusivo CG.
- **Compliance CrazyGames ads**: `adStarted/adFinished/adError` su midgame e rewarded → mute totale (musica + `playSfx`/`tone`/`noise` gated da `adPlaying`), ripresa musica a fine ad; `loadingStart/loadingStop` attorno al boot; rewarded solo da bottoni espliciti "WATCH AD" (user-initiated); fallback locale senza SDK invariato.
- **Ottimizzazioni**: `ensureRows` incrementale (`genMaxRow`, prima O(score) Map.has per frame); `dayTarget` zero allocazioni (scratch colors); `updatePowerHud` senza DOM churn; shadow map 1024 su mobile (`isMobileish`); `powerPreference: high-performance`; touch handler esclude tutto `#skin-shop`.
- **i18n (`js/i18n.js`)**: 8 lingue (en/it/es/fr/de/pt/ru/pl), rilevamento automatico da `navigator.language` (CrazyGames NON passa la lingua via SDK — il browser è la fonte), override test `?lang=xx`, fallback en. `t(key, {params})` con placeholder `{n}`. Statici via `applyStaticI18n()` al boot; runtime (toast/celebrate/gameover/shop/share/biomi/perk/accessori) tutti via `t()`. Nomi animali propri (Snowy ecc.) NON tradotti; onomatopee versi invariate.
