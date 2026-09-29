// Types pour le système Notes/Remarques (remplace Reserve/CR)

export interface Note {
  id: string                    // UUID
  number: string                // N-001, N-002, etc.
  description: string           // Texte de la remarque

  // AUTO-LINKED CONTEXT (lors de création sur une tâche/lot)
  context: {
    crNo: number               // CR# de création (ex: 18)
    meetingDate: string        // ISO yyyy-mm-dd du CR
    lotIds: string[]           // Lot(s) applicables
    logementIds: string[]      // Logement(s) applicables
    taskId?: string            // Tâche d'origine (optional)
    companyIds: string[]       // Entreprise(s) responsables
    allCompanies?: boolean     // Flag "toutes entreprises"
  }

  // STATUS & LIFECYCLE
  priority: 'low' | 'medium' | 'high'
  status: 'à faire' | 'en cours' | 'retard' | 'fait' | 'obsolète'
  closedCrNo?: number          // CR où fermée (visible N/N+1/N+2, archivée N+3)

  // DATES
  dueDate?: string             // ISO yyyy-mm-dd (délai action)
  createdAt: string            // ISO datetime
  updatedAt: string            // ISO datetime

  // AUDIT
  createdCrNo: number          // CR de création
  lastModifiedCrNo?: number    // Dernier CR modifié

  // INCOHÉRENCES
  inconsistencies?: Inconsistency[]  // Détectées lors validation
}

export interface Inconsistency {
  type: 'date_illogical' | 'missing_context' | 'invalid_status' | 'orphaned_note' | 'cr_number_gap'
  severity: 'error' | 'warning'
  message: string              // Description lisible
  suggested_fix?: string       // Suggestion correction
}

export type NoteStatus = 'à faire' | 'en cours' | 'retard' | 'fait' | 'obsolète'
export type NotePriority = 'low' | 'medium' | 'high'
