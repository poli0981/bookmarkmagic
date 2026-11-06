import type { Dict } from './en';

/**
 * Romanian warnings and errors — mirrors en-notices.ts (docs/07 §2). Every
 * plural carries `few` (0, 2–19, …01–19) as well as `one` and `other`, and
 * `other` takes "de": "20 de intrări" (docs/07 §5).
 */

export const warnings = {
  NO_BOOKMARKS: {
    one: 'Acest fișier nu conține niciun marcaj.',
    few: 'Acest fișier nu conține niciun marcaj.',
    other: 'Acest fișier nu conține niciun marcaj.',
  },
  DESCRIPTIONS_DROPPED: {
    one: '{n} descriere a fost eliminată — nu are loc în modelul de marcaje.',
    few: '{n} descrieri au fost eliminate — nu au loc în modelul de marcaje.',
    other: '{n} de descrieri au fost eliminate — nu au loc în modelul de marcaje.',
  },
  FAVICONS_IGNORED: {
    one: '{n} pictogramă de site a fost ignorată — API-ul pentru marcaje nu poate seta pictograme.',
    few: '{n} pictograme de site au fost ignorate — API-ul pentru marcaje nu poate seta pictograme.',
    other:
      '{n} de pictograme de site au fost ignorate — API-ul pentru marcaje nu poate seta pictograme.',
  },
  INVALID_DATE: {
    one: '{n} dată ilizibilă a fost lăsată necompletată.',
    few: '{n} date ilizibile au fost lăsate necompletate.',
    other: '{n} de date ilizibile au fost lăsate necompletate.',
  },
  MISSING_URL: {
    one: '{n} intrare nu avea adresă și a fost omisă.',
    few: '{n} intrări nu aveau adresă și au fost omise.',
    other: '{n} de intrări nu aveau adresă și au fost omise.',
  },
  NEWER_VERSION: {
    one: 'Acest fișier a fost scris de o versiune mai nouă — îl citim cât de bine putem.',
    few: 'Acest fișier a fost scris de o versiune mai nouă — îl citim cât de bine putem.',
    other: 'Acest fișier a fost scris de o versiune mai nouă — îl citim cât de bine putem.',
  },
  EMPTY_TITLE: {
    one: '{n} marcaj nu are titlu — browserul va afișa în schimb adresa lui.',
    few: '{n} marcaje nu au titlu — browserul va afișa în schimb adresele lor.',
    other: '{n} de marcaje nu au titlu — browserul va afișa în schimb adresele lor.',
  },
  INVALID_URL: {
    one: '{n} intrare are o adresă pe care browserul nu o poate stoca, așa că a fost omisă.',
    few: '{n} intrări au adrese pe care browserul nu le poate stoca, așa că au fost omise.',
    other: '{n} de intrări au adrese pe care browserul nu le poate stoca, așa că au fost omise.',
  },
  PLACE_QUERIES_SKIPPED: {
    one: '{n} marcaj inteligent Firefox (o căutare salvată, nu o pagină web) a fost omis — aici ar fi un link nefuncțional.',
    few: '{n} marcaje inteligente Firefox (căutări salvate, nu pagini web) au fost omise — aici ar fi linkuri nefuncționale.',
    other:
      '{n} de marcaje inteligente Firefox (căutări salvate, nu pagini web) au fost omise — aici ar fi linkuri nefuncționale.',
  },
  EXTRA_ROOTS_SKIPPED: {
    one: '{n} marcaj dintr-un dosar specific unui browser (cum ar fi Speed Dial sau Coșul de gunoi din Opera) nu a fost importat.',
    few: '{n} marcaje din dosare specifice unui browser (cum ar fi Speed Dial sau Coșul de gunoi din Opera) nu au fost importate.',
    other:
      '{n} de marcaje din dosare specifice unui browser (cum ar fi Speed Dial sau Coșul de gunoi din Opera) nu au fost importate.',
  },
  UNREADABLE_ENTRIES: {
    one: '{n} intrare din acest fișier nu a putut fi citită și a fost omisă.',
    few: '{n} intrări din acest fișier nu au putut fi citite și au fost omise.',
    other: '{n} de intrări din acest fișier nu au putut fi citite și au fost omise.',
  },
} satisfies Dict['warnings'];

export const errors = {
  NOT_NETSCAPE: 'Acesta nu pare a fi un fișier HTML de marcaje.',
  NOT_BM_JSON:
    'Acest fișier JSON nu este un fișier de marcaje pe care BookmarkMagic îl poate citi. BookmarkMagic citește propriile copii de rezervă, copiile de rezervă JSON din Firefox și fișierul Bookmarks al Chrome.',
  MALFORMED_JSON: 'Acest fișier nu este un JSON valid.',
  INVALID_NODE: 'Acest fișier conține o intrare pe care BookmarkMagic nu o poate citi.',
  BAD_CSV_HEADER:
    'Rândul de antet CSV lipsește sau coloanele lui sunt în altă ordine decât trebuie.',
  CSV_ROW_MISMATCH: 'Un rând CSV are un număr greșit de coloane.',
  CSV_UNCLOSED_QUOTE:
    'Un câmp CSV deschis cu ghilimele nu este închis niciodată, așa că restul fișierului nu poate fi citit în mod sigur.',
  UNKNOWN_FORMAT:
    'Fișier nerecunoscut — se aștepta un export HTML de marcaje, un CSV, o copie de rezervă JSON BookmarkMagic sau Firefox ori fișierul Bookmarks al Chrome.',
  FILE_TOO_LARGE: 'Acest fișier este prea mare pentru a fi importat.',
  TOO_MANY_NODES: 'Acest fișier conține prea multe marcaje pentru a fi importat în siguranță.',
  TOO_DEEP: 'Acest fișier are dosare imbricate mult prea adânc.',
  BACKUP_SERIALIZE_FAILED:
    'Copia de rezervă de siguranță nu a putut fi pregătită, așa că nu s-a modificat nimic.',
  BACKUP_EXCEEDS_LIMITS:
    'Marcajele actuale depășesc ce ar putea BookmarkMagic să recitească dintr-o copie de rezervă, așa că Înlocuirea s-a oprit înainte de a șterge ceva. Folosiți în schimb Îmbinarea sau importul într-un dosar nou.',
  BACKUP_STALE:
    'Marcajele s-au tot modificat în timp ce se salva copia de rezervă de siguranță (le edita altă fereastră, altă filă sau sincronizarea), așa că nu s-a șters nimic. Încercați din nou peste câteva momente.',
  BACKUP_CANCELLED: 'Ați anulat copia de rezervă de siguranță, așa că nu s-a șters nimic.',
  BACKUP_WRITE_FAILED:
    'Copia de rezervă de siguranță nu a putut fi salvată, așa că nu s-a șters nimic.',
  BROWSER: 'Browserul a refuzat o operație cu marcaje.',
  WRITE_LOCKED:
    'O altă filă BookmarkMagic scrie marcaje chiar acum. Așteptați să termine, apoi încercați din nou — nu s-a modificat nimic.',
  NO_WRITABLE_ROOTS:
    'Acest profil de browser nu are niciun dosar de marcaje în care BookmarkMagic să aibă voie să scrie. Marcajele gestionate de o organizație nu pot fi modificate.',
  PARTIAL_WRITE: 'Browserul a încetat să mai accepte marcaje în timpul importului.',
  PARTIAL_CLEAR: 'Browserul s-a oprit în timpul înlocuirii marcajelor.',
  UNKNOWN: 'Ceva nu a funcționat.',
} satisfies Dict['errors'];
