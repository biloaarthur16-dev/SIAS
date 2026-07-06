// ---------------------------------------------------------------------------
// Donnees initiales : permettent de demontrer l'application immediatement.
// (Mots de passe en clair volontairement, contexte pedagogique.)
// ---------------------------------------------------------------------------
// seedRows() est utilise par la couche Postgres (src/store.js) ;
// buildSeed() reste l'alias historique. Meme donnees de demonstration.
export { buildSeed as seedRows };

export function buildSeed() {
  return {
    counters: { ASR: 1, MED: 2, ASS: 5, CONS: 1, FM: 0, PRESC: 0, REMB: 0, SPEC: 9 },

    specialites: [
      { id: "SPEC-1", nom: "Cardiologie" },
      { id: "SPEC-2", nom: "Dermatologie" },
      { id: "SPEC-3", nom: "Pédiatrie" },
      { id: "SPEC-4", nom: "Neurologie" },
      { id: "SPEC-5", nom: "Gynécologie" },
      { id: "SPEC-6", nom: "Ophtalmologie" },
      { id: "SPEC-7", nom: "Chirurgie" },
      { id: "SPEC-8", nom: "Psychiatrie" },
      { id: "SPEC-9", nom: "Radiologie" }
    ],

    // Personnel de l'organisme (acteur "Assureur")
    assureurs: [
      {
        id: "ASR-1",
        role: "ASSUREUR",
        nom: "Saha",
        prenom: "",
        email: "saha@cnps.cm",
        tel: "699000000",
        login: "admin",
        password: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", // admin123
        etat: "Actif",
      },
    ],

    // Medecins (generalistes et specialistes) - acteur "Medecin"
    medecins: [
      {
        id: "MED-1",
        role: "MEDECIN",
        type: "GENERALISTE",
        specialite: null,
        nom: "Owen",
        prenom: "",
        age: 45,
        email: "owen@sante.cm",
        tel: "677111222",
        login: "owen",
        password: "2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18", // med123
        etat: "Actif",
      },
      {
        id: "MED-2",
        role: "MEDECIN",
        type: "SPECIALISTE",
        specialite: "Cardiologie",
        nom: "Nzoyem",
        prenom: "",
        age: 52,
        email: "nzoyem@sante.cm",
        tel: "655333444",
        login: "nzoyem",
        password: "2e4e70b3503b8b88bb6e7ace3b31c61b541adaf83db4e6313b6550ad01284b18", // med123
        etat: "Actif",
      },
    ],

    // Assures (patients)
    assures: [
      {
        id: "ASS-1",
        role: "ASSURE",
        nom: "Philippe",
        prenom: "",
        age: 21,
        email: "philippe@gmail.com",
        tel: "654342209",
        profession: "Etudiant",
        groupeSanguin: "B+",
        allergies: "Pénicilline",
        medecinTraitantId: "MED-1",
      },
      {
        id: "ASS-2",
        role: "ASSURE",
        nom: "Tanzi",
        prenom: "",
        age: 20,
        email: "tanzi@gmail.com",
        tel: "655337228",
        profession: "Comptable",
        groupeSanguin: "O+",
        allergies: "",
        medecinTraitantId: null,
      },
      {
        id: "ASS-3",
        role: "ASSURE",
        nom: "Galant",
        prenom: "",
        age: 34,
        email: "galant@gmail.com",
        tel: "690445566",
        profession: "Enseignant",
        groupeSanguin: "A+",
        allergies: "",
        medecinTraitantId: null,
      },
      {
        id: "ASS-4",
        role: "ASSURE",
        nom: "Owen",
        prenom: "",
        age: 45,
        email: "owen@sante.cm",
        tel: "677111222",
        profession: "Médecin",
        groupeSanguin: "",
        allergies: "",
        medecinTraitantId: null,
        isMedecin: true,
        medecinId: "MED-1",
      },
      {
        id: "ASS-5",
        role: "ASSURE",
        nom: "Nzoyem",
        prenom: "",
        age: 52,
        email: "nzoyem@sante.cm",
        tel: "655333444",
        profession: "Médecin",
        groupeSanguin: "",
        allergies: "",
        medecinTraitantId: null,
        isMedecin: true,
        medecinId: "MED-2",
      },
    ],

    // Consultation d'exemple (Philippe chez son medecin traitant Owen)
    consultations: [
      {
        id: "CONS-1",
        assureId: "ASS-1",
        medecinId: "MED-1",
        date: "2025-10-02T13:03:00",
        etat: "Effectuee",
        motif: "Fievre et fatigue",
      },
    ],

    feuilles: [], // Feuilles de maladie
    prescriptions: [], // Medicaments + consultations specialisees
    remboursements: [],
  };
}
