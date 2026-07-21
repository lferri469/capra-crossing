// i18n — auto-detects the browser language (CrazyGames serves players worldwide;
// the SDK does not expose a language, so navigator.language is the source of truth).
// Test override: ?lang=it|es|fr|de|pt|ru|pl
const LANGS = ['en', 'it', 'es', 'fr', 'de', 'pt', 'ru', 'pl'];

function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.includes(q)) return q;
  } catch (_) {}
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'en';
}
export const LANG = detect();
const IX = LANGS.indexOf(LANG);

// key -> [en, it, es, fr, de, pt, ru, pl]
const S = {
  subtitle: ['Take the goat as far as you can!', 'Porta la capra più lontano che puoi!', '¡Lleva la cabra lo más lejos posible!', 'Emmène la chèvre aussi loin que possible !', 'Bring die Ziege so weit wie möglich!', 'Leve a cabra o mais longe possível!', 'Проведи козу как можно дальше!', 'Zaprowadź kozę jak najdalej!'],
  endless: ['ENDLESS RUN', 'CORSA INFINITA', 'CARRERA INFINITA', 'COURSE INFINIE', 'ENDLOSLAUF', 'CORRIDA INFINITA', 'БЕСКОНЕЧНЫЙ ЗАБЕГ', 'BIEG BEZ KOŃCA'],
  daily: ['DAILY CHALLENGE', 'SFIDA DEL GIORNO', 'RETO DIARIO', 'DÉFI DU JOUR', 'TAGES-CHALLENGE', 'DESAFIO DIÁRIO', 'ЕЖЕДНЕВНЫЙ ВЫЗОВ', 'DZIENNE WYZWANIE'],
  daily_hud: ['DAILY', 'GIORNO', 'DIARIO', 'JOUR', 'TAG', 'DIÁRIO', 'ДЕНЬ', 'DZIEŃ'],
  loading: ['Loading assets...', 'Caricamento...', 'Cargando...', 'Chargement...', 'Lade...', 'Carregando...', 'Загрузка...', 'Ładowanie...'],
  hint_keys: ['⬆️⬇️⬅️➡️ / WASD – hop · SPACE – panic bleat', '⬆️⬇️⬅️➡️ / WASD – salta · SPAZIO – belato', '⬆️⬇️⬅️➡️ / WASD – salta · ESPACIO – balido', '⬆️⬇️⬅️➡️ / WASD – saute · ESPACE – bêlement', '⬆️⬇️⬅️➡️ / WASD – hüpfen · LEER – Meckern', '⬆️⬇️⬅️➡️ / WASD – pula · ESPAÇO – balido', '⬆️⬇️⬅️➡️ / WASD – прыжок · ПРОБЕЛ – блеяние', '⬆️⬇️⬅️➡️ / WASD – skok · SPACJA – beczenie'],
  hint_swipe: ['📱 swipe to move — 🦅 stall too long and the eagle gets you!', "📱 scorri per muoverti — 🦅 se ti fermi troppo l'aquila ti prende!", '📱 desliza para moverte — 🦅 ¡si te paras mucho, el águila te atrapa!', "📱 glisse pour bouger — 🦅 reste trop immobile et l'aigle t'attrape !", '📱 Wischen zum Bewegen — 🦅 wer trödelt, den holt der Adler!', '📱 deslize para mover — 🦅 pare demais e a águia te pega!', '📱 свайп для движения — 🦅 замешкаешься — орёл схватит!', '📱 przesuń, by się ruszać — 🦅 zwlekaj, a orzeł cię porwie!'],
  press_start: ['or press ENTER', 'o premi INVIO', 'o pulsa ENTER', 'ou appuie sur ENTRÉE', 'oder ENTER drücken', 'ou pressione ENTER', 'или нажми ENTER', 'lub naciśnij ENTER'],
  play_btn: ['▶ PLAY', '▶ GIOCA', '▶ JUGAR', '▶ JOUER', '▶ SPIELEN', '▶ JOGAR', '▶ ИГРАТЬ', '▶ GRAJ'],
  tagline: ['Hop. Dodge. Survive.', 'Salta. Schiva. Sopravvivi.', 'Salta. Esquiva. Sobrevive.', 'Saute. Esquive. Survis.', 'Hüpf. Weich aus. Überleb.', 'Pule. Desvie. Sobreviva.', 'Прыгай. Уклоняйся. Выживай.', 'Skacz. Unikaj. Przetrwaj.'],
  tab_animals: ['ANIMALS', 'ANIMALI', 'ANIMALES', 'ANIMAUX', 'TIERE', 'ANIMAIS', 'ЖИВОТНЫЕ', 'ZWIERZĘTA'],
  tab_gear: ['GEAR', 'ACCESSORI', 'EQUIPO', 'ÉQUIPEMENT', 'AUSRÜSTUNG', 'EQUIPAMENTO', 'ЭКИПИРОВКА', 'DODATKI'],
  tab_worlds: ['WORLDS', 'MONDI', 'MUNDOS', 'MONDES', 'WELTEN', 'MUNDOS', 'МИРЫ', 'ŚWIATY'],
  revive_btn: ['📺 WATCH AD · REVIVE', '📺 GUARDA VIDEO · RINASCI', '📺 VER ANUNCIO · REVIVIR', '📺 PUB · REVIVRE', '📺 WERBUNG · WEITERSPIELEN', '📺 VER ANÚNCIO · REVIVER', '📺 РЕКЛАМА · ВОЗРОДИТЬСЯ', '📺 OBEJRZYJ REKLAMĘ · WSKRZEŚ'],
  try_again: ['TRY AGAIN', 'RIPROVA', 'REINTENTAR', 'REJOUER', 'NOCHMAL', 'TENTAR DE NOVO', 'ЕЩЁ РАЗ', 'JESZCZE RAZ'],
  share_btn: ['📣 CHALLENGE FRIENDS', '📣 SFIDA GLI AMICI', '📣 RETA A TUS AMIGOS', '📣 DÉFIE TES AMIS', '📣 FREUNDE HERAUSFORDERN', '📣 DESAFIE AMIGOS', '📣 ВЫЗОВИ ДРУЗЕЙ', '📣 RZUĆ WYZWANIE ZNAJOMYM'],
  menu_btn: ['🏠 MENU & SHOP', '🏠 MENU & NEGOZIO', '🏠 MENÚ Y TIENDA', '🏠 MENU & BOUTIQUE', '🏠 MENÜ & SHOP', '🏠 MENU & LOJA', '🏠 МЕНЮ И МАГАЗИН', '🏠 MENU & SKLEP'],
  or_enter: ['or press ENTER', 'o premi INVIO', 'o pulsa ENTER', 'ou appuie sur ENTRÉE', 'oder ENTER drücken', 'ou pressione ENTER', 'или нажми ENTER', 'lub naciśnij ENTER'],
  eagle_warn: ['🦅 EAGLE INCOMING — MOVE!', "🦅 ARRIVA L'AQUILA — MUOVITI!", '🦅 ¡ÁGUILA A LA VISTA — MUÉVETE!', "🦅 L'AIGLE ARRIVE — BOUGE !", '🦅 ADLER IM ANFLUG — BEWEG DICH!', '🦅 ÁGUIA CHEGANDO — MEXA-SE!', '🦅 ОРЁЛ ЛЕТИТ — ДВИГАЙСЯ!', '🦅 ORZEŁ NADLATUJE — RUSZAJ SIĘ!'],
  best: ['BEST', 'RECORD', 'RÉCORD', 'RECORD', 'REKORD', 'RECORDE', 'РЕКОРД', 'REKORD'],
  go_crash: ['SQUASHED!', 'SPIACCICATA!', '¡APLASTADA!', 'ÉCRASÉE !', 'PLATTGEMACHT!', 'ESMAGADA!', 'РАЗДАВИЛО!', 'ROZGNIECIONA!'],
  go_splash: ['GLUG GLUG GLUG...', 'GLU GLU GLU...', 'GLU GLU GLU...', 'GLOU GLOU GLOU...', 'BLUBB BLUBB...', 'GLUB GLUB GLUB...', 'БУЛЬ-БУЛЬ-БУЛЬ...', 'BUL BUL BUL...'],
  go_train: ['TRAIN FLATTENED!', 'STIRATA DAL TRENO!', '¡ARROLLADA POR EL TREN!', 'APLATIE PAR LE TRAIN !', 'VOM ZUG ÜBERROLLT!', 'ATROPELADA PELO TREM!', 'ПОЕЗД ПЕРЕЕХАЛ!', 'ROZJECHANA PRZEZ POCIĄG!'],
  go_eagle: ['EAGLE SNATCHED!', "RAPITA DALL'AQUILA!", '¡ATRAPADA POR EL ÁGUILA!', "ENLEVÉE PAR L'AIGLE !", 'VOM ADLER GESCHNAPPT!', 'LEVADA PELA ÁGUIA!', 'ОРЁЛ УНЁС!', 'PORWANA PRZEZ ORŁA!'],
  new_best_n: ['NEW BEST {n}!', 'NUOVO RECORD {n}!', '¡NUEVO RÉCORD {n}!', 'NOUVEAU RECORD {n} !', 'NEUER REKORD {n}!', 'NOVO RECORDE {n}!', 'НОВЫЙ РЕКОРД {n}!', 'NOWY REKORD {n}!'],
  new_daily_best_n: ['NEW DAILY BEST {n}!', 'NUOVO RECORD DEL GIORNO {n}!', '¡NUEVO RÉCORD DIARIO {n}!', 'NOUVEAU RECORD DU JOUR {n} !', 'NEUER TAGESREKORD {n}!', 'NOVO RECORDE DIÁRIO {n}!', 'НОВЫЙ ДНЕВНОЙ РЕКОРД {n}!', 'NOWY DZIENNY REKORD {n}!'],
  daily_best_n: ['DAILY BEST {n}', 'RECORD DEL GIORNO {n}', 'RÉCORD DIARIO {n}', 'RECORD DU JOUR {n}', 'TAGESREKORD {n}', 'RECORDE DIÁRIO {n}', 'ДНЕВНОЙ РЕКОРД {n}', 'DZIENNY REKORD {n}'],
  close_calls: ['close calls', 'schivate al pelo', 'por los pelos', 'de justesse', 'Beinahe-Treffer', 'por um triz', 'на волоске', 'o włos'],
  c_new_best: ['NEW BEST!', 'NUOVO RECORD!', '¡NUEVO RÉCORD!', 'NOUVEAU RECORD !', 'NEUER REKORD!', 'NOVO RECORDE!', 'НОВЫЙ РЕКОРД!', 'NOWY REKORD!'],
  c_shield: ['SHIELD!', 'SCUDO!', '¡ESCUDO!', 'BOUCLIER !', 'SCHILD!', 'ESCUDO!', 'ЩИТ!', 'TARCZA!'],
  c_magnet: ['MAGNET!', 'MAGNETE!', '¡IMÁN!', 'AIMANT !', 'MAGNET!', 'ÍMÃ!', 'МАГНИТ!', 'MAGNES!'],
  c_speed: ['SUPER SPEED!', 'SUPER VELOCITÀ!', '¡SUPER VELOCIDAD!', 'SUPER VITESSE !', 'SUPER-TEMPO!', 'SUPER VELOCIDADE!', 'СУПЕРСКОРОСТЬ!', 'SUPERPRĘDKOŚĆ!'],
  c_life: ['EXTRA LIFE!', 'VITA EXTRA!', '¡VIDA EXTRA!', 'VIE BONUS !', 'EXTRALEBEN!', 'VIDA EXTRA!', 'ДОП. ЖИЗНЬ!', 'DODATKOWE ŻYCIE!'],
  c_shield_down: ['SHIELD DOWN!', 'SCUDO ROTTO!', '¡ESCUDO ROTO!', 'BOUCLIER BRISÉ !', 'SCHILD WEG!', 'ESCUDO QUEBROU!', 'ЩИТ СЛОМАН!', 'TARCZA PADŁA!'],
  c_shield_saved: ['SHIELD SAVED YOU!', 'SALVATA DALLO SCUDO!', '¡EL ESCUDO TE SALVÓ!', 'SAUVÉE PAR LE BOUCLIER !', 'SCHILD HAT DICH GERETTET!', 'O ESCUDO TE SALVOU!', 'ЩИТ СПАС ТЕБЯ!', 'TARCZA CIĘ URATOWAŁA!'],
  c_revived: ['REVIVED!', 'RINATA!', '¡REVIVIDA!', 'RESSUSCITÉE !', 'WIEDERBELEBT!', 'REVIVEU!', 'ВОЗРОЖДЕНИЕ!', 'WSKRZESZONA!'],
  c_smash: ['SMASH!', 'SFONDATO!', '¡PUMBA!', 'BOUM !', 'ZERSCHMETTERT!', 'ESMAGOU!', 'ХРЯСЬ!', 'ŁUBUDU!'],
  c_close: ['CLOSE CALL!', 'PER UN PELO!', '¡POR POCO!', 'DE JUSTESSE !', 'KNAPP!', 'POR POUCO!', 'ЕЛЕ УШЛА!', 'O WŁOS!'],
  c_ram_shield: ['RAM SHIELD!', 'SCUDO ARIETE!', '¡ESCUDO CARNERO!', 'BOUCLIER BÉLIER !', 'WIDDER-SCHILD!', 'ESCUDO CARNEIRO!', 'ЩИТ БАРАНА!', 'TARCZA BARANA!'],
  t_shield: ['🛡️ SHIELD — blocks one car/train hit, automatic', '🛡️ SCUDO — assorbe un colpo di auto/treno, automatico', '🛡️ ESCUDO — bloquea un golpe de coche/tren, automático', '🛡️ BOUCLIER — bloque un coup de voiture/train, automatique', '🛡️ SCHILD — blockt einen Auto-/Zug-Treffer, automatisch', '🛡️ ESCUDO — bloqueia um golpe de carro/trem, automático', '🛡️ ЩИТ — блокирует один удар машины/поезда, автоматически', '🛡️ TARCZA — blokuje jedno uderzenie auta/pociągu, automatycznie'],
  t_magnet: ['🧲 MAGNET — pulls nearby coins for 8s, automatic', '🧲 MAGNETE — attira le monete vicine per 8s, automatico', '🧲 IMÁN — atrae monedas cercanas durante 8s, automático', '🧲 AIMANT — attire les pièces proches pendant 8s, automatique', '🧲 MAGNET — zieht 8s lang Münzen an, automatisch', '🧲 ÍMÃ — atrai moedas próximas por 8s, automático', '🧲 МАГНИТ — притягивает монеты 8с, автоматически', '🧲 MAGNES — przyciąga monety przez 8s, automatycznie'],
  t_speed: ['⚡ SUPER SPEED — hop faster for 6s, automatic', '⚡ SUPER VELOCITÀ — salti più rapidi per 6s, automatico', '⚡ SUPER VELOCIDAD — saltos más rápidos durante 6s, automático', '⚡ SUPER VITESSE — sauts plus rapides pendant 6s, automatique', '⚡ SUPER-TEMPO — 6s schneller hüpfen, automatisch', '⚡ SUPER VELOCIDADE — pulos mais rápidos por 6s, automático', '⚡ СУПЕРСКОРОСТЬ — быстрые прыжки 6с, автоматически', '⚡ SUPERPRĘDKOŚĆ — szybsze skoki przez 6s, automatycznie'],
  t_heart: ['❤️ EXTRA LIFE — you respawn once if you die (max 1)', '❤️ VITA EXTRA — rinasci una volta se muori (max 1)', '❤️ VIDA EXTRA — revives una vez si mueres (máx 1)', '❤️ VIE BONUS — tu ressuscites une fois si tu meurs (max 1)', '❤️ EXTRALEBEN — einmal wiederbeleben beim Tod (max. 1)', '❤️ VIDA EXTRA — você renasce uma vez se morrer (máx 1)', '❤️ ДОП. ЖИЗНЬ — одно возрождение после смерти (макс 1)', '❤️ DODATKOWE ŻYCIE — odradzasz się raz po śmierci (maks 1)'],
  t_unlocked: ['📺 {name} unlocked!', '📺 {name} sbloccato!', '📺 ¡{name} desbloqueado!', '📺 {name} débloqué !', '📺 {name} freigeschaltet!', '📺 {name} desbloqueado!', '📺 {name} открыто!', '📺 {name} odblokowane!'],
  t_ad_fail: ['Ad unavailable — try again later.', 'Video non disponibile — riprova più tardi.', 'Anuncio no disponible — inténtalo más tarde.', 'Pub indisponible — réessaie plus tard.', 'Werbung nicht verfügbar — versuch es später.', 'Anúncio indisponível — tente mais tarde.', 'Реклама недоступна — попробуй позже.', 'Reklama niedostępna — spróbuj później.'],
  t_cg_only: ['Play on CrazyGames.com to unlock Crazy Goat!', 'Gioca su CrazyGames.com per sbloccare Crazy Goat!', '¡Juega en CrazyGames.com para desbloquear Crazy Goat!', 'Joue sur CrazyGames.com pour débloquer Crazy Goat !', 'Spiel auf CrazyGames.com, um Crazy Goat freizuschalten!', 'Jogue em CrazyGames.com para desbloquear o Crazy Goat!', 'Играй на CrazyGames.com, чтобы открыть Crazy Goat!', 'Graj na CrazyGames.com, by odblokować Crazy Goat!'],
  t_no_coins: ['Not enough coins — {name} costs 🪙 {c}', 'Monete insufficienti — {name} costa 🪙 {c}', 'Monedas insuficientes — {name} cuesta 🪙 {c}', 'Pas assez de pièces — {name} coûte 🪙 {c}', 'Zu wenig Münzen — {name} kostet 🪙 {c}', 'Moedas insuficientes — {name} custa 🪙 {c}', 'Не хватает монет — {name} стоит 🪙 {c}', 'Za mało monet — {name} kosztuje 🪙 {c}'],
  t_reach_best_full: ['🏁 Reach a best score of {n} to unlock {name} (yours: {b})', '🏁 Raggiungi un record di {n} per sbloccare {name} (il tuo: {b})', '🏁 Alcanza un récord de {n} para desbloquear {name} (el tuyo: {b})', '🏁 Atteins un record de {n} pour débloquer {name} (le tien : {b})', '🏁 Erreiche einen Rekord von {n} für {name} (deiner: {b})', '🏁 Alcance um recorde de {n} para desbloquear {name} (o seu: {b})', '🏁 Набери рекорд {n}, чтобы открыть {name} (твой: {b})', '🏁 Osiągnij rekord {n}, by odblokować {name} (twój: {b})'],
  t_copied: ['📋 Score copied — paste it anywhere!', '📋 Punteggio copiato — incollalo dove vuoi!', '📋 Puntuación copiada — ¡pégala donde quieras!', '📋 Score copié — colle-le où tu veux !', '📋 Punktzahl kopiert — überall einfügbar!', '📋 Pontuação copiada — cole onde quiser!', '📋 Счёт скопирован — вставь куда угодно!', '📋 Wynik skopiowany — wklej gdzie chcesz!'],
  t_crazy_start: ['🎲 CRAZY START — free {kind}!', '🎲 CRAZY START — {kind} gratis!', '🎲 CRAZY START — ¡{kind} gratis!', '🎲 CRAZY START — {kind} gratuit !', '🎲 CRAZY START — gratis {kind}!', '🎲 CRAZY START — {kind} grátis!', '🎲 CRAZY START — бесплатный {kind}!', '🎲 CRAZY START — darmowy {kind}!'],
  equipped: ['EQUIPPED', 'IN USO', 'EQUIPADO', 'ÉQUIPÉ', 'AUSGERÜSTET', 'EQUIPADO', 'НАДЕТО', 'ZAŁOŻONE'],
  select: ['SELECT', 'SCEGLI', 'ELEGIR', 'CHOISIR', 'WÄHLEN', 'ESCOLHER', 'ВЫБРАТЬ', 'WYBIERZ'],
  wear: ['WEAR', 'INDOSSA', 'PONER', 'PORTER', 'TRAGEN', 'USAR', 'НАДЕТЬ', 'ZAŁÓŻ'],
  unwear: ['EQUIPPED · tap to remove', 'INDOSSATO · tocca per togliere', 'EQUIPADO · toca para quitar', 'ÉQUIPÉ · tape pour retirer', 'AUSGERÜSTET · zum Ablegen tippen', 'EQUIPADO · toque para tirar', 'НАДЕТО · нажми, чтобы снять', 'ZAŁOŻONE · dotknij, by zdjąć'],
  watch_ad: ['📺 WATCH AD', '📺 GUARDA VIDEO', '📺 VER ANUNCIO', '📺 VOIR LA PUB', '📺 WERBUNG ANSEHEN', '📺 VER ANÚNCIO', '📺 СМОТРЕТЬ РЕКЛАМУ', '📺 OBEJRZYJ REKLAMĘ'],
  reach_best: ['🏁 REACH BEST {n}', '🏁 RECORD {n}', '🏁 RÉCORD {n}', '🏁 RECORD {n}', '🏁 REKORD {n}', '🏁 RECORDE {n}', '🏁 РЕКОРД {n}', '🏁 REKORD {n}'],
  cg_lock: ['🔒 CrazyGames only', '🔒 Solo su CrazyGames', '🔒 Solo en CrazyGames', '🔒 Uniquement sur CrazyGames', '🔒 Nur auf CrazyGames', '🔒 Só no CrazyGames', '🔒 Только на CrazyGames', '🔒 Tylko na CrazyGames'],
  starting_here: ['STARTING HERE', 'PARTENZA ATTUALE', 'INICIO ACTUAL', 'DÉPART ACTUEL', 'AKTUELLER START', 'INÍCIO ATUAL', 'ТЕКУЩИЙ СТАРТ', 'OBECNY START'],
  start_here: ['START HERE', 'PARTI DA QUI', 'EMPEZAR AQUÍ', "PARTIR D'ICI", 'HIER STARTEN', 'COMEÇAR AQUI', 'СТАРТОВАТЬ ЗДЕСЬ', 'STARTUJ TUTAJ'],
  unlock_hint: ['unlock to start here', 'sblocca per partire qui', 'desbloquea para empezar aquí', "débloque pour partir d'ici", 'freischalten, um hier zu starten', 'desbloqueie para começar aqui', 'открой, чтобы стартовать здесь', 'odblokuj, by startować tutaj'],
  perk_montone: ['🛡️ auto-shield every 45s', '🛡️ scudo automatico ogni 45s', '🛡️ escudo automático cada 45s', '🛡️ bouclier auto toutes les 45s', '🛡️ Auto-Schild alle 45s', '🛡️ escudo automático a cada 45s', '🛡️ авто-щит каждые 45с', '🛡️ auto-tarcza co 45s'],
  perk_alpaca: ['🪙 1.2× coins', '🪙 1.2× monete', '🪙 1.2× monedas', '🪙 1.2× pièces', '🪙 1.2× Münzen', '🪙 1.2× moedas', '🪙 1.2× монет', '🪙 1.2× monet'],
  perk_bull: ['💥 smashes trees & rocks', '💥 sfonda alberi e rocce', '💥 rompe árboles y rocas', '💥 brise arbres et rochers', '💥 zertrümmert Bäume & Felsen', '💥 quebra árvores e pedras', '💥 крушит деревья и камни', '💥 rozbija drzewa i skały'],
  perk_horse: ['🐎 20% faster hops', '🐎 salti 20% più veloci', '🐎 saltos 20% más rápidos', '🐎 sauts 20% plus rapides', '🐎 20% schnellere Sprünge', '🐎 pulos 20% mais rápidos', '🐎 прыжки на 20% быстрее', '🐎 skoki szybsze o 20%'],
  perk_deer: ['🦅 eagle waits +2s', "🦅 l'aquila aspetta +2s", '🦅 el águila espera +2s', "🦅 l'aigle attend +2s", '🦅 Adler wartet +2s', '🦅 águia espera +2s', '🦅 орёл ждёт +2с', '🦅 orzeł czeka +2s'],
  perk_crazy: ['🎲 random power-up at start', "🎲 power-up casuale all'inizio", '🎲 potenciador aleatorio al inicio', '🎲 bonus aléatoire au départ', '🎲 zufälliges Power-up am Start', '🎲 power-up aleatório no início', '🎲 случайный бонус на старте', '🎲 losowy bonus na starcie'],
  perk_pig: ['🐽 just adorable', '🐽 semplicemente adorabile', '🐽 simplemente adorable', '🐽 tout simplement adorable', '🐽 einfach zuckersüß', '🐽 simplesmente adorável', '🐽 просто прелесть', '🐽 po prostu uroczy'],
  acc_bowtie: ['Bow Tie', 'Papillon', 'Pajarita', 'Nœud papillon', 'Fliege', 'Gravata-borboleta', 'Бабочка', 'Muszka'],
  acc_party: ['Party Hat', 'Cappello Festa', 'Gorro de Fiesta', 'Chapeau de Fête', 'Partyhut', 'Chapéu de Festa', 'Колпак', 'Czapka Imprezowa'],
  acc_scarf: ['Cozy Scarf', 'Sciarpa', 'Bufanda', 'Écharpe', 'Schal', 'Cachecol', 'Шарф', 'Szalik'],
  acc_cowboy: ['Cowboy Hat', 'Cappello Cowboy', 'Sombrero Vaquero', 'Chapeau de Cowboy', 'Cowboyhut', 'Chapéu de Cowboy', 'Ковбойская шляпа', 'Kapelusz Kowbojski'],
  acc_flower: ['Flower Crown', 'Corona di Fiori', 'Corona de Flores', 'Couronne de Fleurs', 'Blumenkranz', 'Coroa de Flores', 'Венок из цветов', 'Wianek'],
  acc_vest: ['Ranger Vest', 'Gilet', 'Chaleco', 'Gilet', 'Weste', 'Colete', 'Жилет', 'Kamizelka'],
  acc_chain: ["Gold Chain", "Collana d'Oro", 'Cadena de Oro', 'Chaîne en Or', 'Goldkette', 'Corrente de Ouro', 'Золотая цепь', 'Złoty Łańcuch'],
  acc_cape: ['Hero Cape', 'Mantello da Eroe', 'Capa de Héroe', 'Cape de Héros', 'Heldenumhang', 'Capa de Herói', 'Плащ героя', 'Peleryna Bohatera'],
  acc_crown: ['Royal Crown', 'Corona Reale', 'Corona Real', 'Couronne Royale', 'Königskrone', 'Coroa Real', 'Корона', 'Korona Królewska'],
  slot_head: ['HEAD', 'TESTA', 'CABEZA', 'TÊTE', 'KOPF', 'CABEÇA', 'ГОЛОВА', 'GŁOWA'],
  slot_neck: ['NECK', 'COLLO', 'CUELLO', 'COU', 'HALS', 'PESCOÇO', 'ШЕЯ', 'SZYJA'],
  slot_back: ['BACK', 'SCHIENA', 'ESPALDA', 'DOS', 'RÜCKEN', 'COSTAS', 'СПИНА', 'GRZBIET'],
  biome_0: ['MEADOWLANDS', 'PRATERIA', 'PRADERA', 'PRAIRIE', 'WIESENLAND', 'CAMPINA', 'ЛУГА', 'ŁĄKI'],
  biome_1: ['AUTUMN WOODS', "BOSCO D'AUTUNNO", 'BOSQUE OTOÑAL', "BOIS D'AUTOMNE", 'HERBSTWALD', 'BOSQUE DE OUTONO', 'ОСЕННИЙ ЛЕС', 'JESIENNY LAS'],
  biome_2: ['SUNNY COAST', 'COSTA ASSOLATA', 'COSTA SOLEADA', 'CÔTE ENSOLEILLÉE', 'SONNENKÜSTE', 'COSTA ENSOLARADA', 'СОЛНЕЧНЫЙ БЕРЕГ', 'SŁONECZNE WYBRZEŻE'],
  biome_3: ['DUSTY DESERT', 'DESERTO', 'DESIERTO', 'DÉSERT', 'WÜSTE', 'DESERTO', 'ПУСТЫНЯ', 'PUSTYNIA'],
  biome_4: ['HIGH PEAKS', 'ALTE VETTE', 'CUMBRES', 'HAUTS SOMMETS', 'GIPFELWELT', 'PICOS ALTOS', 'ВЫСОКИЕ ПИКИ', 'SZCZYTY'],
  biome_5: ['FROZEN FIELDS', 'CAMPI GELATI', 'CAMPOS HELADOS', 'CHAMPS GELÉS', 'FROSTFELDER', 'CAMPOS GELADOS', 'МЁРЗЛЫЕ ПОЛЯ', 'MROŹNE POLA'],
  biome_6: ['DARK FOREST', 'BOSCO OSCURO', 'BOSQUE OSCURO', 'FORÊT SOMBRE', 'DUNKELWALD', 'FLORESTA SOMBRIA', 'ТЁМНЫЙ ЛЕС', 'MROCZNY LAS'],
  share_text: ['{emo} I took the goat {n} hops in GOAT CROSSER! (best: {b}) — can you beat me?', '{emo} Ho portato la capra a {n} salti in GOAT CROSSER! (record: {b}) — sai fare di meglio?', '{emo} ¡Llevé la cabra a {n} saltos en GOAT CROSSER! (récord: {b}) — ¿puedes superarme?', "{emo} J'ai emmené la chèvre à {n} sauts dans GOAT CROSSER ! (record : {b}) — tu fais mieux ?", '{emo} Ich habe die Ziege {n} Hüpfer weit gebracht in GOAT CROSSER! (Rekord: {b}) — schaffst du mehr?', '{emo} Levei a cabra a {n} pulos no GOAT CROSSER! (recorde: {b}) — consegue me superar?', '{emo} Я провёл козу на {n} прыжков в GOAT CROSSER! (рекорд: {b}) — сможешь лучше?', '{emo} Zaprowadziłem kozę na {n} skoków w GOAT CROSSER! (rekord: {b}) — pobijesz mnie?'],
};

// t('key') or t('key', {n: 5, name: 'Bull'})
export function t(key, params) {
  const row = S[key];
  if (!row) return null;
  let s = row[IX] ?? row[0];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
