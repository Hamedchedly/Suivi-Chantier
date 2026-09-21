// Comparateur de rendu pour React.memo (lignes/barres du Gantt) : compare
// uniquement les champs de PlanningTask qui affectent visuellement une ligne
// ou une barre, jamais la référence de l'objet — toPlanningTask() recrée un
// nouvel objet à chaque appel même quand rien n'a changé pour cette tâche.
import { PlanningTask } from '../../../types/planning'

const sameTime = (a?: Date, b?: Date): boolean => (a?.getTime() ?? null) === (b?.getTime() ?? null)

export function sameRenderTask(a: PlanningTask, b: PlanningTask): boolean {
  return (
    a.id === b.id &&
    a.progress === b.progress &&
    a.status === b.status &&
    a.isCritical === b.isCritical &&
    sameTime(a.contract.start, b.contract.start) &&
    sameTime(a.contract.end, b.contract.end) &&
    sameTime(a.actual.start, b.actual.start) &&
    sameTime(a.actual.end, b.actual.end) &&
    sameTime(a.forecast.start, b.forecast.start) &&
    sameTime(a.forecast.end, b.forecast.end) &&
    a.variance.startDays === b.variance.startDays &&
    a.variance.endDays === b.variance.endDays &&
    a.variance.forecastDays === b.variance.forecastDays &&
    a.variance.commitmentDays === b.variance.commitmentDays &&
    a.delayCause === b.delayCause &&
    a.latestCommitment?.id === b.latestCommitment?.id &&
    a.latestCommitment?.outcome === b.latestCommitment?.outcome &&
    a.latestCommitment?.promisedEnd === b.latestCommitment?.promisedEnd &&
    a.dependencies.length === b.dependencies.length
  )
}
