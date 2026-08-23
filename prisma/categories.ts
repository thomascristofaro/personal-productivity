// The list the household starts from, not the list it ends with — the
// categories screen edits it. Order is the order they appear in a picker.
//
// Exactly one TRANSFER: confirming a pair sets both movements to it, so the
// module cannot work without it, and two of them would make "which one" a
// question nobody should have to answer.
export const CATEGORIES = [
  { name: "Spesa", kind: "EXPENSE" },
  { name: "Ristoranti e bar", kind: "EXPENSE" },
  { name: "Casa e bollette", kind: "EXPENSE" },
  { name: "Trasporti", kind: "EXPENSE" },
  { name: "Salute", kind: "EXPENSE" },
  { name: "Abbonamenti", kind: "EXPENSE" },
  { name: "Tempo libero", kind: "EXPENSE" },
  { name: "Acquisti", kind: "EXPENSE" },
  { name: "Contanti", kind: "EXPENSE" },
  { name: "Altre uscite", kind: "EXPENSE" },
  { name: "Stipendio", kind: "INCOME" },
  { name: "Altre entrate", kind: "INCOME" },
  { name: "Trasferimento", kind: "TRANSFER" },
] as const
