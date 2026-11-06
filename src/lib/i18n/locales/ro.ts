import type { Dict } from './en';
import { importTab } from './ro-import';
import { errors, warnings } from './ro-notices';

/**
 * Romanian — Chrome's own ro terms (marcaj, Bara de marcaje, dosar), polite
 * plural address ("Importați"), comma-below ș ț never the cedilla look-alikes
 * (U+015F, U+0163), „…” quotes,
 * and three plural forms: `one`, `few` and `other` — "1 marcaj", "5 marcaje",
 * "20 de marcaje" (docs/07 §4–§5). A count-less label repeats the bare noun in
 * `few` and `other`.
 * TODO(review-ro): best-effort until a native pass (docs/00 §10).
 */
export default {
  common: {
    appName: 'BookmarkMagic',
    import: 'Import',
    export: 'Export',
    edit: 'Editare',
    settings: 'Setări',
    about: 'Despre',
    busy: 'Un import este în curs',
    cancel: 'Anulați',
    dismiss: 'Închideți',
    sections: 'Secțiuni',
    detail: 'Detalii tehnice',
  },
  popup: {
    import: 'Importați marcaje…',
    importHint: 'HTML, CSV, copii de rezervă JSON, fișierul Bookmarks din Chrome',
    export: 'Exportați marcaje…',
    exportHint: 'HTML, JSON, CSV sau Markdown',
    manage: 'Deschideți managerul',
    manageHint: 'Editați, sortați, găsiți duplicate',
    bookmarks: { one: 'marcaj', few: 'marcaje', other: 'marcaje' },
    folders: { one: 'dosar', few: 'dosare', other: 'dosare' },
  },
  status: {
    local: 'doar local',
    localNote: 'Fără rețea: extensia nu poate trimite nimic nicăieri.',
    permissionsNote: 'Singurele două permisiuni pe care le are această extensie.',
    more: 'Mai multe',
  },
  import: importTab,
  export: {
    scope: 'Ce se exportă',
    everything: 'Tot',
    format: 'Format',
    start: {
      one: 'Exportați {n} marcaj',
      few: 'Exportați {n} marcaje',
      other: 'Exportați {n} de marcaje',
    },
    started: 'Descărcarea a început: {name}',
    markdownNote: 'Markdown este doar pentru partajare — BookmarkMagic nu îl poate importa înapoi.',
    csvNote:
      'CSV este o vedere aplatizată: nu se păstrează dosarele goale și nici care dosar este bara de marcaje.',
    csvDelimiter: 'Delimitator',
    comma: 'Virgulă ( , )',
    semicolon: 'Punct și virgulă ( ; )',
    markdownStyle: 'Aranjare',
    nested: 'Listă imbricată',
    flat: 'Câte un titlu pentru fiecare dosar',
    formats: {
      'netscape-html': {
        name: 'HTML',
        note: 'Funcționează cu Chrome, Edge, Brave, Firefox, Safari, Vivaldi și Opera.',
      },
      'bm-json': {
        name: 'JSON',
        note: 'Copie de rezervă fără pierderi — cea mai bună alegere pentru o restaurare ulterioară.',
      },
      csv: { name: 'CSV', note: 'Pentru foi de calcul. Aplatizat.' },
      markdown: {
        name: 'Markdown',
        note: 'Pentru partajare într-un README, o postare pe blog sau un chat.',
      },
    },
  },
  edit: {
    tree: 'Arborele de marcaje',
    loading: 'Se citesc marcajele…',
    search: 'Căutați în marcaje',
    filterFolders: 'Filtrați dosarele',
    newFolder: 'Dosar nou',
    newFolderTitle: 'Dosar nou',
    findDuplicates: 'Găsiți duplicatele',
    expandAll: 'Extindeți tot',
    collapseAll: 'Restrângeți tot',
    rename: 'Redenumiți',
    open: 'Deschideți',
    copyUrl: 'Copiați linkul',
    unsafeUrl: 'Această adresă folosește o schemă pe care BookmarkMagic nu o deschide.',
    copied: 'Linkul a fost copiat',
    copyFailed: 'Linkul nu a putut fi copiat.',
    moveTo: 'Mutați în…',
    moveToBody: 'În ce dosar mutați „{title}”?',
    noMoveTargets: 'Nu este disponibil niciun alt dosar.',
    delete: 'Ștergeți',
    untitled: '(fără titlu)',
    empty: 'Încă nu există marcaje — importați câteva pentru a începe.',
    noMatches: 'Nimic nu corespunde căutării.',
    showMore: {
      one: 'Afișați încă {n} rând · ascunse: {total}',
      few: 'Afișați încă {n} rânduri · ascunse: {total}',
      other: 'Afișați încă {n} de rânduri · ascunse: {total}',
    },
    showEarlier: {
      one: 'Afișați {n} rând anterior',
      few: 'Afișați {n} rânduri anterioare',
      other: 'Afișați {n} de rânduri anterioare',
    },
    deleteTitle: 'Ștergeți acest element?',
    deleteBody: 'Ștergeți „{title}”? Acțiunea nu poate fi anulată.',
    deleteFolderBody: {
      one: 'Ștergeți „{title}” și {n} element din el? Acțiunea nu poate fi anulată.',
      few: 'Ștergeți „{title}” și cele {n} elemente din el? Acțiunea nu poate fi anulată.',
      other: 'Ștergeți „{title}” și cele {n} de elemente din el? Acțiunea nu poate fi anulată.',
    },
    duplicates: 'Duplicate',
    duplicateSummary: '{links} · {copies}',
    duplicateLinks: {
      one: '{n} link duplicat',
      few: '{n} linkuri duplicate',
      other: '{n} de linkuri duplicate',
    },
    extraCopies: {
      one: '{n} copie în plus',
      few: '{n} copii în plus',
      other: '{n} de copii în plus',
    },
    noDuplicates: 'Nu s-au găsit linkuri duplicate.',
    keepFirst: {
      one: 'Păstrați primul din fiecare, ștergeți {n} copie',
      few: 'Păstrați primul din fiecare, ștergeți {n} copii',
      other: 'Păstrați primul din fiecare, ștergeți {n} de copii',
    },
    keeps: 'păstrat',
    deleteCopy: 'Ștergeți copia „{title}” din {path}',
    keepFirstTitle: 'Ștergeți copiile duplicate?',
    keepFirstBody: {
      one: 'Păstrați prima copie a fiecărui link și ștergeți {n} copie în plus? Acțiunea nu poate fi anulată.',
      few: 'Păstrați prima copie a fiecărui link și ștergeți celelalte {n} copii? Acțiunea nu poate fi anulată.',
      other:
        'Păstrați prima copie a fiecărui link și ștergeți celelalte {n} de copii? Acțiunea nu poate fi anulată.',
    },
    keepFirstPartial:
      'Copii șterse înainte de eroare: {done} din {total}. Nimic altceva nu a fost eliminat.',
    sort: 'Sortați A→Z',
    sortTitle: 'Sortați „{title}”?',
    sortBody: {
      one: 'Întâi dosarele, apoi marcajele, după nume. Se mută {n} element; nimic nu este redenumit sau șters, iar browserul nu poate anula operația.',
      few: 'Întâi dosarele, apoi marcajele, după nume. Se mută {n} elemente; nimic nu este redenumit sau șters, iar browserul nu poate anula operația.',
      other:
        'Întâi dosarele, apoi marcajele, după nume. Se mută {n} de elemente; nimic nu este redenumit sau șters, iar browserul nu poate anula operația.',
    },
    sortPartial:
      'Elemente mutate înainte ca browserul să refuze: {done} din {total}. Dosarul arată acum ordinea reală.',
    alreadySorted: 'Acest dosar este deja în ordine.',
  },
  settings: {
    autosave: 'Modificările se salvează pe măsură ce le faceți.',
    language: 'Limbă',
    languageNote: 'Se aplică doar acestei extensii, nu browserului.',
    localeAuto: 'Automat (ca browserul)',
    lang: {
      en: 'English',
      vi: 'Tiếng Việt',
      ja: '日本語',
      'zh-CN': '简体中文',
      ro: 'Română',
    },
    theme: 'Temă',
    // TODO(review-ro): "Sistem" is a noun beside two adjectives agreeing with „temă”.
    themes: {
      system: 'Sistem',
      light: 'Luminoasă',
      dark: 'Întunecată',
    },
    defaultExportFormat: 'Format de export implicit',
    defaultExportFormatNote: 'Preselectat când deschideți fila Export.',
    defaultImportMode: 'Mod de import implicit',
    defaultImportModeNote: 'Preselectat când deschideți fila Import.',
    csvDelimiter: 'Delimitator CSV',
    csvDelimiterNote: 'Folosiți punct și virgulă dacă foaia de calcul așteaptă acest separator.',
    markdownStyle: 'Aranjare Markdown',
    markdownStyleNote: 'Cum sunt aranjate dosarele în fișierele Markdown exportate.',
    saved: 'Setările au fost salvate',
    saveFailed: 'Setările nu au putut fi salvate.',
    reset: 'Reveniți la valorile implicite',
    resetTitle: 'Resetați toate setările?',
    resetBody:
      'Limba, tema și fiecare alegere implicită revin la valorile inițiale. Marcajele nu sunt afectate.',
    resetConfirm: 'Resetați',
    resetDone: 'Setările au revenit la valorile implicite',
  },
  about: {
    diagnostics: 'Diagnosticare',
    copyDiagnostics: 'Copiați datele de diagnosticare',
    diagnosticsNote:
      'Un scurt jurnal local cu ce a făcut această filă — coduri de eroare și numere, niciodată titluri sau adrese. Vă părăsește computerul doar dacă îl lipiți undeva.',
    diagnosticsCopied: 'Datele de diagnosticare au fost copiate',
    diagnosticsCopyFailed: 'Datele de diagnosticare nu au putut fi copiate.',
    tagline:
      'Import, export și editare de marcaje între browsere — offline, fără cont, fără cloud. Datele nu vă părăsesc niciodată dispozitivul.',
    version: 'Versiunea {version}',
    links: 'Linkuri',
    repo: 'Depozitul GitHub',
    issues: 'Raportați o problemă',
    changelog: 'Versiuni și jurnalul modificărilor',
    store: 'Pagina din Magazinul Chrome Web',
    thirdParty: 'Cod terț',
    thirdPartyNote:
      'Nu este instalată nicio dependență de rulare. Câteva componente mici cu licență MIT sunt compilate în extensie: runtime-ul Svelte cu utilitarul său clsx și adaptorul de browser de o linie al WXT — consultați THIRD_PARTY_NOTICES.txt din pachet.',
    donate: 'Susțineți dezvoltarea',
    donateNote: 'Complet opțional — BookmarkMagic este software liber oricum.',
    legal: 'Informații juridice',
    accepted: 'Termenii juridici au fost acceptați pe {date} · versiunea {version}',
    acceptedUndated: 'Termenii juridici au fost acceptați · versiunea {version}',
    notAccepted: 'Nu ați acceptat încă termenii juridici.',
  },
  legal: {
    title: 'Înainte de a începe',
    summary:
      'BookmarkMagic rulează în întregime pe dispozitivul dumneavoastră. Nu are servere, nu face cereri în rețea și nu colectează nimic — marcajele și setările nu părăsesc niciodată acest browser. Este software liber sub licența GPL-3.0 și este furnizat fără nicio garanție. Operațiile cu marcaje modifică datele browserului, iar modul „Înlocuire completă” șterge marcajele actuale, așa că păstrați propriile copii de rezervă pentru tot ce contează pentru dumneavoastră.',
    updatedTitle: 'Termenii au fost actualizați',
    updatedBody:
      'Aceste documente s-au modificat de când le-ați acceptat. Citiți-le din nou pentru a continua.',
    documents: 'Documente',
    eula: 'Acord de licență pentru utilizatorul final',
    license: 'Licență (GPL-3.0)',
    disclaimer: 'Declinarea răspunderii',
    privacy: 'Politica de confidențialitate',
    englishNote: 'Documentele cu valoare juridică sunt cele în limba engleză.',
    accept: 'Am citit și accept termenii de mai sus',
    continue: 'Acceptați și continuați',
    close: 'Închideți fila',
    closeManually: 'Acum puteți închide această filă.',
    saveFailed:
      'Acceptarea nu a putut fi salvată, așa că nu s-a înregistrat nimic. Verificați dacă browserul permite stocarea pentru extensii, apoi încercați din nou.',
    blocked: 'Acceptați termenii pentru a folosi filele Import, Export și Editare.',
  },
  warnings,
  errors,
} satisfies Dict;
