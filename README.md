# Diario di bordo

Sito statico (HTML, CSS, JavaScript) con quattro sezioni:

- **Oggi**: la giornata corrente, le cose da riprendere, i punti per Roberto e il to-do.
- **Giornate**: tutti i report giornalieri, con ricerca ed etichette.
- **Sync con Roberto**: punti da discutere, decisioni da ricordare, punti già discussi.
- **To-do personale**: cose da fare con scadenza facoltativa.

## Dove stanno i contenuti

Tutto è in `data/`:

| File | Contenuto |
| --- | --- |
| `data/diario.js` | una voce per ogni giornata |
| `data/roberto.js` | punti per il sync e decisioni di Roberto |
| `data/todo.js` | to-do personale |

Per aggiungere qualcosa, chiedilo a Claude oppure modifica questi file direttamente (ogni file ha un commento in cima con i campi).

Le spunte e le voci aggiunte dal sito restano solo nel browser in cui le fai. Quello che deve restare per sempre va scritto nei file di `data/`.

## Pubblicare su GitHub Pages

1. Crea un repository su GitHub e carica tutto il contenuto di questa cartella nella radice.
2. Vai in **Settings > Pages**.
3. In **Source** scegli **Deploy from a branch**, poi il branch `main` e la cartella `/ (root)`.
4. Dopo un minuto il sito è online all'indirizzo che GitHub mostra in quella pagina.

Attenzione: su un account gratuito GitHub Pages pubblica il sito per tutti, anche se il repository è privato. Non scrivere dati sensibili di clienti o dell'azienda. Se servono, usa un piano GitHub che permette Pages privato, oppure tieni il sito solo in locale aprendo `index.html`.

## Aprirlo in locale

Apri `index.html` con un doppio clic. Non serve nessun server.
