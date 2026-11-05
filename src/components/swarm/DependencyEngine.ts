import type { BlueprintLayerOperation, SwarmTool } from './swarmTypes'
import type { SwarmPoint } from './SwarmLoader'

export interface DependencyStats {
  total: number
  completed: number
  working: number
  reserved: number
  queued: number
  percent: number
}

export class DependencyEngine {
  private operations = new Map<string, BlueprintLayerOperation>()
  private completedIds = new Set<string>()
  private reservedMap = new Map<string, string>() // opId -> agentId
  private workingMap = new Map<string, string>() // opId -> agentId

  reset() {
    this.operations.clear()
    this.completedIds.clear()
    this.reservedMap.clear()
    this.workingMap.clear()
  }

  loadLayers(layers: BlueprintLayerOperation[]) {
    this.reset()
    layers.forEach((layer) => {
      this.operations.set(layer.id, {
        ...layer,
        status: 'queued',
        reservedBy: null,
      })
    })
  }

  getAllOperations(): BlueprintLayerOperation[] {
    return Array.from(this.operations.values())
  }

  getOperation(id: string): BlueprintLayerOperation | undefined {
    return this.operations.get(id)
  }

  isCompleted(id: string): boolean {
    return this.completedIds.has(id)
  }

  getCompletedIds(): Set<string> {
    return this.completedIds
  }

  getExecutableOperations(): BlueprintLayerOperation[] {
    const ready: BlueprintLayerOperation[] = []
    for (const op of this.operations.values()) {
      if (op.status !== 'queued') continue
      if (this.reservedMap.has(op.id) || this.workingMap.has(op.id)) continue

      // Check if all prerequisites are fulfilled
      const satisfied = !op.dependencies || op.dependencies.length === 0
        || op.dependencies.every((depId) => this.completedIds.has(depId))

      if (satisfied) {
        ready.push(op)
      }
    }
    return ready
  }

  findBestOperationForAgent(
    _agentId: string,
    currentTool: SwarmTool | null,
    agentPosition: SwarmPoint,
  ): BlueprintLayerOperation | null {
    const ready = this.getExecutableOperations()
    if (ready.length === 0) return null

    // Strategy 1: Prioritize matching the agent's current tool to eliminate trips to the toolbar!
    let candidates = currentTool
      ? ready.filter((op) => op.tool === currentTool)
      : []

    // Strategy 2: If no same-tool task is ready, consider all ready tasks
    if (candidates.length === 0) {
      candidates = ready
    }

    // Pick closest task by distance to agent
    let bestOp: BlueprintLayerOperation | null = null
    let bestDist = Number.POSITIVE_INFINITY

    for (const op of candidates) {
      const centerX = op.bounds.left + op.bounds.width / 2
      const centerY = op.bounds.top + op.bounds.height / 2
      const dist = Math.hypot(centerX - agentPosition.x, centerY - agentPosition.y)
      if (dist < bestDist) {
        bestDist = dist
        bestOp = op
      }
    }

    return bestOp
  }

  reserveOperation(operationId: string, agentId: string): boolean {
    const op = this.operations.get(operationId)
    if (!op || op.status !== 'queued') return false
    if (this.reservedMap.has(operationId) || this.workingMap.has(operationId)) return false

    op.status = 'collecting'
    op.reservedBy = agentId
    this.reservedMap.set(operationId, agentId)
    return true
  }

  startOperation(operationId: string, agentId: string): boolean {
    const op = this.operations.get(operationId)
    if (!op || op.status !== 'collecting' || this.reservedMap.get(operationId) !== agentId) return false

    op.status = 'working'
    op.reservedBy = agentId
    this.reservedMap.delete(operationId)
    this.workingMap.set(operationId, agentId)
    return true
  }

  completeOperation(operationId: string): string[] {
    const op = this.operations.get(operationId)
    if (!op || op.status !== 'working') return []

    op.status = 'complete'
    op.reservedBy = null

    this.reservedMap.delete(operationId)
    this.workingMap.delete(operationId)
    this.completedIds.add(operationId)

    // Find any newly unlocked operations
    const unlocked: string[] = []
    for (const other of this.operations.values()) {
      if (other.status !== 'queued') continue
      if (this.reservedMap.has(other.id) || this.workingMap.has(other.id)) continue
      if (other.dependencies && other.dependencies.includes(operationId)) {
        if (other.dependencies.every((d) => this.completedIds.has(d))) {
          unlocked.push(other.id)
        }
      }
    }
    return unlocked
  }

  releaseOperation(operationId: string) {
    const op = this.operations.get(operationId)
    if (!op) return
    if (op.status !== 'complete') {
      op.status = 'queued'
      op.reservedBy = null
    }
    this.reservedMap.delete(operationId)
    this.workingMap.delete(operationId)
  }

  isAllOperationsComplete(): boolean {
    for (const op of this.operations.values()) {
      if (op.status !== 'complete') return false
    }
    return true
  }

  getStats(): DependencyStats {
    const total = this.operations.size
    const completed = this.completedIds.size
    const working = this.workingMap.size
    const reserved = this.reservedMap.size
    const queued = Math.max(0, total - completed - working - reserved)
    const percent = total > 0 ? Math.floor((completed / total) * 100) : 0

    return {
      total,
      completed,
      working,
      reserved,
      queued,
      percent,
    }
  }
}
