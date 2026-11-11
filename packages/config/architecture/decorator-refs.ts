import ts from 'typescript';

/** What a decorator call refers to: the exported name, and the module it was imported from when it was imported. */
export interface DecoratorRef {
  readonly name: string;
  readonly module: string | undefined;
}

interface FileImports {
  /** Local name of a named import to its exported name and module. */
  readonly named: ReadonlyMap<string, DecoratorRef>;
  /** Local name of a namespace import to its module. */
  readonly namespaces: ReadonlyMap<string, string>;
}

const UNKNOWN: DecoratorRef = { name: '', module: undefined };

function importsOf(file: ts.SourceFile): FileImports {
  const named = new Map<string, DecoratorRef>();
  const namespaces = new Map<string, string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, module);
      continue;
    }
    for (const element of bindings.elements) {
      named.set(element.name.text, { name: (element.propertyName ?? element.name).text, module });
    }
  }
  return { named, namespaces };
}

/**
 * Resolves a decorator call such as `@Query()`, `@GqlQuery()` or `@gql.Query()` through the imports of `file`. A name
 * that no import brings in keeps its own name and has no module.
 */
export function decoratorResolverOf(file: ts.SourceFile): (call: ts.CallExpression) => DecoratorRef {
  const imports = importsOf(file);
  return (call) => {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) return imports.named.get(callee.text) ?? { name: callee.text, module: undefined };
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      return { name: callee.name.text, module: imports.namespaces.get(callee.expression.text) };
    }
    return UNKNOWN;
  };
}
