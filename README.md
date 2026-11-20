# Narozeninová nástěnka pro Marťu

Stránka pro Marťu je adresa webu. Stránka, kde kamarádi píšou vzkazy, je stejná adresa s `#napsat` na konci (třeba `https://marta.netlify.app/#napsat`).

## Co je ve složce

- `public/index.html` – samotná stránka (nástěnka i stránka pro psaní)
- `netlify/functions/` – serverové funkce: ukládání a mazání vzkazů, nahrávání videí, ověřování hesel
- `netlify/lib/common.mjs` – společné nastavení (hesla, limity)
- `netlify.toml`, `package.json`, `package-lock.json` – nastavení pro Netlify

**Pozor:** Přetáhnout složku do Netlify Drop nestačí. Drop nenahrává serverové funkce, takže by se vzkazy nedaly ukládat. Použij jednu z cest níže.

## Cesta 1: přes GitHub, bez příkazové řádky

1. Na github.com si vytvoř nový repozitář, třeba `marta-nastenka`. Může být soukromý.
2. V repozitáři zvol nahrání souborů (Add file → Upload files) a přetáhni tam **obsah** rozbalené složky: `public`, `netlify`, `netlify.toml`, `package.json`, `package-lock.json`. Potvrď tlačítkem Commit changes.
3. Na app.netlify.com zvol přidání nového webu z existujícího projektu (Add new site → Import an existing project), vyber GitHub a svůj repozitář.
4. Nastavení nech tak, jak ho Netlify nabídne (načte si ho z `netlify.toml`), a spusť nasazení (Deploy).
5. Za chvíli dostaneš adresu webu. Název webu a tím i adresu si můžeš změnit v nastavení.

Názvy tlačítek se na Netlify i GitHubu můžou trochu lišit, postup ale zůstává stejný.

## Cesta 2: přes příkazovou řádku

Potřebuješ nainstalovaný Node.js. Ve složce projektu spusť:

```
npm install
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

Při prvním nasazení se tě zeptá, jestli chceš založit nový web. Zvol, že ano.

## Hesla

- Psaní vzkazů: `30`
- Správa vzkazů: `narozeniny rodeo` (na velikosti písmen a mezerách nezáleží)

Hesla hlídá server, takže je nejde obejít z prohlížeče. Změnit je můžeš bez úprav kódu: v Netlify v nastavení webu přidej proměnné prostředí (Environment variables) `HESLO_PSANI` nebo `HESLO_SPRAVA` s novým heslem a web nasaď znovu.

## Jak to funguje

- Vzkazy, kresby, fotky a videa se ukládají do úložiště Netlify Blobs přímo u tvého webu.
- Svůj vzkaz může každý upravit nebo smazat jen v prohlížeči a na zařízení, kde ho napsal. Na stejném zařízení může napsat i další vzkazy, třeba za někoho, kdo si s tím neporadí.
- Ve správě (dole na stránce pro psaní) jde po zadání hesla smazat jakýkoli vzkaz. Kdo má správu odemčenou, uvidí i odkazy mezi nástěnkou a stránkou pro psaní.
- Fotky se před odesláním samy zmenší. Video může mít nejvýš 30 MB a nahrává se po částech.
- Videa z iPhonu (`.mov`) se ukládají jako MP4. Na většině zařízení se přehrají, ale video ve formátu HEVC nemusí jít přehrát na některých počítačích s Windows.
