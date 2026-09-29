// Détection des incohérences dans les notes

import { Note, Inconsistency } from '../types/notes'
import { getAllNotes } from './notes'
import { getLotsConfig, getZoneRefs } from './repo'

export function detectInconsistencies(note: Note): Inconsistency[] {
  const issues: Inconsistency[] = []

  // ❌ Date checks
  if (note.dueDate && note.dueDate < note.context.meetingDate) {
    issues.push({
      type: 'date_illogical',
      severity: 'error',
      message: 'Délai antérieur à la date de réunion',
      suggested_fix: `Définir délai ≥ ${note.context.meetingDate}`
    })
  }

  if (note.dueDate && note.dueDate < note.createdAt.split('T')[0]) {
    issues.push({
      type: 'date_illogical',
      severity: 'error',
      message: 'Délai antérieur à la date de création',
      suggested_fix: `Définir délai ≥ ${note.createdAt.split('T')[0]}`
    })
  }

  // ❌ Context checks - missing lot/logement/company
  if (!note.context.lotIds?.length && !note.context.allCompanies) {
    issues.push({
      type: 'missing_context',
      severity: 'error',
      message: 'Aucun lot spécifié'
    })
  }

  if (!note.context.logementIds?.length && !note.context.allCompanies) {
    issues.push({
      type: 'missing_context',
      severity: 'error',
      message: 'Aucun logement spécifié'
    })
  }

  if (!note.context.companyIds?.length && !note.context.allCompanies) {
    issues.push({
      type: 'missing_context',
      severity: 'warning',
      message: 'Aucune entreprise spécifiée (ou marquer "toutes entreprises")'
    })
  }

  // ❌ Lot validity
  const lotsConfig = getLotsConfig()
  const validLotIds = Object.keys(lotsConfig)
  note.context.lotIds?.forEach(lotId => {
    if (!validLotIds.includes(lotId)) {
      issues.push({
        type: 'missing_context',
        severity: 'error',
        message: `Lot "${lotId}" n'existe pas`
      })
    }
  })

  // ❌ Logement validity
  const zoneRefs = getZoneRefs()
  const validLogementIds = zoneRefs.map(z => z.id)
  note.context.logementIds?.forEach(logementId => {
    if (!validLogementIds.includes(logementId)) {
      issues.push({
        type: 'missing_context',
        severity: 'error',
        message: `Logement "${logementId}" n'existe pas`
      })
    }
  })

  // ❌ Status transitions
  if (note.status === 'fait' && note.lastModifiedCrNo && note.lastModifiedCrNo > note.closedCrNo!) {
    issues.push({
      type: 'invalid_status',
      severity: 'warning',
      message: 'Note marquée "fait" mais modifiée après fermeture'
    })
  }

  // ⚠️ Orphaned task (if taskId but task doesn't exist anymore)
  // Note: This check is done elsewhere, but we keep the type for consistency
  // as detecting orphaned tasks requires access to the gantt tree

  // ⚠️ CR number gaps (warning only)
  const allNotes = getAllNotes()
  const uniqueCrNos = new Set(allNotes.map(n => n.context.crNo))
  const maxCrNo = Math.max(...uniqueCrNos)
  const minCrNo = Math.min(...uniqueCrNos)
  for (let i = minCrNo; i <= maxCrNo; i++) {
    if (!uniqueCrNos.has(i)) {
      issues.push({
        type: 'cr_number_gap',
        severity: 'warning',
        message: `CR N${i} manquant dans l'historique (écarts entre N${minCrNo} et N${maxCrNo})`
      })
      break // Only report once
    }
  }

  // ❌ Empty description
  if (!note.description || note.description.trim().length === 0) {
    issues.push({
      type: 'missing_context',
      severity: 'error',
      message: 'Description vide'
    })
  }

  return issues
}

export function validateAllNotes(): Map<string, Inconsistency[]> {
  const allNotes = getAllNotes()
  const results = new Map<string, Inconsistency[]>()

  allNotes.forEach(note => {
    const issues = detectInconsistencies(note)
    if (issues.length > 0) {
      results.set(note.id, issues)
    }
  })

  return results
}

export function hasErrors(inconsistencies: Inconsistency[]): boolean {
  return inconsistencies.some(i => i.severity === 'error')
}

export function hasWarnings(inconsistencies: Inconsistency[]): boolean {
  return inconsistencies.some(i => i.severity === 'warning')
}

export function getErrorCount(results: Map<string, Inconsistency[]>): number {
  let count = 0
  results.forEach(issues => {
    count += issues.filter(i => i.severity === 'error').length
  })
  return count
}

export function getWarningCount(results: Map<string, Inconsistency[]>): number {
  let count = 0
  results.forEach(issues => {
    count += issues.filter(i => i.severity === 'warning').length
  })
  return count
}
