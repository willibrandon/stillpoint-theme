import /* unused import */ { inspect as unusedImport } from './inspect';

export function inspectUnused(unusedParameter: string, path: string): string {
  return path;
}

export class UnusedMembers {
  private unusedProperty = 'snapshot';

  private unusedMethod(): string {
    return 'snapshot';
  }

  read(): string {
    return 'assembly';
  }
}

function unusedFunction(): string {
  return 'snapshot';
}

type UnusedType = { name: string };

const unusedVariable = 'snapshot';
