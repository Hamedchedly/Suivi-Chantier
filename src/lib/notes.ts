// Logique CRUD + stockage pour Notes/Remarques

import { Note } from '../types/notes'
import { getCurrentProjectId } from './repo'

const STORAGE_KEY_PREFIX = 'notes:'

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`
}

function getLastSyncKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}:last_sync`
}

export function getAllNotes(): Note[] {
  try {
    const projectId = getCurrentProjectId()
    const key = getStorageKey(projectId)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Error loading notes:', e)
    return []
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    const projectId = getCurrentProjectId()
    const key = getStorageKey(projectId)
    localStorage.setItem(key, JSON.stringify(notes))
    localStorage.setItem(getLastSyncKey(projectId), new Date().toISOString())
  } catch (e) {
    console.error('Error saving notes:', e)
  }
}

export function getNote(noteId: string): Note | undefined {
  return getAllNotes().find(n => n.id === noteId)
}

export function saveNote(note: Note): void {
  const notes = getAllNotes()
  const index = notes.findIndex(n => n.id === note.id)
  if (index >= 0) {
    notes[index] = { ...note, updatedAt: new Date().toISOString() }
  } else {
    notes.push({ ...note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  saveNotes(notes)
}

export function deleteNote(noteId: string): void {
  const notes = getAllNotes().filter(n => n.id !== noteId)
  saveNotes(notes)
}

export function getNotesByLot(lotId: string): Note[] {
  return getAllNotes().filter(n => n.context.lotIds.includes(lotId))
}

export function getNotesByLogement(logementId: string): Note[] {
  return getAllNotes().filter(n => n.context.logementIds.includes(logementId))
}

export function getNotesByCompany(companyId: string): Note[] {
  return getAllNotes().filter(n => n.context.companyIds.includes(companyId))
}

export function getNotesByCrNo(crNo: number): Note[] {
  return getAllNotes().filter(n => n.context.crNo === crNo)
}

export function getOpenNotes(): Note[] {
  return getAllNotes().filter(n => !n.closedCrNo)
}

export function getClosedNotes(): Note[] {
  return getAllNotes().filter(n => n.closedCrNo)
}

export function getVisibleNotes(currentCrNo: number): Note[] {
  const notes = getAllNotes()
  return notes.filter(n => {
    if (!n.closedCrNo) return true
    const crsSinceClosure = currentCrNo - n.closedCrNo
    return crsSinceClosure <= 2
  })
}

export function getArchivedNotes(currentCrNo: number): Note[] {
  const notes = getAllNotes()
  return notes.filter(n => {
    if (!n.closedCrNo) return false
    const crsSinceClosure = currentCrNo - n.closedCrNo
    return crsSinceClosure > 2
  })
}

export function nextNoteNumber(notes?: Note[]): string {
  const allNotes = notes || getAllNotes()
  const numbers = allNotes
    .map(n => parseInt(n.number.substring(2), 10))
    .filter(n => !isNaN(n))
  const maxNum = Math.max(0, ...numbers)
  return `N-${String(maxNum + 1).padStart(3, '0')}`
}

export function closeNote(noteId: string, closedCrNo: number): void {
  const note = getNote(noteId)
  if (note) {
    note.closedCrNo = closedCrNo
    note.status = 'fait'
    saveNote(note)
  }
}

export function archiveNote(noteId: string): void {
  const note = getNote(noteId)
  if (note) {
    note.status = 'obsolète'
    saveNote(note)
  }
}
