SPD QR Generator

Tento repozitář obsahuje jednoduchou Electron aplikaci (MVP) pro generování QR kódů ve formátu SPD z dat v Excelu (.xlsx).

Funkce:
- Načtení .xlsx souboru (první list)
- Automatické mapování sloupců podle názvů (IBAN, VS, Amount, atd.)
- Generování SPD textu a uložení PNG souborů pojmenovaných podle VS nebo čísla řádku
- Volba výstupní složky

Jak spustit lokálně (vývoj):
1) npm install
2) npm run start

Jak vytvořit Windows x64 instalátor:
1) npm run dist    (vyžaduje nainstalovaný electron-builder a závislosti)

Poznámky:
- SPD formát je sestaven v jednoduché (minimální) podobě: SPD*1.0*ACC:...*AM:...*CC:...*X-VS:...*MSG:...
  Doporučuji ověřit přesné požadavky banky, pokud je potřeba plná kompatibilita.
- MVP používá v rendereru nodeIntegration=true pro jednoduchost. Pro produkci doporučuji přepsat na kontext izolaci a preload API.

UI a texty jsou v češtině.
