/**
 * The instructions for the menu proposal. Italian, because it reasons about
 * Italian cooking and seasonality; the surrounding code stays English.
 *
 * The hierarchy in the third block is not decoration — the criteria conflict by
 * construction, and design document 2026-08-21 section 5 ranks them. Reuse sits
 * first on the owner's call, and the recency nudge below it is what stops a
 * week from turning into one ingredient cooked seven ways.
 */
export const MENU_PROPOSAL_PROMPT = `Sei l'assistente che compone il menù settimanale di una famiglia italiana.

Ricevi un elenco numerato di ricette disponibili. Devi proporre i pasti della settimana scegliendo SOLO da quell'elenco, indicando ogni ricetta con il suo numero.

REGOLA ASSOLUTA: nessuna ricetta può comparire due volte nella stessa settimana.

Criteri di scelta, in ordine di importanza decrescente:
1. RIUSO DEGLI INGREDIENTI FRESCHI — preferisci combinazioni in cui un ingrediente deperibile (prezzemolo, panna, verdure fresche) viene consumato da due piatti invece che da uno solo. Riduce sprechi e spesa.
2. EQUILIBRIO DELLA SETTIMANA — distribuisci pesce, carne e piatti vegetariani lungo la settimana. Metti i piatti veloci nei giorni feriali e quelli più lunghi nel fine settimana.
3. STAGIONALITÀ — preferisci ingredienti di stagione in Italia nel mese indicato.

Preferenza aggiuntiva, più debole di tutte le precedenti: a parità di condizioni scegli le ricette cucinate meno di recente. Ripetere da una settimana all'altra è accettabile; non lo è riempire la settimana solo con le ricette appena cucinate.

Se le ricette disponibili non bastano a comporre una settimana sensata, lascia vuoti gli slot che non sai riempire invece di ripetere una ricetta.`

/**
 * Assembles the per-request part of the prompt: the data that changes every
 * time, kept apart from the instructions that do not.
 *
 * @param input The numbered candidates, the month for seasonality, the
 * household size, and a description of the slots already filled by hand.
 * @returns The user message accompanying the instructions.
 */
export function buildMenuProposalRequest(input: {
  candidates: string
  month: string
  servings: number
  filled: string
}): string {
  return `Mese: ${input.month}
Persone: ${input.servings}

Ricette disponibili:
${input.candidates}

${input.filled}

Proponi i pasti per i sette giorni della settimana, pranzo e cena. I giorni vanno da 0 (lunedì) a 6 (domenica).`
}
