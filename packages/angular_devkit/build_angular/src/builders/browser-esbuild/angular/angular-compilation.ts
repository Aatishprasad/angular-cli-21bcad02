/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import type ng from '@angular/compiler-cli';
import type ts from 'typescript';
import { loadEsmModule } from '../../../utils/load-esm';
import { profileSync } from '../profiling';
import type { AngularHostOptions } from './angular-host';

export interface EmitFileResult {
  content?: string;
  map?: string;
  dependencies: readonly string[];
}

export type FileEmitter = (file: string) => Promise<EmitFileResult | undefined>;

export abstract class AngularCompilation {
  static #angularCompilerCliModule?: typeof ng;

  static async loadCompilerCli(): Promise<typeof ng> {
    // This uses a wrapped dynamic import to load `@angular/compiler-cli` which is ESM.
    // Once TypeScript provides support for retaining dynamic imports this workaround can be dropped.
    AngularCompilation.#angularCompilerCliModule ??= await loadEsmModule<typeof ng>(
      '@angular/compiler-cli',
    );

    return AngularCompilation.#angularCompilerCliModule;
  }

  protected async loadConfiguration(tsconfig: string): Promise<ng.CompilerOptions> {
    const { readConfiguration } = await AngularCompilation.loadCompilerCli();

    return profileSync('NG_READ_CONFIG', () =>
      readConfiguration(tsconfig, {
        // Angular specific configuration defaults and overrides to ensure a functioning compilation.
        suppressOutputPathCheck: true,
        outDir: undefined,
        sourceMap: false,
        declaration: false,
        declarationMap: false,
        allowEmptyCodegenFiles: false,
        annotationsAs: 'decorators',
        enableResourceInlining: false,
      }),
    );
  }

  abstract initialize(
    tsconfig: string,
    hostOptions: AngularHostOptions,
    compilerOptionsTransformer?: (compilerOptions: ng.CompilerOptions) => ng.CompilerOptions,
  ): Promise<{ affectedFiles: ReadonlySet<ts.SourceFile>; compilerOptions: ng.CompilerOptions }>;

  abstract collectDiagnostics(): Iterable<ts.Diagnostic>;

  abstract createFileEmitter(onAfterEmit?: (sourceFile: ts.SourceFile) => void): FileEmitter;
}
