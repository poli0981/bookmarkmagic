import type { Dict } from './en';

/** Romanian strings for the Import tab — mirrors en-import.ts; plurals carry `few`. */
export const importTab = {
  dropHint: 'Plasați aici un fișier de marcaje sau dați clic pentru a-l alege · maximum {size}',
  dropFormats:
    'Exporturi HTML din browsere, CSV, copii de rezervă JSON din BookmarkMagic și Firefox, precum și fișierul Bookmarks din Chrome (nu are extensie de fișier).',
  reading: 'Se citește {name}…',
  preview: 'Previzualizare',
  // TODO(review-ro): Chrome ro may say „Importate” for its own import folder.
  folderName: 'Importat {date}',
  start: {
    one: 'Importați {n} marcaj',
    few: 'Importați {n} marcaje',
    other: 'Importați {n} de marcaje',
  },
  backingUp:
    'Se salvează o copie de rezervă de siguranță înainte de a înlocui ceva. Confirmați în fereastra de salvare pentru a continua.',
  keepTabOpen: 'Păstrați această filă deschisă până se termină importul.',
  progress: 'Se importă… {done} / {total}',
  doneSummary: 'Gata — au fost create {bookmarks} și {folders}.',
  skipped: 'Omise — deja în acest browser: {existing}; repetate în fișier: {inFile}.',
  stepSource: 'Sursă',
  stepOptions: 'Opțiuni',
  stepWriting: 'Scriere',
  stepResult: 'Rezultat',
  format: {
    'netscape-html': 'HTML',
    'bm-json': 'BookmarkMagic JSON',
    csv: 'CSV',
    'chrome-json': 'Fișierul Bookmarks din Chrome',
    'firefox-json': 'Copie de rezervă Firefox',
  },
  countBookmarks: { one: '{n} marcaj', few: '{n} marcaje', other: '{n} de marcaje' },
  countFolders: { one: '{n} dosar', few: '{n} dosare', other: '{n} de dosare' },
  countPair: '{bookmarks} și {folders}',
  whereNewFolder:
    'Totul se află în dosarul „{folder}” din Alte marcaje — ștergerea acelui singur dosar anulează importul.',
  whereMerge: 'Elementele noi au fost adăugate la sfârșitul dosarelor din care fac parte.',
  whereReplace: 'Marcajele conțin acum exact ce conține fișierul.',
  replaceConfirmTitle: 'Înlocuiți tot?',
  replaceConfirmBody:
    'Vor fi șterse din acest browser: {current}, după salvarea unei copii de rezervă de siguranță. Apoi se scrie conținutul din {name}: {incoming}.',
  replaceConfirm: 'Salvați copia și înlocuiți',
  target: { bar: 'bară', unfiled: 'Alte marcaje', mobile: 'Mobile' },
  targetNote:
    'La îmbinare și la înlocuire, conținutul acestui dosar ajunge direct în dosarul respectiv al browserului, nu într-o copie a lui.',
  reused: {
    one: 'Elementele au fost adăugate în {n} dosar pe care îl aveați deja, fără a crea o copie.',
    few: 'Elementele au fost adăugate în {n} dosare pe care le aveați deja, fără a crea copii.',
    other:
      'Elementele au fost adăugate în {n} de dosare pe care le aveați deja, fără a crea copii.',
  },
  // Firefox's own ro names for its roots. TODO(review-ro): "Marcaje mobile".
  rootTitle: {
    toolbar: 'Bara de marcaje',
    unfiled: 'Alte marcaje',
    mobile: 'Marcaje mobile',
  },
  cancelledSummary: {
    one: 'Anulat — {n} element fusese deja creat și a rămas pe loc.',
    few: 'Anulat — {n} elemente fuseseră deja create și au rămas pe loc.',
    other: 'Anulat — {n} de elemente fuseseră deja create și au rămas pe loc.',
  },
  cancelledAfterClear:
    'Ați anulat după ce marcajele existente fuseseră deja șterse, așa că a rămas doar partea care a fost refăcută.',
  dateNotice:
    'Marcajele importate poartă data de azi. Chrome nu permite unei extensii să seteze data originală a unui marcaj — fișierele exportate păstrează datele reale.',
  partialCreated: {
    one: '{n} element fusese deja creat înainte de eroare și a rămas pe loc.',
    few: '{n} elemente fuseseră deja create înainte de eroare și au rămas pe loc.',
    other: '{n} de elemente fuseseră deja create înainte de eroare și au rămas pe loc.',
  },
  partialCleared: {
    one: '{n} element de pe primul nivel fusese deja șters înainte de eroare. Restaurați-l din copia de rezervă.',
    few: '{n} elemente de pe primul nivel fuseseră deja șterse înainte de eroare. Restaurați-le din copia de rezervă.',
    other:
      '{n} de elemente de pe primul nivel fuseseră deja șterse înainte de eroare. Restaurați-le din copia de rezervă.',
  },
  backupFileType: 'Copie de rezervă a marcajelor',
  backupHint:
    'Copia de rezervă de siguranță a fost salvată ca {name}. O puteți restaura importând acel fișier JSON.',
  openEdit: 'Deschideți fila Editare',
  another: 'Importați alt fișier',
  dedupe: 'Omiteți duplicatele deja existente în acest browser (găsite: {n})',
  dedupeDisabled: 'Nu se aplică: „Înlocuire completă” șterge mai întâi marcajele actuale.',
  replaceWarning:
    'Această acțiune șterge TOATE marcajele actuale. Mai întâi se salvează o copie de rezervă JSON; ștergerea începe doar după ce aceasta a fost salvată cu succes.',
  attest:
    'Browserul nu a putut confirma că a fost salvată copia de rezervă. Căutați {name} în dosarul de descărcări, apoi confirmați — încă nu s-a șters nimic.',
  attestConfirm: 'Am copia de rezervă — ștergeți și înlocuiți',
  clearing: 'Se șterg marcajele actuale. Nu închideți această filă.',
  badgeNew: 'nou',
  badgeDup: 'duplicat',
  expand: 'Extindeți dosarul',
  collapse: 'Restrângeți dosarul',
  stats: {
    bookmarks: 'Marcaje',
    folders: 'Dosare',
    depth: 'Adâncime maximă',
    duplicates: 'Duplicate',
  },
  mode: {
    legend: 'Cum să fie adăugate?',
    newFolder: 'Într-un dosar nou (recomandat)',
    merge: 'Îmbinare cu dosarele existente',
    replace: 'Înlocuire completă',
    newFolderNote:
      'Nu se atinge nimic din ce există; dacă vă răzgândiți, ștergeți un singur dosar cu dată.',
    mergeNote:
      'Dosarele pe care le aveți deja sunt refolosite; elementele noi ajung la sfârșitul lor.',
    replaceNote:
      'Salvează mai întâi o copie de rezervă, apoi șterge tot. Pentru restaurarea unei copii de rezervă.',
  },
  warnings: {
    title: { one: '{n} avertisment', few: '{n} avertismente', other: '{n} de avertismente' },
  },
} satisfies Dict['import'];
